import type { ApiHandler } from '../types';
import { Storage } from '@google-cloud/storage';

/**
 * Handler per upload allegati giocatore su Google Cloud Storage
 * Percorso file: ${orgId}/${accountId}/${timestamp}_${fileName}
 * Usa Signed URLs per l'accesso sicuro ai file
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

  // Verifica che orgId sia presente (requisito di sicurezza)
  if (!event.auth.orgId) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Organization ID is required'
      })
    };
  }

  try {
    const { account_id, file_name, file_data, file_type } = JSON.parse(event.body || '{}');
    
    if (!account_id || !file_name || !file_data) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id, file_name, and file_data are required' })
      };
    }

    // Verifica che il bucket GCS sia configurato
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable is not set');
    }

    // Inizializza Google Cloud Storage
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    // Prepara il percorso del file con segregazione per orgId
    const orgId = event.auth.orgId;
    const timestamp = Date.now();
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsFilePath = `${orgId}/${account_id}/${timestamp}_${sanitizedFileName}`;

    // Converti base64 in buffer
    const fileBuffer = Buffer.from(file_data, 'base64');
    const fileSize = fileBuffer.length;

    // Carica il file su GCS
    const file = bucket.file(gcsFilePath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: file_type || 'application/octet-stream',
        metadata: {
          originalFileName: file_name,
          accountId: account_id,
          orgId: orgId,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Genera Signed URL con scadenza 7 giorni
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 giorni in millisecondi
      version: 'v4'
    });

    // Restituisci solo l'URL Signed - il salvataggio nella timeline avverrà quando viene aggiunto il commento
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        success: true,
        url: signedUrl,
        gcs_path: gcsFilePath // Includi anche il gcs_path per permettere rigenerazione futura
      })
    };
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to upload attachment',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

