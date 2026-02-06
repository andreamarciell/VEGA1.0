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
} from './_ingestSchemas';

/**
 * Netlify Function: ingestTransactions
 * Gateway API-First per ingestione dati (Movements, Profiles, Sessions)
 * Sostituisce sistema basato su file SFTP/CSV
 */

const DATASET_ID = 'toppery_test';
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
 * Helper per validare API key
 */
function validateAPIKey(apiKey: string | null | undefined): boolean {
  const expectedKey = process.env.CLIENT_API_KEY;
  if (!expectedKey) {
    console.error('CLIENT_API_KEY not configured');
    return false;
  }
  return apiKey === expectedKey;
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
      await insertBigQuery(DATASET_ID, tableId, batch);
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

  // Autenticazione API Key
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (!validateAPIKey(apiKey)) {
    await logAudit(supabase, {
      accountId: null,
      status: 'error',
      movementsCount: 0,
      profilesCount: 0,
      sessionsCount: 0,
      errorMessage: 'Invalid or missing API key',
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
        message: 'Invalid or missing API key'
      })
    };
  }

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
      const result = await insertBatch('Profiles', preparedProfiles);
      profilesInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
    }

    // Inserisci Movements
    if (movements.length > 0) {
      const preparedMovements = prepareForBigQuery(movements);
      const result = await insertBatch('Movements', preparedMovements);
      movementsInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
    }

    // Inserisci Sessions
    if (sessions.length > 0) {
      const preparedSessions = prepareForBigQuery(sessions);
      const result = await insertBatch('Sessions', preparedSessions);
      sessionsInserted = result.success;
      totalDuplicates += result.duplicates;
      bigqueryErrors.push(...result.errors);
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

  // Verifica se triggerare risk calculation
  const shouldTrigger = movementsInserted > 0 || profilesInserted > 0 || sessionsInserted > 0;
  const triggerDirectly = event.queryStringParameters?.trigger_risk === 'true';
  let riskCalculationResult: { triggered: boolean; status?: string; error?: string } | null = null;

  if (triggerDirectly && shouldTrigger) {
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
    should_trigger_risk_calculation: shouldTrigger,
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
