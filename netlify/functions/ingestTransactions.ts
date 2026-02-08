import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { insertBigQuery } from './_bigqueryClient';
import { createServiceClient } from './_supabaseAdmin';
import { 
  IngestPayloadSchema, 
  normalizePayload,
  type Movement,
  type Profile,
  type Session
} from '../utils/ingestSchemas';

/**
 * Netlify Function: ingestTransactions
 * Gateway API-First per ingestione dati (Movements, Profiles, Sessions)
 * Sostituisce sistema basato su file SFTP/CSV
 */

const DEFAULT_DATASET_ID = 'toppery_test';
const BATCH_SIZE = parseInt(process.env.BIGQUERY_BATCH_SIZE || '100', 10);

/**
 * Helper per estrarre IP client dalla richiesta
 */
function getClientIP(event: any): string {
  // Netlify passa l'IP in x-forwarded-for o client-ip
  const forwardedFor = event.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for può contenere multipli IP, prendi il primo
    return forwardedFor.split(',')[0].trim();
  }
  return event.headers['client-ip'] || event.headers['x-client-ip'] || 'unknown';
}

/**
 * Helper per verificare se IP è nella whitelist
 */
function isIPAllowed(clientIP: string, allowedIPs: string): boolean {
  // Skip IP check se SKIP_IP_WHITELIST è impostato (per test)
  if (process.env.SKIP_IP_WHITELIST === 'true' || process.env.SKIP_IP_WHITELIST === '1') {
    console.log('IP whitelist check skipped (SKIP_IP_WHITELIST enabled)');
    return true;
  }

  if (!allowedIPs || allowedIPs.trim() === '') {
    // Se non configurato, permettere tutte le richieste (solo per sviluppo)
    console.warn('ALLOWED_CLIENT_IPS not configured, allowing all IPs');
    return true;
  }

  // Supporta sia virgola che spazio come separatore
  const ipList = allowedIPs.split(/[,\s]+/).map(ip => ip.trim()).filter(ip => ip);
  return ipList.includes(clientIP);
}

/**
 * Interface for API client from database
 */
interface ApiClient {
  id: string;
  client_name: string;
  dataset_id: string;
  is_active: boolean;
  metadata: Record<string, any>;
  tenant_code?: string; // Optional tenant_code from api_clients
}

/**
 * Helper per validare API key e recuperare client metadata da Supabase
 * Supporta sia il vecchio sistema (env var singola) che il nuovo (multi-tenant)
 */
async function validateAPIKeyAndGetClient(
  apiKey: string | null | undefined,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ valid: boolean; client?: ApiClient; error?: string }> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  // Prima prova con il nuovo sistema multi-tenant (Supabase)
  try {
    // Query api_clients per trovare il client con questa API key
    // La validazione effettiva della key avviene confrontando con l'env var
    const { data: clients, error } = await supabase
      .from('api_clients')
      .select('id, client_name, dataset_id, is_active, metadata, api_key_env_var, tenant_code')
      .eq('is_active', true);

    if (error) {
      console.error('Error querying api_clients:', error);
      // Fallback al vecchio sistema
    } else if (clients && clients.length > 0) {
      // Cerca il client la cui env var contiene la key fornita
      for (const client of clients) {
        const envVarName = (client as any).api_key_env_var;
        if (envVarName && process.env[envVarName] === apiKey) {
          return {
            valid: true,
            client: {
              id: client.id,
              client_name: client.client_name,
              dataset_id: client.dataset_id,
              is_active: client.is_active,
              metadata: client.metadata || {},
              tenant_code: (client as any).tenant_code || undefined
            }
          };
        }
      }
    }
  } catch (error) {
    console.warn('Multi-tenant API key validation failed, falling back to legacy:', error);
  }

  // Fallback al vecchio sistema (retrocompatibilità)
  const expectedKey = process.env.CLIENT_API_KEY;
  if (expectedKey && apiKey === expectedKey) {
    return {
      valid: true,
      client: {
        id: 'legacy',
        client_name: 'Legacy Client',
        dataset_id: DEFAULT_DATASET_ID,
        is_active: true,
        metadata: {}
      }
    };
  }

  return { valid: false, error: 'Invalid API key' };
}

/**
 * Helper per loggare audit su Supabase
 */
async function logAudit(
  supabase: ReturnType<typeof createServiceClient>,
  data: {
    accountId: string | null;
    status: 'success' | 'error' | 'partial_success';
    movementsCount: number;
    profilesCount: number;
    sessionsCount: number;
    errorMessage?: string;
    clientIP: string;
    processingTimeMs: number;
    bigqueryErrors?: any[];
    duplicatesHandled?: number;
  }
): Promise<void> {
  try {
    const content = {
      movements_count: data.movementsCount,
      profiles_count: data.profilesCount,
      sessions_count: data.sessionsCount,
      status: data.status,
      error_message: data.errorMessage || null
    };

    const metadata: Record<string, any> = {
      client_ip: data.clientIP,
      timestamp: new Date().toISOString(),
      processing_time_ms: data.processingTimeMs
    };

    if (data.bigqueryErrors && data.bigqueryErrors.length > 0) {
      metadata.bigquery_errors = data.bigqueryErrors;
    }

    if (data.duplicatesHandled !== undefined && data.duplicatesHandled > 0) {
      metadata.duplicates_handled = data.duplicatesHandled;
    }

    await supabase
      .from('player_activity_log')
      .insert({
        account_id: data.accountId || 'system',
        activity_type: 'api_ingest',
        content: JSON.stringify(content),
        created_by: 'api_client',
        metadata: metadata
      });
  } catch (error) {
    // Non bloccare la response se il logging fallisce
    console.error('Failed to log audit:', error);
  }
}

/**
 * Helper per convertire dati per BigQuery
 * Converte account_id a numero (INT64) e normalizza timestamps
 */
function prepareForBigQuery<T extends { account_id: string }>(
  items: T[],
  accountIdField: 'account_id' = 'account_id'
): Array<Record<string, any>> {
  return items.map(item => {
    const converted: Record<string, any> = { ...item };
    
    // Converti account_id a numero per INT64 BigQuery
    if (converted[accountIdField] !== undefined && converted[accountIdField] !== null) {
      const accountId = converted[accountIdField];
      if (typeof accountId === 'string') {
        const parsed = parseInt(accountId.trim(), 10);
        if (isNaN(parsed)) {
          throw new Error(`Invalid account_id format: "${accountId}" (must be numeric)`);
        }
        converted[accountIdField] = parsed;
      } else if (typeof accountId === 'number') {
        // Assicurati che sia un intero
        converted[accountIdField] = Math.floor(accountId);
      }
      // Se è già un numero valido, lascialo così
    }

    // Assicurati che i timestamps siano stringhe ISO
    // (BigQuery gestisce automaticamente le stringhe ISO come TIMESTAMP)
    // I timestamps dovrebbero già essere stringhe ISO dal validatore Zod
    
    return converted;
  });
}

/**
 * Helper per verificare se un errore BigQuery è un errore di duplicato (idempotenza)
 */
function isDuplicateError(error: any): boolean {
  if (!error || !error.errors) return false;
  
  // BigQuery restituisce errori parziali in error.errors array
  return error.errors.some((err: any) => {
    const message = err.message || err.reason || '';
    const code = err.code || '';
    
    // Codici e messaggi comuni per duplicati/constraint violations
    return (
      code === 409 || // Conflict
      message.includes('duplicate') ||
      message.includes('already exists') ||
      message.includes('UNIQUE') ||
      message.includes('PRIMARY KEY') ||
      message.includes('constraint')
    );
  });
}

/**
 * Helper per inserire dati in BigQuery con batch processing
 * Gestisce duplicati in modo idempotente (non fallisce su duplicati)
 */
async function insertBatch(
  datasetId: string,
  tableId: string,
  rows: Record<string, any>[]
): Promise<{ success: number; errors: any[]; duplicates: number }> {
  const errors: any[] = [];
  let successCount = 0;
  let duplicateCount = 0;

  // Processa in batch
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await insertBigQuery(datasetId, tableId, batch);
      successCount += batch.length;
    } catch (error: any) {
      // Se è un errore di duplicato, considera il batch come successo (idempotenza)
      if (isDuplicateError(error)) {
        console.log(`Duplicate entries in batch ${i / BATCH_SIZE + 1} to ${tableId} (idempotent, ignoring)`);
        duplicateCount += batch.length;
        successCount += batch.length; // Considera come successo per idempotenza
      } else {
        // Per altri errori, logga ma continua
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1} to ${tableId}:`, error.message);
        errors.push({
          table: tableId,
          batch: i / BATCH_SIZE + 1,
          error: error.message || 'Unknown error',
          details: error.errors || []
        });
        // Continua con il prossimo batch anche se questo fallisce
      }
    }
  }

  return { success: successCount, errors, duplicates: duplicateCount };
}

/**
 * Helper per triggerare calculateRiskScores
 */
async function triggerRiskCalculation(
  accountIds: string[]
): Promise<{ triggered: boolean; status?: string; error?: string }> {
  try {
    // Costruisci URL per la Netlify Function
    // In produzione Netlify, usa URL o DEPLOY_PRIME_URL
    // In sviluppo locale, usa localhost
    const baseUrl = process.env.URL || 
                    process.env.DEPLOY_PRIME_URL || 
                    (process.env.NETLIFY_DEV ? 'http://localhost:8888' : '');
    
    if (!baseUrl) {
      return {
        triggered: false,
        status: 'error',
        error: 'Base URL not configured'
      };
    }

    const functionUrl = `${baseUrl}/.netlify/functions/calculateRiskScores`;

    // Timeout di 30 secondi per la chiamata
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Chiama la funzione (calculateRiskScores processa tutti i profili, non solo quelli specifici)
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Netlify-Function-ingestTransactions'
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP ${response.status}`);
        return {
          triggered: false,
          status: 'error',
          error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
        };
      }

      const result = await response.json().catch(() => ({ success: false }));
      return {
        triggered: true,
        status: result.success ? 'completed' : 'error',
        error: result.error
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return {
          triggered: false,
          status: 'error',
          error: 'Request timeout (30s)'
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error triggering risk calculation:', error);
    return {
      triggered: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

const handler: Handler = async (event) => {
  const startTime = Date.now();
  const clientIP = getClientIP(event);
  const supabase = createServiceClient();

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type,x-api-key',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  // Solo POST supportato
  if (event.httpMethod !== 'POST') {
    await logAudit(supabase, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage: `Method ${event.httpMethod} not allowed`,
      clientIP,
      processingTimeMs: Date.now() - startTime
    });

    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Method Not Allowed',
        message: `Only POST method is supported`
      })
    };
  }

  // Autenticazione API Key e recupero client metadata
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  const keyValidation = await validateAPIKeyAndGetClient(apiKey, supabase);
  
  if (!keyValidation.valid || !keyValidation.client) {
    await logAudit(supabase, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage: keyValidation.error || 'Invalid or missing API key',
      clientIP,
      processingTimeMs: Date.now() - startTime
    });

    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: keyValidation.error || 'Invalid or missing API key'
      })
    };
  }

  // Usa il dataset_id del client (multi-tenant)
  const client = keyValidation.client;
  const datasetId = client.dataset_id || DEFAULT_DATASET_ID;

  // IP Whitelisting
  const allowedIPs = process.env.ALLOWED_CLIENT_IPS || '';
  if (!isIPAllowed(clientIP, allowedIPs)) {
    await logAudit(supabase, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage: `IP ${clientIP} not in whitelist`,
      clientIP,
      processingTimeMs: Date.now() - startTime
    });

    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: 'Forbidden',
        message: 'IP address not authorized'
      })
    };
  }

  // Parse e validazione payload
  let payload: z.infer<typeof IngestPayloadSchema>;
  try {
    if (!event.body) {
      throw new Error('Request body is required');
    }
    const parsed = JSON.parse(event.body);
    payload = IngestPayloadSchema.parse(parsed);
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      : error instanceof Error
      ? error.message
      : 'Invalid JSON payload';

    await logAudit(supabase, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage,
      clientIP,
      processingTimeMs: Date.now() - startTime
    });

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: 'Validation failed',
        message: errorMessage,
        details: error instanceof z.ZodError
          ? error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          : undefined
      })
    };
  }

  // Normalizza payload (sempre array)
  const normalized = normalizePayload(payload);
  const { movements, profiles, sessions } = normalized;

  // Estrai account_ids unici per logging e trigger
  const accountIds = new Set<string>();
  movements.forEach(m => accountIds.add(m.account_id));
  profiles.forEach(p => accountIds.add(p.account_id));
  sessions.forEach(s => accountIds.add(s.account_id));
  const uniqueAccountIds = Array.from(accountIds);

  // Inserimento BigQuery
  const bigqueryErrors: any[] = [];
  let movementsInserted = 0;
  let profilesInserted = 0;
  let sessionsInserted = 0;
  let totalDuplicates = 0;

  try {
    // Inserisci Profiles prima (potrebbero essere referenziati)
    if (profiles.length > 0) {
      const preparedProfiles = prepareForBigQuery(profiles);
      const result = await insertBatch(datasetId, 'Profiles', preparedProfiles);
      profilesInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
    }

    // Inserisci Movements
    if (movements.length > 0) {
      const preparedMovements = prepareForBigQuery(movements);
      const result = await insertBatch(datasetId, 'Movements', preparedMovements);
      movementsInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
    }

    // Inserisci Sessions
    if (sessions.length > 0) {
      const preparedSessions = prepareForBigQuery(sessions);
      const result = await insertBatch(datasetId, 'Sessions', preparedSessions);
      sessionsInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
    }

    // Salva mapping account_id -> dataset_id -> tenant_code dopo inserimento in BigQuery
    // Questo permette a syncFromDatabase di sapere in quale dataset cercare i dati
    // api_client_id è opzionale (può essere null per compatibilità con nuovo sistema env vars)
    // tenant_code viene recuperato dal client o dal database
    if (uniqueAccountIds.length > 0 && (profilesInserted > 0 || movementsInserted > 0 || sessionsInserted > 0)) {
      try {
        // Recupera tenant_code se non è già presente nel client
        let tenantCode = client.tenant_code;
        if (!tenantCode && client.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client.id)) {
          // Se client.id è un UUID valido, query api_clients per ottenere tenant_code
          const { data: apiClient, error: apiClientError } = await supabase
            .from('api_clients')
            .select('tenant_code')
            .eq('id', client.id)
            .single();
          
          if (!apiClientError && apiClient?.tenant_code) {
            tenantCode = apiClient.tenant_code;
          }
        }

        // Se ancora non abbiamo tenant_code, prova a recuperarlo da dataset_id
        if (!tenantCode) {
          const { data: apiClientByDataset, error: datasetError } = await supabase
            .from('api_clients')
            .select('tenant_code')
            .eq('dataset_id', datasetId)
            .eq('is_active', true)
            .maybeSingle();
          
          if (!datasetError && apiClientByDataset?.tenant_code) {
            tenantCode = apiClientByDataset.tenant_code;
          }
        }

        const mappings = uniqueAccountIds.map(accountId => {
          const mapping: any = {
            account_id: accountId,
            dataset_id: datasetId
          };
          // Solo se client.id è un UUID valido, includilo (altrimenti è null)
          // I client ID generati da env vars (es: 'env_dataset_123' o 'legacy') non sono UUID validi
          if (client.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client.id)) {
            mapping.api_client_id = client.id;
          }
          // Aggiungi tenant_code se disponibile
          if (tenantCode) {
            mapping.tenant_code = tenantCode;
          }
          return mapping;
        });

        const { error: mappingError } = await supabase
          .from('account_dataset_mapping')
          .upsert(mappings, {
            onConflict: 'account_id',
            ignoreDuplicates: false // Aggiorna last_updated_at se esiste già
          });

        if (mappingError) {
          console.error('Error saving account_dataset_mapping:', mappingError);
          // Non bloccare il processo se il mapping fallisce, ma logga l'errore
        } else {
          console.log(`Saved ${mappings.length} account_id mappings to dataset ${datasetId}${tenantCode ? ` with tenant_code ${tenantCode}` : ''}`);
        }

        // Verifica se ci sono profili associati a questi account_id
        // Logga quando un account_id non ha un profilo associato (per facilitare associazione manuale)
        for (const accountId of uniqueAccountIds) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, account_id')
            .eq('account_id', accountId)
            .maybeSingle();
          
          if (!profile) {
            console.log(`[ingestTransactions] Account ID ${accountId} has no associated user profile. Use POST /api/v1/admin/profiles/:userId/account-id to associate manually.`);
          }
        }
      } catch (mappingErr) {
        console.error('Exception saving account_dataset_mapping:', mappingErr);
        // Continua anche se il mapping fallisce
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('BigQuery insertion error:', error);

    await logAudit(supabase, {
      accountId: uniqueAccountIds[0] || null,
      status: 'error',
      movementsCount: movements.length,
      profilesCount: profiles.length,
      sessionsCount: sessions.length,
      errorMessage,
      clientIP,
      processingTimeMs: Date.now() - startTime,
      bigqueryErrors: bigqueryErrors.length > 0 ? bigqueryErrors : [error]
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: 'BigQuery insertion failed',
        message: errorMessage,
        processed: {
          movements: movementsInserted,
          profiles: profilesInserted,
          sessions: sessionsInserted
        }
      })
    };
  }

  // Trigger automatico del calcolo del rischio dopo ogni ingest di successo
  const shouldTrigger = movementsInserted > 0 || profilesInserted > 0 || sessionsInserted > 0;
  let riskCalculationResult: { triggered: boolean; status?: string; error?: string } | null = null;

  if (shouldTrigger) {
    // Trigger automatico: calcola sempre il rischio quando ci sono dati inseriti
    riskCalculationResult = await triggerRiskCalculation(uniqueAccountIds);
  }

  // Log audit successo (include info su duplicati se presenti)
  await logAudit(supabase, {
    accountId: uniqueAccountIds[0] || null,
    status: bigqueryErrors.length > 0 ? 'partial_success' : 'success',
    movementsCount: movementsInserted,
    profilesCount: profilesInserted,
    sessionsCount: sessionsInserted,
    clientIP,
    processingTimeMs: Date.now() - startTime,
    bigqueryErrors: bigqueryErrors.length > 0 ? bigqueryErrors : undefined,
    duplicatesHandled: totalDuplicates > 0 ? totalDuplicates : undefined
  });

  // Response di successo
  const response: any = {
    success: true,
    processed: {
      movements: movementsInserted,
      profiles: profilesInserted,
      sessions: sessionsInserted
    },
    account_ids: uniqueAccountIds,
    risk_calculation_triggered: riskCalculationResult?.triggered || false,
    message: bigqueryErrors.length > 0 
      ? 'Data ingested with some errors (check details)'
      : totalDuplicates > 0
      ? `Data ingested successfully (${totalDuplicates} duplicates handled idempotently)`
      : 'Data ingested successfully'
  };

  // Aggiungi info su duplicati se presenti
  if (totalDuplicates > 0) {
    response.duplicates_handled = totalDuplicates;
  }

  // Aggiungi warning se ci sono errori non-duplicati
  if (bigqueryErrors.length > 0) {
    response.warnings = bigqueryErrors.map((err: any) => ({
      table: err.table,
      batch: err.batch,
      error: err.error
    }));
  }

  if (riskCalculationResult) {
    response.risk_calculation_status = riskCalculationResult.status;
    if (riskCalculationResult.error) {
      response.risk_calculation_error = riskCalculationResult.error;
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify(response)
  };
};

export { handler };
