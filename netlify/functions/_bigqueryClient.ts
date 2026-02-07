import { BigQuery } from '@google-cloud/bigquery';

let bigqueryClient: BigQuery | null = null;

/**
 * Inizializza e restituisce il client BigQuery singleton
 * Usa autenticazione via service account con variabili d'ambiente
 */
export function getBigQueryClient(): BigQuery {
  if (bigqueryClient) {
    return bigqueryClient;
  }

  const projectId = process.env.GOOGLE_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'BigQuery configuration missing. Required: GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY'
    );
  }

  // La private key può essere in formato PEM o JSON completo
  // Se è JSON completo, parsalo per estrarre la chiave
  let credentials: { client_email: string; private_key: string } | undefined;
  
  try {
    // Prova a parsare come JSON completo (service account key file)
    const keyJson = JSON.parse(privateKey);
    if (keyJson.client_email && keyJson.private_key) {
      credentials = {
        client_email: keyJson.client_email,
        private_key: keyJson.private_key.replace(/\\n/g, '\n')
      };
    }
  } catch {
    // Se non è JSON, assume che sia solo la private key PEM
    credentials = {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n')
    };
  }

  bigqueryClient = new BigQuery({
    projectId,
    credentials
  });

  return bigqueryClient;
}

/**
 * Esegue una query parametrizzata su BigQuery
 * Previene SQL Injection usando escape appropriato dei valori
 * 
 * @param query SQL query con parametri @param_name e @dataset_id placeholder
 * @param params Oggetto con i valori dei parametri
 * @param datasetId Dataset ID dinamico (opzionale, usa default se non specificato)
 * @returns Array di righe risultato
 */
export async function queryBigQuery<T = any>(
  query: string,
  params: Record<string, any> = {},
  datasetId?: string
): Promise<T[]> {
  const client = getBigQueryClient();
  
  // Dataset di default per retrocompatibilità
  const defaultDatasetId = process.env.BIGQUERY_DEFAULT_DATASET || 'toppery_test';
  const targetDatasetId = datasetId || defaultDatasetId;
  
  // Se ci sono parametri, sostituiscili direttamente nella query con escape
  // Questo è sicuro perché validiamo i parametri prima e usiamo escape appropriato
  let finalQuery = query;
  
  // Sostituisci @dataset_id placeholder se presente nella query
  finalQuery = finalQuery.replace(/@dataset_id\b/g, `\`${targetDatasetId}\``);
  
  const queryOptions: any = {
    location: process.env.GOOGLE_BIGQUERY_LOCATION || 'EU',
  };

  if (Object.keys(params).length > 0) {
    // Sostituisci @param_name con valori escaped
    for (const [name, value] of Object.entries(params)) {
      const escapedValue = escapeBigQueryValue(value);
      // Usa word boundary per evitare sostituzioni parziali
      finalQuery = finalQuery.replace(
        new RegExp(`@${name}\\b`, 'g'),
        escapedValue
      );
    }
  }

  queryOptions.query = finalQuery;

  try {
    const [rows] = await client.query(queryOptions);
    
    // Normalizza i BigQueryTimestamp objects in stringhe ISO
    // Questo evita di dover gestire BigQueryTimestamp in ogni funzione
    const normalizedRows = rows.map((row: any) => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        // Se è un BigQueryTimestamp object (ha proprietà 'value'), estrai il valore
        if (value && typeof value === 'object' && 'value' in value && value.constructor?.name === 'BigQueryTimestamp') {
          normalized[key] = value.value;
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    });
    
    return normalizedRows as T[];
  } catch (error) {
    console.error('BigQuery query error:', error);
    console.error('Query that failed:', finalQuery);
    throw new Error(
      `BigQuery query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Inserisce dati in una tabella BigQuery
 * 
 * @param datasetId Dataset ID dinamico (es: 'toppery_test' o 'toppery_client_123')
 * @param tableId Table ID (es: 'player_risk_scores_history')
 * @param rows Array di oggetti da inserire
 */
export async function insertBigQuery(
  datasetId: string,
  tableId: string,
  rows: Record<string, any>[]
): Promise<void> {
  const client = getBigQueryClient();
  
  // Valida che datasetId non contenga caratteri pericolosi
  if (!/^[a-zA-Z0-9_-]+$/.test(datasetId)) {
    throw new Error(`Invalid datasetId format: ${datasetId}`);
  }
  
  const dataset = client.dataset(datasetId);
  const table = dataset.table(tableId);

  try {
    // Formatta i dati per BigQuery (converte Date in stringhe ISO)
    const formattedRows = rows.map(row => {
      const formatted: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          formatted[key] = value.toISOString();
        } else {
          formatted[key] = value;
        }
      }
      return formatted;
    });

    await table.insert(formattedRows);
  } catch (error: any) {
    console.error('BigQuery insert error:', error);
    
    // BigQuery può restituire errori parziali, loggali
    if (error.errors && Array.isArray(error.errors)) {
      error.errors.forEach((err: any) => {
        console.error('BigQuery insert partial error:', err);
      });
    }
    
    throw new Error(
      `BigQuery insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Inferisce il tipo di parametro BigQuery dal valore JavaScript
 */
function inferParameterType(value: any): string {
  if (value === null || value === undefined) {
    return 'STRING'; // Default per null
  }
  if (typeof value === 'string') {
    return 'STRING';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INT64' : 'FLOAT64';
  }
  if (value instanceof Date) {
    return 'TIMESTAMP';
  }
  if (typeof value === 'boolean') {
    return 'BOOL';
  }
  return 'STRING';
}

/**
 * Formatta il valore per BigQuery (converte Date in stringa ISO)
 */
function formatValueForBigQuery(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Escapa un valore per BigQuery (prevenzione SQL Injection)
 * Restituisce una stringa SQL-safe che può essere inserita direttamente nella query
 */
function escapeBigQueryValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    // Numeri non hanno bisogno di escape
    return String(value);
  }
  if (typeof value === 'string') {
    // Se la stringa rappresenta un numero intero, trattala come numero
    // Questo è necessario perché account_id è INT64 in BigQuery
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      // È un numero intero valido, restituiscilo senza virgolette
      return trimmed;
    }
    // Altrimenti è una stringa, escape e wrap in quotes
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    // BigQuery TIMESTAMP format
    return `TIMESTAMP('${value.toISOString()}')`;
  }
  // Default: converti a stringa
  const str = String(value);
  const trimmed = str.trim();
  // Se rappresenta un numero intero, restituiscilo senza virgolette
  if (/^-?\d+$/.test(trimmed)) {
    return trimmed;
  }
  // Altrimenti escape come stringa
  return `'${str.replace(/'/g, "''")}'`;
}


/**
 * Converte un valore BigQuery TIMESTAMP in Date JavaScript
 * Gestisce stringhe, Date objects, null, undefined e formati multipli
 * 
 * @param value Valore da BigQuery (può essere stringa, Date, null, undefined)
 * @returns Date object valido (fallback a data corrente se invalido)
 */
export function parseBigQueryDate(value: any): Date {
  if (!value) {
    return new Date(); // Fallback a data corrente
  }
  
  if (value instanceof Date) {
    // Se è già un Date object, verifica che sia valido
    if (isNaN(value.getTime())) {
      console.warn('Invalid Date object from BigQuery:', value);
      return new Date();
    }
    return value;
  }
  
  // Gestisce BigQueryTimestamp objects come fallback (dovrebbe essere già normalizzato)
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const dateValue = value.value;
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string in BigQueryTimestamp:', dateValue);
        return new Date();
      }
      return date;
    }
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        console.warn('Invalid Date in BigQueryTimestamp:', dateValue);
        return new Date();
      }
      return dateValue;
    }
  }
  
  if (typeof value === 'string') {
    // Prova a parsare la stringa (gestisce ISO, BigQuery format, ecc.)
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string from BigQuery:', value);
      return new Date();
    }
    return date;
  }
  
  // Fallback per tipi inaspettati
  console.warn('Unexpected date type from BigQuery:', typeof value, value);
  return new Date();
}

/**
 * Crea una tabella su BigQuery se non esiste
 * 
 * @param datasetId Dataset ID dinamico
 * @param tableId Table ID
 * @param schema Schema della tabella
 */
export async function createTableIfNotExists(
  datasetId: string,
  tableId: string,
  schema: Array<{ name: string; type: string; mode?: string }>
): Promise<void> {
  const client = getBigQueryClient();
  
  // Valida che datasetId non contenga caratteri pericolosi
  if (!/^[a-zA-Z0-9_-]+$/.test(datasetId)) {
    throw new Error(`Invalid datasetId format: ${datasetId}`);
  }
  
  const dataset = client.dataset(datasetId);
  const table = dataset.table(tableId);

  try {
    const [exists] = await table.exists();
    if (exists) {
      console.log(`Table ${datasetId}.${tableId} already exists`);
      return;
    }

    await table.create({
      schema: {
        fields: schema.map(field => ({
          name: field.name,
          type: field.type,
          mode: field.mode || 'NULLABLE'
        }))
      }
    });
    console.log(`Table ${datasetId}.${tableId} created successfully`);
  } catch (error) {
    console.error('Error creating BigQuery table:', error);
    throw new Error(
      `Failed to create table ${datasetId}.${tableId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
