import type { ApiHandler } from '../types';

/**
 * Handler per upload allegati giocatore
 * NOTA: La funzionalità di storage file è stata disabilitata dopo la migrazione da Supabase.
 * Questo endpoint ora salva solo i metadati dell'allegato nel database tenant.
 * Per l'upload effettivo dei file, implementare un sistema di storage alternativo (es: Google Cloud Storage).
 */
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

  // Verifica che il middleware abbia iniettato auth e dbPool
  if (!event.auth || !event.dbPool) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Tenant authentication required'
      })
    };
  }

  try {
    const { account_id, file_name, file_data, file_type } = JSON.parse(event.body || '{}');
    
    if (!account_id || !file_name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id and file_name are required' })
      };
    }

    // La sicurezza è garantita dal fatto che interroghiamo esclusivamente il dataset BigQuery specifico del tenant
    // Non è necessario validare che l'account_id appartenga al tenant perché ogni tenant ha il proprio dataset isolato

    // Salva metadati dell'allegato nel database tenant
    const timestamp = new Date();
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileSize = file_data ? Buffer.from(file_data, 'base64').length : 0;
    
    // Salva metadati nella tabella player_activity_log
    const result = await event.dbPool.query(
      `INSERT INTO player_activity_log (account_id, activity_type, content, metadata, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, account_id, activity_type, content, metadata, created_at`,
      [
        String(account_id).trim(),
        'attachment_upload',
        `File uploaded: ${sanitizedFileName}`,
        JSON.stringify({
          file_name: sanitizedFileName,
          file_type: file_type || 'application/octet-stream',
          file_size: fileSize,
          uploaded_at: timestamp.toISOString(),
          // NOTA: file_data non viene salvato nel database per limiti di dimensione
          // Per l'upload effettivo, implementare Google Cloud Storage o altro sistema
          storage_status: 'metadata_only'
        }),
        event.auth.userId || 'user'
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to save attachment metadata');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Attachment metadata saved. File storage not yet implemented.',
        metadata: {
          id: result.rows[0].id,
          account_id: result.rows[0].account_id,
          file_name: sanitizedFileName,
          file_size: fileSize,
          uploaded_at: result.rows[0].created_at
        },
        note: 'File storage functionality disabled after Supabase migration. Implement Google Cloud Storage for actual file uploads.'
      })
    };
  } catch (error) {
    console.error('Error saving attachment metadata:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to save attachment metadata',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

