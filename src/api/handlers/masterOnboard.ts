import type { ApiHandler } from '../types';
import { getMasterPool, getMasterClient } from '../../lib/db.js';
import { clerkClient } from '@clerk/backend';

interface OnboardRequest {
  clerk_org_id: string;
  db_name: string;
  display_name: string;
}

/**
 * DDL for tenant database tables
 */
const TENANT_DDL = [
  // risk_engine_config table
  `CREATE TABLE IF NOT EXISTS risk_engine_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  
  // player_risk_scores table
  `CREATE TABLE IF NOT EXISTS player_risk_scores (
    account_id TEXT PRIMARY KEY,
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'Low',
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_action_at TIMESTAMP WITH TIME ZONE
  )`,
  
  // player_activity_log table
  `CREATE TABLE IF NOT EXISTS player_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    content TEXT,
    old_status TEXT,
    new_status TEXT,
    created_by TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  
  // Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_player_activity_log_account_id ON player_activity_log(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_player_activity_log_created_at ON player_activity_log(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_engine_config_key ON risk_engine_config(config_key)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_engine_config_active ON risk_engine_config(is_active) WHERE is_active = true`
];

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
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
    const body = JSON.parse(event.body || '{}') as OnboardRequest;
    const { clerk_org_id, db_name, display_name } = body;

    // Validate input
    if (!clerk_org_id || !db_name || !display_name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Missing required fields',
          message: 'clerk_org_id, db_name, and display_name are required'
        })
      };
    }

    // Validate and sanitize db_name (PostgreSQL identifier rules)
    // Only allow alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(db_name)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Invalid db_name',
          message: 'Database name can only contain alphanumeric characters, underscores, and hyphens'
        })
      };
    }

    // Check if tenant already exists in master database
    const masterPool = getMasterPool();
    const existingTenant = await masterPool.query(
      'SELECT id, clerk_org_id, db_name FROM tenants WHERE clerk_org_id = $1 OR db_name = $2',
      [clerk_org_id, db_name]
    );

    if (existingTenant.rows.length > 0) {
      const existing = existingTenant.rows[0];
      if (existing.clerk_org_id === clerk_org_id && existing.db_name === db_name) {
        // Exact match - tenant already onboarded
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed,
            'Access-Control-Allow-Credentials': 'true'
          },
          body: JSON.stringify({ 
            success: true,
            message: 'Tenant already onboarded',
            tenant: existing
          })
        };
      } else {
        // Conflict - either org_id or db_name already exists
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed,
            'Access-Control-Allow-Credentials': 'true'
          },
          body: JSON.stringify({ 
            error: 'Conflict',
            message: existing.clerk_org_id === clerk_org_id 
              ? 'Organization ID already exists'
              : 'Database name already exists'
          })
        };
      }
    }

    // Get master client for DDL operations (CREATE DATABASE cannot run in transaction)
    const masterClient = await getMasterClient();

    try {
      // Step 1: Create the database
      // Note: CREATE DATABASE cannot be executed in a transaction
      // We need to escape the database name to prevent SQL injection
      const escapedDbName = db_name.replace(/"/g, '""'); // Escape double quotes for PostgreSQL
      await masterClient.query(`CREATE DATABASE "${escapedDbName}"`);

      console.log(`Database ${db_name} created successfully`);

      // Step 2: Connect to the new database and create tables
      // We need to create a new pool for the tenant database
      const tenantPool = getMasterPool(); // Get pool config from master
      const dbUser = process.env.DB_USER || 'postgres';
      const dbPassword = process.env.DB_PASSWORD;
      const masterDbUrl = process.env.MASTER_DB_URL;
      
      if (!dbPassword || !masterDbUrl) {
        throw new Error('DB_PASSWORD or MASTER_DB_URL not configured');
      }

      // Parse master URL to get host/port
      let host: string;
      let port: number;
      try {
        const url = new URL(masterDbUrl);
        host = url.hostname;
        port = parseInt(url.port || '5432', 10);
      } catch {
        // Treat as hostname
        host = masterDbUrl;
        port = parseInt(process.env.PGPORT || '5432', 10);
      }

      // Create tenant pool with new database name
      const { Pool } = await import('pg');
      const tenantDbPool = new Pool({
        host,
        port,
        database: db_name,
        user: dbUser,
        password: dbPassword,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Execute DDL statements
      for (const ddl of TENANT_DDL) {
        await tenantDbPool.query(ddl);
      }

      console.log(`Tables created in database ${db_name}`);

      // Step 3: Insert mapping in vega_master.tenants
      const insertResult = await masterPool.query(
        `INSERT INTO tenants (clerk_org_id, db_name, display_name, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, clerk_org_id, db_name, display_name, created_at`,
        [clerk_org_id, db_name, display_name]
      );

      const tenant = insertResult.rows[0];

      // Step 4: Update Clerk organization metadata
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        throw new Error('CLERK_SECRET_KEY not configured');
      }

      try {
        await clerkClient.organizations.updateOrganizationMetadata(clerk_org_id, {
          publicMetadata: {
            tenant_db_name: db_name,
            onboarded_at: new Date().toISOString(),
          },
          privateMetadata: {
            tenant_id: tenant.id,
          },
        });

        console.log(`Clerk organization metadata updated for ${clerk_org_id}`);
      } catch (clerkError) {
        console.error('Error updating Clerk organization metadata:', clerkError);
        // Don't fail the entire operation if Clerk update fails
        // The database is already created and mapped
      }

      // Clean up tenant pool (it will be cached by getTenantPool if needed later)
      await tenantDbPool.end();

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          success: true,
          message: 'Tenant onboarded successfully',
          tenant: {
            id: tenant.id,
            clerk_org_id: tenant.clerk_org_id,
            db_name: tenant.db_name,
            display_name: tenant.display_name,
            created_at: tenant.created_at
          }
        })
      };
    } catch (dbError: any) {
      console.error('Error during tenant onboarding:', dbError);
      
      // If database was created but something else failed, try to clean up
      try {
        const escapedDbName = db_name.replace(/"/g, '""');
        await masterClient.query(`DROP DATABASE IF EXISTS "${escapedDbName}"`);
        console.log(`Cleaned up database ${db_name} after error`);
      } catch (cleanupError) {
        console.error('Error cleaning up database:', cleanupError);
      }

      throw dbError;
    } finally {
      masterClient.release();
    }
  } catch (error: any) {
    console.error('Error in masterOnboard:', error);
    
    // Handle specific PostgreSQL errors
    if (error.code === '42P04') {
      // Database already exists
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Database already exists',
          message: `Database ${(JSON.parse(event.body || '{}') as OnboardRequest).db_name} already exists`
        })
      };
    }

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
