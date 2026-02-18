import { BigQuery } from '@google-cloud/bigquery';

/**
 * BigQuery client singleton
 */
let bigqueryClient: BigQuery | null = null;

/**
 * Get or create BigQuery client instance
 */
function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    // BigQuery client uses Application Default Credentials (ADC)
    // In Cloud Run, this is automatically configured
    // For local development, use: gcloud auth application-default login
    bigqueryClient = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'EU',
    });
  }
  return bigqueryClient;
}

/**
 * Create a BigQuery dataset for a tenant
 * @param datasetId - The dataset ID to create (e.g., 'vega_tenant_tenant1')
 * @returns Promise<void>
 */
export async function createTenantDataset(datasetId: string): Promise<void> {
  const bigquery = getBigQueryClient();
  
  console.log(`📊 Creating BigQuery dataset: ${datasetId}...`);
  
  try {
    // Check if dataset already exists
    const [datasets] = await bigquery.getDatasets();
    const existingDataset = datasets.find(ds => ds.id === datasetId);
    
    if (existingDataset) {
      console.log(`⚠️ Dataset ${datasetId} already exists, skipping creation`);
      return;
    }
    
    // Create dataset with EU location
    const [dataset] = await bigquery.createDataset(datasetId, {
      location: 'EU',
      description: `BigQuery dataset for tenant ${datasetId}`,
    });
    
    console.log(`✅ BigQuery dataset ${datasetId} created successfully`);
  } catch (error: any) {
    console.error(`❌ Error creating BigQuery dataset ${datasetId}:`, {
      message: error.message,
      code: error.code,
      details: error.errors,
    });
    throw new Error(`Failed to create BigQuery dataset: ${error.message}`);
  }
}

/**
 * Create all required tables in a tenant's BigQuery dataset
 * @param datasetId - The dataset ID where tables should be created
 * @returns Promise<void>
 */
export async function createTenantTables(datasetId: string): Promise<void> {
  const bigquery = getBigQueryClient();
  
  console.log(`📋 Creating tables in BigQuery dataset: ${datasetId}...`);
  
  const tableDefinitions = [
    {
      tableId: 'Profiles',
      schema: [
        { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'nick', type: 'STRING', mode: 'NULLABLE' },
        { name: 'first_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'last_name', type: 'STRING', mode: 'NULLABLE' },
        { name: 'cf', type: 'STRING', mode: 'NULLABLE' },
        { name: 'domain', type: 'STRING', mode: 'NULLABLE' },
        { name: 'point', type: 'STRING', mode: 'NULLABLE' },
        { name: 'current_balance', type: 'FLOAT64', mode: 'NULLABLE' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
      ],
    },
    {
      tableId: 'Movements',
      schema: [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'reason', type: 'STRING', mode: 'NULLABLE' },
        { name: 'amount', type: 'FLOAT64', mode: 'NULLABLE' },
        { name: 'ts_extension', type: 'STRING', mode: 'NULLABLE' },
        { name: 'deposit_domain', type: 'STRING', mode: 'NULLABLE' },
        { name: 'withdrawal_mode', type: 'STRING', mode: 'NULLABLE' },
        { name: 'balance_after', type: 'FLOAT64', mode: 'NULLABLE' },
      ],
    },
    {
      tableId: 'Sessions',
      schema: [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'ip_address', type: 'STRING', mode: 'NULLABLE' },
        { name: 'login_time', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'logout_time', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'platform', type: 'STRING', mode: 'NULLABLE' },
      ],
    },
    {
      tableId: 'player_risk_scores_history',
      schema: [
        { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'risk_score', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'risk_level', type: 'STRING', mode: 'NULLABLE' },
        { name: 'status', type: 'STRING', mode: 'NULLABLE' },
        { name: 'calculated_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'trigger_reason', type: 'STRING', mode: 'NULLABLE' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
      ],
    },
  ];
  
  try {
    const dataset = bigquery.dataset(datasetId);
    
    // Create each table
    for (const tableDef of tableDefinitions) {
      console.log(`📋 Creating table ${tableDef.tableId}...`);
      
      // Check if table already exists
      const [tables] = await dataset.getTables();
      const existingTable = tables.find(t => t.id === tableDef.tableId);
      
      if (existingTable) {
        console.log(`⚠️ Table ${tableDef.tableId} already exists, skipping creation`);
        continue;
      }
      
      // Create table with schema
      await dataset.createTable(tableDef.tableId, {
        schema: tableDef.schema,
        description: `Table ${tableDef.tableId} for tenant ${datasetId}`,
      });
      
      console.log(`✅ Table ${tableDef.tableId} created successfully`);
    }
    
    console.log(`✅ All tables created in dataset ${datasetId}`);
  } catch (error: any) {
    console.error(`❌ Error creating tables in dataset ${datasetId}:`, {
      message: error.message,
      code: error.code,
      details: error.errors,
    });
    throw new Error(`Failed to create BigQuery tables: ${error.message}`);
  }
}

/**
 * Escapa un valore per BigQuery (prevenzione SQL Injection)
 */
function escapeBigQueryValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `TIMESTAMP('${value.toISOString()}')`;
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Esegue una query parametrizzata su BigQuery (per batch risk update e lettura Movements).
 */
export async function queryBigQuery<T = any>(
  query: string,
  params: Record<string, any> = {},
  datasetId?: string
): Promise<T[]> {
  const client = getBigQueryClient();
  if (!datasetId || datasetId.trim() === '') {
    throw new Error('datasetId is required for BigQuery queries.');
  }
  const targetDatasetId = datasetId.trim();
  let finalQuery = query.replace(/@dataset_id\b/g, `\`${targetDatasetId}\``);
  if (Object.keys(params).length > 0) {
    for (const [name, value] of Object.entries(params)) {
      finalQuery = finalQuery.replace(
        new RegExp(`@${name}\\b`, 'g'),
        escapeBigQueryValue(value)
      );
    }
  }
  const queryOptions: any = {
    location: process.env.GOOGLE_BIGQUERY_LOCATION || 'EU',
    query: finalQuery,
  };
  try {
    const [rows] = await client.query(queryOptions);
    const normalizedRows = (rows as any[]).map((row: any) => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'object' && 'value' in value && (value as any).constructor?.name === 'BigQueryTimestamp') {
          normalized[key] = (value as any).value;
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    });
    return normalizedRows as T[];
  } catch (error) {
    console.error('BigQuery query error:', error);
    throw new Error(`BigQuery query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converte un valore BigQuery TIMESTAMP in Date JavaScript.
 */
export function parseBigQueryDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date() : value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const dateValue = (value as any).value;
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}
