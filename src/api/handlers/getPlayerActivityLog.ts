import type { ApiHandler } from '../types';

interface ActivityLogRow {
  id: string;
  account_id: string;
  activity_type: string;
  content: string | null;
  old_status: string | null;
  new_status: string | null;
  created_by: string;
  metadata: any | null; // JSONB
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
    if (!event.dbPool) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Database pool not available' })
      };
    }

    // Estrai account_id dai path parameters (/:id) o dai query parameters come fallback
    const account_id = event.pathParameters?.id || event.queryStringParameters?.account_id;
    
    if (!account_id) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id is required' })
      };
    }

    const result = await event.dbPool.query<ActivityLogRow>(
      `SELECT id, account_id, activity_type, content, old_status, new_status, created_by, metadata, created_at
       FROM player_activity_log
       WHERE account_id = $1
       ORDER BY created_at DESC`,
      [account_id]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, activities: result.rows || [] })
    };
  } catch (error) {
    console.error('Error getting activity log:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to get activity log',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

