import type { ApiHandler } from '../types';

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
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

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  if (!event.auth?.orgId || !event.dbPool) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Unauthorized', message: 'Tenant authentication required' }),
    };
  }

  try {
    const result = await event.dbPool.query<{ created_by: string }>(
      `SELECT DISTINCT created_by FROM player_activity_log WHERE created_by IS NOT NULL AND created_by != '' ORDER BY created_by`
    );
    const usernames = result.rows.map((r) => r.created_by);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, usernames }),
    };
  } catch (error) {
    console.error('Error in adminGetTenantAuditUsernames:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Failed to get usernames',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
