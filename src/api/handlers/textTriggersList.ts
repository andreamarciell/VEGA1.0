import type { ApiHandler } from '../types';

interface TextTriggerRow {
  id: string;
  trigger_text: string;
  replacement_text: string;
  created_by: string | null;
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
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!event.auth?.features?.text_wizard) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Text Wizard feature is not enabled for this tenant' }),
    };
  }

  const pool = event.dbPool;
  if (!pool) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Database not available' }),
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  try {
    const result = await pool.query<TextTriggerRow>(
      'SELECT id, trigger_text, replacement_text, created_by, created_at FROM text_triggers ORDER BY created_at DESC'
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        triggers: result.rows.map((row) => ({
          id: row.id,
          trigger_text: row.trigger_text,
          replacement_text: row.replacement_text,
          created_by: row.created_by,
          created_at: row.created_at.toISOString(),
        })),
      }),
    };
  } catch (err: unknown) {
    console.error('Error listing text triggers:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      }),
    };
  }
};
