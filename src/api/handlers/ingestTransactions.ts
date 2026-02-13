import type { ApiHandler } from '../types';
import { z } from 'zod';
import { insertBigQuery } from './_bigqueryClient';
// Removed Supabase dependency - using tenant database pool from middleware instead
import { calculateRiskForSpecificAccounts } from './calculateRiskScores';
import { 
  IngestPayloadSchema, 
  normalizePayload,
  type Movement,
  type Profile,
  type Session
} from '../utils/ingestSchemas';

/**
 * API Handler: ingestTransactions
 * Gateway API-First per ingestione dati (Movements, Profiles, Sessions)
 * Sostituisce sistema basato su file SFTP/CSV
 */

const BATCH_SIZE = parseInt(process.env.BIGQUERY_BATCH_SIZE || '100', 10);

/**
 * Helper per estrarre IP client dalla richiesta
 */
function getClientIP(event: any): string {
  // Cloud Run/Express passa l'IP in x-forwarded-for o client-ip
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
 * Helper per validare API key e recuperare client metadata
 * Usa env vars strutturate per multi-tenant (più semplice e veloce)
 * 
 * Formati supportati:
 * 1. API_KEYS=key1:dataset1:client1,key2:dataset2:client2 (singola env var)
 * 2. API_KEY_*=key:dataset:client (env vars separate)
 * 3. CLIENT_API_KEY=key (legacy, singolo tenant)
 */
async function validateAPIKeyAndGetClient(
  apiKey: string | null | undefined,
  dbPool: any // TODO: Replace with proper Pool type from pg
): Promise<{ valid: boolean; client?: ApiClient; error?: string }> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  // Metodo 1: Leggi API_KEYS env var (formato: key1:dataset1:client1,key2:dataset2:client2)
  const apiKeysEnv = process.env.API_KEYS;
  if (apiKeysEnv) {
    const entries = apiKeysEnv.split(',').map(entry => entry.trim()).filter(entry => entry);
    for (const entry of entries) {
      const parts = entry.split(':').map(p => p.trim());
      if (parts.length >= 2) {
        const [key, datasetId, ...clientNameParts] = parts;
        const clientName = clientNameParts.join(':') || 'Client';
        
        if (key === apiKey) {
          return {
            valid: true,
            client: {
              id: `env_${datasetId}_${Date.now()}`, // ID temporaneo per compatibilità
              client_name: clientName,
              dataset_id: datasetId,
              is_active: true,
              metadata: {}
            }
          };
        }
      }
    }
  }

  // Metodo 2: Cerca env vars con pattern API_KEY_*
  const envKeys = Object.keys(process.env);
  for (const envKey of envKeys) {
    if (envKey.startsWith('API_KEY_') && envKey !== 'API_KEYS') {
      const envValue = process.env[envKey];
      if (envValue) {
        const parts = envValue.split(':').map(p => p.trim());
        if (parts.length >= 2) {
          const [key, datasetId, ...clientNameParts] = parts;
          const clientName = clientNameParts.join(':') || envKey.replace('API_KEY_', '');
          
          if (key === apiKey) {
            return {
              valid: true,
              client: {
                id: `env_${envKey}`,
                client_name: clientName,
                dataset_id: datasetId,
                is_active: true,
                metadata: {}
              }
            };
          }
        }
      }
    }
  }

  // TODO: Migrate api_clients table to tenant database
  // Method 3 removed - api_clients table migration pending
  // For now, API keys are validated via environment variables only

  return { valid: false, error: 'Invalid API key' };
}

/**
 * Helper per loggare audit su tenant database
 */
async function logAudit(
  dbPool: any, // TODO: Replace with proper Pool type from pg
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

    await dbPool.query(
      `INSERT INTO player_activity_log (account_id, activity_type, content, created_by, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        data.accountId || 'system',
        'api_ingest',
        JSON.stringify(content),
        'api_client',
        JSON.stringify(metadata)
      ]
    );
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
 * Helper per calcolare il rischio immediatamente per account_id specifici
 * Usa la funzione helper calculateRiskForSpecificAccounts invece di fare HTTP call
 */
async function calculateRiskForIngestedAccounts(
  accountIds: string[],
  datasetId: string
): Promise<{ triggered: boolean; status?: string; error?: string; success?: number; errors?: number }> {
  try {
    if (accountIds.length === 0) {
      return {
        triggered: false,
        status: 'skipped',
        error: 'No account IDs to process'
      };
    }

    console.log(`[ingestTransactions] Calculating risk for ${accountIds.length} account IDs in dataset ${datasetId}`);
    
    const result = await calculateRiskForSpecificAccounts(accountIds, datasetId, 'ingest', event.dbPool!);
    
    return {
      triggered: true,
      status: result.errors > 0 ? 'partial_success' : 'completed',
      success: result.success,
      errors: result.errors,
      error: result.errors > 0 ? `${result.errors} errors occurred` : undefined
    };
  } catch (error) {
    console.error('[ingestTransactions] Error calculating risk:', error);
    return {
      triggered: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export const handler: ApiHandler = async (event) => {
  const startTime = Date.now();
  const clientIP = getClientIP(event);
  
  // Verify tenant database pool is available (injected by middleware)
  if (!event.dbPool) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Database pool not available' })
    };
  }

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
    await logAudit(event.dbPool!, {
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
  const keyValidation = await validateAPIKeyAndGetClient(apiKey, event.dbPool!);
  
  if (!keyValidation.valid || !keyValidation.client) {
    await logAudit(event.dbPool!, {
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

  // Verifica che il middleware abbia iniettato auth con bqDatasetId
  if (!event.auth || !event.auth.bqDatasetId) {
    await logAudit(event.dbPool!, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage: 'BigQuery dataset ID not configured for tenant',
      clientIP,
      processingTimeMs: Date.now() - startTime
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
        error: 'Configuration error',
        message: 'BigQuery dataset ID not configured for this tenant'
      })
    };
  }

  // Usa il dataset_id del tenant iniettato dal middleware
  const datasetId = event.auth.bqDatasetId;

  // IP Whitelisting
  const allowedIPs = process.env.ALLOWED_CLIENT_IPS || '';
  if (!isIPAllowed(clientIP, allowedIPs)) {
    await logAudit(event.dbPool!, {
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

    await logAudit(event.dbPool!, {
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
          // TODO: Migrate api_clients to tenant database
          // Query removed - using environment variables only for now
          const apiClient = null;
          const apiClientError = null;
            // TODO: Migrate api_clients to tenant database
            // Query removed - api_clients table migration pending
          
          if (!apiClientError && apiClient?.tenant_code) {
            tenantCode = apiClient.tenant_code;
          }
        }

        // TODO: Migrate api_clients to tenant database
        // Query removed - api_clients table migration pending

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

        // TODO: Migrate account_dataset_mapping and profiles to tenant database
        // Queries removed - table migrations pending
        console.log(`TODO: Save ${mappings.length} account_id mappings to dataset ${datasetId} (migration pending)`);
        
        // Skip profile verification for now (migration pending)
        for (const accountId of uniqueAccountIds) {
          // TODO: Query profiles from tenant database after migration
          const profile = null; // Placeholder
          
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

    await logAudit(event.dbPool!, {
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
  let riskCalculationResult: { triggered: boolean; status?: string; error?: string; success?: number; errors?: number } | null = null;

  if (shouldTrigger) {
    // Calcola immediatamente il rischio per gli account_id che hanno ricevuto nuovi dati
    // Usa il dataset_id del client per query corrette
    riskCalculationResult = await calculateRiskForIngestedAccounts(uniqueAccountIds, datasetId);
  }

  // Log audit successo (include info su duplicati se presenti)
  await logAudit(event.dbPool!, {
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
    if (riskCalculationResult.success !== undefined) {
      response.risk_calculation_success = riskCalculationResult.success;
    }
    if (riskCalculationResult.errors !== undefined) {
      response.risk_calculation_errors = riskCalculationResult.errors;
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
