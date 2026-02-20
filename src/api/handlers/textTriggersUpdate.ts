import type { ApiHandler } from '../types';

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'PATCH,PUT,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'PUT') {
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

  const id = event.pathParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Missing trigger id' }),
    };
  }

  let body: { trigger_text?: string; replacement_text?: string };
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

  const triggerText = typeof body.trigger_text === 'string' ? body.trigger_text.trim() : undefined;
  const replacementText = typeof body.replacement_text === 'string' ? body.replacement_text : undefined;

  if (!triggerText && replacementText === undefined) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Provide at least trigger_text or replacement_text' }),
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  try {
    if (triggerText !== undefined && replacementText !== undefined) {
      const result = await pool.query(
        `UPDATE text_triggers SET trigger_text = $1, replacement_text = $2 WHERE id = $3 RETURNING id, trigger_text, replacement_text, created_by, created_at`,
        [triggerText, replacementText, id]
      );
      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed,
            'Access-Control-Allow-Credentials': 'true',
          },
          body: JSON.stringify({ error: 'Trigger not found' }),
        };
      }
      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          id: row.id,
          trigger_text: row.trigger_text,
          replacement_text: row.replacement_text,
          created_by: row.created_by,
          created_at: row.created_at.toISOString(),
        }),
      };
    }
    if (replacementText !== undefined) {
      const result = await pool.query(
        `UPDATE text_triggers SET replacement_text = $1 WHERE id = $2 RETURNING id, trigger_text, replacement_text, created_by, created_at`,
        [replacementText, id]
      );
      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed,
            'Access-Control-Allow-Credentials': 'true',
          },
          body: JSON.stringify({ error: 'Trigger not found' }),
        };
      }
      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          id: row.id,
          trigger_text: row.trigger_text,
          replacement_text: row.replacement_text,
          created_by: row.created_by,
          created_at: row.created_at.toISOString(),
        }),
      };
    }
    const result = await pool.query(
      `UPDATE text_triggers SET trigger_text = $1 WHERE id = $2 RETURNING id, trigger_text, replacement_text, created_by, created_at`,
      [triggerText, id]
    );
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Trigger not found' }),
      };
    }
    const row = result.rows[0];
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        id: row.id,
        trigger_text: row.trigger_text,
        replacement_text: row.replacement_text,
        created_by: row.created_by,
        created_at: row.created_at.toISOString(),
      }),
    };
  } catch (err: unknown) {
    console.error('Error updating text trigger:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ error: 'Un trigger con questo testo esiste già' }),
      };
    }
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
