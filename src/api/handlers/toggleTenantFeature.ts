import type { ApiHandler } from '../types';
import { getMasterPool, getTenantPool } from '../../lib/db.js';

const TEXT_TRIGGERS_DDL = `
CREATE TABLE IF NOT EXISTS text_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_text TEXT NOT NULL UNIQUE,
  replacement_text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
`;

interface TenantRow {
  id: string;
  db_name: string;
  enabled_features: { text_wizard?: boolean } | null;
}

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'PATCH,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'PATCH') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const tenantId = event.pathParameters?.tenantId ?? event.pathParameters?.id;
  if (!tenantId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Missing tenant id' }),
    };
  }

  let body: { feature?: string; enabled?: boolean };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const feature = body.feature === 'text_wizard' ? 'text_wizard' : null;
  const enabled = Boolean(body.enabled);

  if (!feature) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Supported feature: text_wizard' }),
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  try {
    const masterPool = getMasterPool();

    const current = await masterPool.query<TenantRow>(
      'SELECT id, db_name, enabled_features FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (current.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Tenant not found' }),
      };
    }

    const tenant = current.rows[0];
    const currentFeatures = (tenant.enabled_features && typeof tenant.enabled_features === 'object')
      ? { ...tenant.enabled_features }
      : { text_wizard: false };
    const wasEnabled = Boolean(currentFeatures.text_wizard);

    const newFeatures = { ...currentFeatures, [feature]: enabled };

    await masterPool.query(
      'UPDATE tenants SET enabled_features = $1::jsonb WHERE id = $2',
      [JSON.stringify(newFeatures), tenantId]
    );

    if (feature === 'text_wizard' && enabled && !wasEnabled) {
      const tenantPool = getTenantPool(tenant.db_name);
      await tenantPool.query(TEXT_TRIGGERS_DDL);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: true,
        enabled_features: newFeatures,
      }),
    };
  } catch (error: unknown) {
    console.error('Error toggling tenant feature:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
