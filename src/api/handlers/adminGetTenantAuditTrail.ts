import type { ApiHandler } from '../types';

interface AuditRow {
  id: string;
  account_id: string;
  activity_type: string;
  content: string | null;
  old_status: string | null;
  new_status: string | null;
  created_by: string;
  metadata: { signed_url?: string; attachments?: string[]; gcs_path?: string } | null;
  created_at: Date;
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
    const username = event.queryStringParameters?.username?.trim() || null;
    const limit = Math.min(
      Math.max(1, parseInt(event.queryStringParameters?.limit ?? '50', 10)),
      200
    );
    const offset = Math.max(0, parseInt(event.queryStringParameters?.offset ?? '0', 10));

    const pool = event.dbPool;

    let query = `
      SELECT id, account_id, activity_type, content, old_status, new_status, created_by, metadata, created_at
      FROM player_activity_log
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (username) {
      query += ` WHERE created_by = $${paramIndex}`;
      params.push(username);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query<AuditRow>(query, params);

    const activities = result.rows.map((row) => {
      let link: string | null = null;
      if (row.metadata) {
        if (row.metadata.signed_url) {
          link = row.metadata.signed_url;
        } else if (Array.isArray(row.metadata.attachments) && row.metadata.attachments[0]) {
          link = row.metadata.attachments[0];
        }
      }
      return {
        id: row.id,
        date: row.created_at,
        agent: row.created_by,
        actionType: row.activity_type,
        playerId: row.account_id,
        link,
        content: row.content,
        oldStatus: row.old_status,
        newStatus: row.new_status,
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ success: true, activities }),
    };
  } catch (error) {
    console.error('Error in adminGetTenantAuditTrail:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Failed to get audit trail',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
