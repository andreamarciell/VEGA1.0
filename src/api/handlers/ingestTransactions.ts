import type { ApiHandler } from '../types';
import { z } from 'zod';
import { insertBigQuery } from './_bigqueryClient';
import { getMasterPool, getTenantPool } from '../../lib/db.js';
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
 * Interface for tenant info from master database
 */
interface TenantInfo {
  tenant_id: string;
  db_name: string;
  bq_dataset_id: string;
  display_name: string;
}

/**
 * Helper per validare API key e recuperare tenant metadata dal database MASTER
 * Interroga tenant_api_keys con JOIN a tenants per ottenere bq_dataset_id e db_name
 */
async function validateAPIKeyAndGetClient(
  apiKey: string | null | undefined
): Promise<{ valid: boolean; tenant?: TenantInfo; error?: string }> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    const masterPool = getMasterPool();
    
    // Query tenant_api_keys con JOIN a tenants per ottenere bq_dataset_id e db_name
    const result = await masterPool.query(
      `SELECT 
        tak.tenant_id,
        t.db_name,
        t.bq_dataset_id,
        t.display_name
       FROM tenant_api_keys tak
       INNER JOIN tenants t ON tak.tenant_id = t.id
       WHERE tak.api_key = $1
       LIMIT 1`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or inactive API key' };
    }

    const tenant = result.rows[0];
    
    // Verifica che bq_dataset_id sia presente
    if (!tenant.bq_dataset_id) {
      return { 
        valid: false, 
        error: 'Tenant BigQuery dataset not configured' 
      };
    }

    return {
      valid: true,
      tenant: {
        tenant_id: tenant.tenant_id,
        db_name: tenant.db_name,
        bq_dataset_id: tenant.bq_dataset_id,
        display_name: tenant.display_name
      }
    };
  } catch (error: any) {
    console.error('Error validating API key:', error);
    return { 
      valid: false, 
      error: error.message || 'Error validating API key' 
    };
  }
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
 * Mantiene account_id come STRING (non converte a numero)
 * Normalizza timestamps
 */
function prepareForBigQuery<T extends { account_id: string }>(
  items: T[],
  accountIdField: 'account_id' = 'account_id'
): Array<Record<string, any>> {
  return items.map(item => {
    const converted: Record<string, any> = { ...item };
    
    // Mantieni account_id come STRING (BigQuery lo gestisce come STRING)
    if (converted[accountIdField] !== undefined && converted[accountIdField] !== null) {
      const accountId = converted[accountIdField];
      // Normalizza a stringa, ma mantieni come stringa (non convertire a numero)
      if (typeof accountId === 'string') {
        converted[accountIdField] = accountId.trim();
      } else if (typeof accountId === 'number') {
        // Se è un numero, convertilo a stringa per mantenere consistenza
        converted[accountIdField] = String(accountId);
      } else {
        // Converti qualsiasi altro tipo a stringa
        converted[accountIdField] = String(accountId);
      }
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
  datasetId: string,
  tenantDbPool: any
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
    
    const result = await calculateRiskForSpecificAccounts(accountIds, datasetId, 'ingest', tenantDbPool);
    
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

  // Autenticazione API Key e recupero tenant metadata dal database MASTER
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  const keyValidation = await validateAPIKeyAndGetClient(apiKey);
  
  if (!keyValidation.valid || !keyValidation.tenant) {
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

  const tenant = keyValidation.tenant;
  const datasetId = tenant.bq_dataset_id;

  // Verifica che il dataset sia configurato (non deve essere vuoto)
  if (!datasetId || datasetId.trim() === '') {
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

  // Ottieni il pool del database del tenant per il logging
  let tenantDbPool;
  try {
    tenantDbPool = getTenantPool(tenant.db_name);
  } catch (poolError: any) {
    console.error('Error getting tenant database pool:', poolError);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: 'Database error',
        message: 'Failed to connect to tenant database'
      })
    };
  }

  // IP Whitelisting
  const allowedIPs = process.env.ALLOWED_CLIENT_IPS || '';
  if (!isIPAllowed(clientIP, allowedIPs)) {
    await logAudit(tenantDbPool, {
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

    await logAudit(tenantDbPool, {
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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('BigQuery insertion error:', error);

    await logAudit(tenantDbPool, {
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
  // Trigger anche se ci sono errori parziali, purché almeno alcuni dati siano stati inseriti
  const shouldTrigger = movementsInserted > 0 || profilesInserted > 0 || sessionsInserted > 0;
  let riskCalculationResult: { triggered: boolean; status?: string; error?: string; success?: number; errors?: number } | null = null;

  if (shouldTrigger) {
    console.log(`[ingestTransactions] Triggering automatic risk calculation for ${uniqueAccountIds.length} account IDs (inserted: ${movementsInserted} movements, ${profilesInserted} profiles, ${sessionsInserted} sessions)`);
    // Calcola immediatamente il rischio per gli account_id che hanno ricevuto nuovi dati
    // Usa il dataset_id del tenant per query corrette
    riskCalculationResult = await calculateRiskForIngestedAccounts(uniqueAccountIds, datasetId, tenantDbPool);
    console.log(`[ingestTransactions] Risk calculation completed: triggered=${riskCalculationResult.triggered}, status=${riskCalculationResult.status}, success=${riskCalculationResult.success}, errors=${riskCalculationResult.errors}`);
  } else {
    console.log(`[ingestTransactions] Skipping risk calculation: no data inserted (movements: ${movementsInserted}, profiles: ${profilesInserted}, sessions: ${sessionsInserted})`);
  }

  // Log audit successo (include info su duplicati se presenti)
  await logAudit(tenantDbPool, {
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
