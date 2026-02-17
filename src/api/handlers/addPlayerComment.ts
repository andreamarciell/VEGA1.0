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

    const { account_id, content, attachments, gcs_paths, username } = JSON.parse(event.body || '{}');
    
    if (!account_id || !content) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id and content are required' })
      };
    }

    // Usa il username passato dal frontend, con fallback a userId se non disponibile
    // Il frontend dovrebbe passare username, firstName, o email come username
    const displayName = username || event.auth?.userId || 'user';

    // Salva gli allegati nel metadata se presenti, includendo anche i gcs_paths per rigenerazione futura
    const metadata = attachments && attachments.length > 0 
      ? { 
          attachments,
          ...(gcs_paths && gcs_paths.length > 0 ? { gcs_paths } : {})
        } 
      : null;

    const result = await event.dbPool.query<ActivityLogRow>(
      `INSERT INTO player_activity_log (account_id, activity_type, content, metadata, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, account_id, activity_type, content, old_status, new_status, created_by, metadata, created_at`,
      [account_id, 'comment', content.trim(), metadata ? JSON.stringify(metadata) : null, displayName]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to insert activity log');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, data: result.rows[0] })
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to add comment',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

