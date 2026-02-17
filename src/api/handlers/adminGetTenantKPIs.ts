import type { ApiHandler } from '../types';

export interface TenantKPIs {
  totalComments: number;
  statusChanges: number;
  attachmentsCount: number;
}

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
    const pool = event.dbPool;

    const [commentsRes, statusRes, attachmentsRes] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM player_activity_log WHERE activity_type = 'comment'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM player_activity_log WHERE activity_type = 'status_change'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM player_activity_log 
         WHERE activity_type IN ('attachment', 'attachment_upload')`
      ),
    ]);

    const totalComments = parseInt(commentsRes.rows[0]?.count ?? '0', 10);
    const statusChanges = parseInt(statusRes.rows[0]?.count ?? '0', 10);
    const attachmentsCount = parseInt(attachmentsRes.rows[0]?.count ?? '0', 10);

    const body: TenantKPIs = {
      totalComments,
      statusChanges,
      attachmentsCount,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error('Error in adminGetTenantKPIs:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Failed to get tenant KPIs',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
