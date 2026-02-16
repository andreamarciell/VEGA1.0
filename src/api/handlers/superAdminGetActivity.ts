import type { ApiHandler } from '../types';
import { getMasterPool, getTenantPool } from '../../lib/db.js';

interface TenantActivityLog {
  id: string;
  tenant_id: string;
  tenant_name: string;
  activity_type: string;
  content: any;
  created_at: Date;
  metadata?: any;
}

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'GET') {
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

  try {
    const masterPool = getMasterPool();
    const allLogs: TenantActivityLog[] = [];

    // Get all tenants
    const tenantsResult = await masterPool.query(
      'SELECT id, clerk_org_id, db_name, display_name, created_at FROM tenants ORDER BY created_at DESC'
    );

    // Get tenant creation logs (from master database)
    tenantsResult.rows.forEach((tenant: any) => {
      allLogs.push({
        id: `tenant-${tenant.id}`,
        tenant_id: tenant.id,
        tenant_name: tenant.display_name,
        activity_type: 'tenant_created',
        content: `Tenant "${tenant.display_name}" (${tenant.db_name}) was created`,
        created_at: tenant.created_at,
        metadata: {
          db_name: tenant.db_name,
          clerk_org_id: tenant.clerk_org_id
        }
      });
    });

    // Get ingestion logs from each tenant database
    for (const tenant of tenantsResult.rows) {
      try {
        const tenantPool = getTenantPool(tenant.db_name);
        const ingestionLogs = await tenantPool.query(
          `SELECT id, account_id, activity_type, content, metadata, created_at 
           FROM player_activity_log 
           WHERE activity_type = 'api_ingest' 
           ORDER BY created_at DESC 
           LIMIT 50`
        );

        ingestionLogs.rows.forEach((log: any) => {
          const content = typeof log.content === 'string' 
            ? JSON.parse(log.content || '{}') 
            : log.content;

          allLogs.push({
            id: log.id,
            tenant_id: tenant.id,
            tenant_name: tenant.display_name,
            activity_type: log.activity_type,
            content: content.status === 'success' 
              ? `Ingestion successful: ${content.movements_count || 0} movements, ${content.profiles_count || 0} profiles`
              : `Ingestion failed: ${content.error_message || 'Unknown error'}`,
            created_at: log.created_at,
            metadata: log.metadata
          });
        });
      } catch (error) {
        console.error(`Error fetching logs for tenant ${tenant.db_name}:`, error);
        // Continue with other tenants
      }
    }

    // Sort by created_at descending
    allLogs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Limit to last 200 logs
    const limitedLogs = allLogs.slice(0, 200);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        logs: limitedLogs.map(log => ({
          id: log.id,
          tenant_id: log.tenant_id,
          tenant_name: log.tenant_name,
          activity_type: log.activity_type,
          content: log.content,
          created_at: log.created_at.toISOString(),
          metadata: log.metadata
        }))
      })
    };
  } catch (error: any) {
    console.error('Error getting activity logs:', error);
    
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
