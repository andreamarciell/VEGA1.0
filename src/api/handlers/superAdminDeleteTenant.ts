import type { ApiHandler } from '../types';
import { getMasterPool, getMasterClient } from '../../lib/db.js';
import { BigQuery } from '@google-cloud/bigquery';

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const tenantId = event.pathParameters?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Bad request',
        message: 'Tenant ID is required'
      })
    };
  }

  try {
    const masterPool = getMasterPool();
    
    // Get tenant info from master database
    const tenantResult = await masterPool.query(
      'SELECT id, db_name, bq_dataset_id, display_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Not found',
          message: 'Tenant not found'
        })
      };
    }

    const tenant = tenantResult.rows[0];
    const dbName = tenant.db_name;
    const bqDatasetId = tenant.bq_dataset_id;

    console.log(`🗑️ Starting deletion of tenant ${tenantId} (${dbName})...`);

    // Step 1: Drop PostgreSQL database
    console.log(`📊 Step 1: Dropping PostgreSQL database ${dbName}...`);
    try {
      const masterClient = await getMasterClient();
      const escapedDbName = dbName.replace(/"/g, '""');
      await masterClient.query(`DROP DATABASE IF EXISTS "${escapedDbName}"`);
      masterClient.release();
      console.log(`✅ Database ${dbName} dropped successfully`);
    } catch (dbError: any) {
      console.error(`❌ Error dropping database ${dbName}:`, dbError);
      // Continue with other cleanup steps
    }

    // Step 2: Delete BigQuery dataset
    if (bqDatasetId) {
      console.log(`📊 Step 2: Deleting BigQuery dataset ${bqDatasetId}...`);
      try {
        const bigquery = new BigQuery({
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          location: 'EU',
        });
        await bigquery.dataset(bqDatasetId).delete({ force: true });
        console.log(`✅ BigQuery dataset ${bqDatasetId} deleted successfully`);
      } catch (bqError: any) {
        console.error(`❌ Error deleting BigQuery dataset ${bqDatasetId}:`, bqError);
        // Continue with other cleanup steps
      }
    }

    // Step 3: Delete API keys from tenant_api_keys table
    console.log(`🔑 Step 3: Deleting API keys for tenant ${tenantId}...`);
    try {
      await masterPool.query('DELETE FROM tenant_api_keys WHERE tenant_id = $1', [tenantId]);
      console.log(`✅ API keys deleted for tenant ${tenantId}`);
    } catch (apiKeyError: any) {
      console.error(`❌ Error deleting API keys:`, apiKeyError);
      // Continue with tenant deletion
    }

    // Step 4: Delete tenant record from master database
    console.log(`🗄️ Step 4: Deleting tenant record from master database...`);
    await masterPool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    console.log(`✅ Tenant record deleted from master database`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        message: 'Tenant deleted successfully',
        deleted: {
          tenant_id: tenantId,
          db_name: dbName,
          bq_dataset_id: bqDatasetId
        }
      })
    };
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      })
    };
  }
};
