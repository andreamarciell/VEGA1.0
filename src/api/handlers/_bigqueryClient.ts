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
