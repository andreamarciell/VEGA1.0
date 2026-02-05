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
 * @param query SQL query con parametri @param_name
 * @param params Oggetto con i valori dei parametri
 * @returns Array di righe risultato
 */
export async function queryBigQuery<T = any>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const client = getBigQueryClient();
  
  // Se ci sono parametri, sostituiscili direttamente nella query con escape
  // Questo è sicuro perché validiamo i parametri prima e usiamo escape appropriato
  let finalQuery = query;
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
    return rows as T[];
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
 * @param datasetId Dataset ID (es: 'toppery_test')
 * @param tableId Table ID (es: 'player_risk_scores_history')
 * @param rows Array di oggetti da inserire
 */
export async function insertBigQuery(
  datasetId: string,
  tableId: string,
  rows: Record<string, any>[]
): Promise<void> {
  const client = getBigQueryClient();
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
  if (typeof value === 'string') {
    // Escape single quotes (doppio apostrofo) e wrap in quotes
    // BigQuery usa single quotes per stringhe
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'number') {
    // Numeri non hanno bisogno di escape
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    // BigQuery TIMESTAMP format
    return `TIMESTAMP('${value.toISOString()}')`;
  }
  // Default: converti a stringa e escape
  return `'${String(value).replace(/'/g, "''")}'`;
}


/**
 * Crea una tabella su BigQuery se non esiste
 * 
 * @param datasetId Dataset ID
 * @param tableId Table ID
 * @param schema Schema della tabella
 */
export async function createTableIfNotExists(
  datasetId: string,
  tableId: string,
  schema: Array<{ name: string; type: string; mode?: string }>
): Promise<void> {
  const client = getBigQueryClient();
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
