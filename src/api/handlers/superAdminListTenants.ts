import type { ApiHandler } from '../types';
import { getMasterPool } from '../../lib/db.js';

interface Tenant {
  id: string;
  clerk_org_id: string;
  db_name: string;
  display_name: string;
  bq_dataset_id: string | null;
  created_at: Date;
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
    
    const result = await masterPool.query<Tenant>(
      `SELECT id, clerk_org_id, db_name, display_name, bq_dataset_id, created_at 
       FROM tenants 
       ORDER BY created_at DESC`
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        tenants: result.rows.map(row => ({
          id: row.id,
          clerk_org_id: row.clerk_org_id,
          db_name: row.db_name,
          display_name: row.display_name,
          bq_dataset_id: row.bq_dataset_id,
          created_at: row.created_at.toISOString()
        }))
      })
    };
  } catch (error: any) {
    console.error('Error listing tenants:', error);
    
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
