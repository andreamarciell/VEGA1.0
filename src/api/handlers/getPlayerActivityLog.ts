import type { ApiHandler } from '../types';
import { Storage } from '@google-cloud/storage';

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

/**
 * Rigenera Signed URL per un file GCS se presente nel metadata
 */
async function regenerateSignedUrlIfNeeded(metadata: any, orgId: string, accountId: string, dbPool: any): Promise<any> {
  if (!metadata) return metadata;

  // Se ci sono allegati nel metadata (per commenti)
  if (metadata.attachments && Array.isArray(metadata.attachments)) {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      console.warn('GCS_BUCKET_NAME not configured, skipping signed URL regeneration');
      return metadata;
    }

    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const updatedAttachments: string[] = [];

    for (const urlOrPath of metadata.attachments) {
      try {
        let gcsPath: string | null = null;

        // Controlla se nel metadata c'è il gcs_path salvato
        if (metadata.gcs_paths && Array.isArray(metadata.gcs_paths)) {
          // Se abbiamo un array di gcs_paths salvato, usalo
          const idx = metadata.attachments.indexOf(urlOrPath);
          if (idx >= 0 && idx < metadata.gcs_paths.length) {
            gcsPath = metadata.gcs_paths[idx];
          }
        } else if (metadata.gcs_path) {
          // Fallback: se c'è un singolo gcs_path
          gcsPath = metadata.gcs_path;
        } else if (typeof urlOrPath === 'string') {
          // Prova a cercare il gcs_path nei record di attachment_upload recenti
          // Cerca negli ultimi 100 record di attachment_upload per questo account
          try {
            const attachmentResult = await dbPool.query(
              `SELECT metadata FROM player_activity_log
               WHERE account_id = $1 
               AND activity_type = 'attachment_upload'
               AND metadata->>'signed_url' = $2
               ORDER BY created_at DESC
               LIMIT 1`,
              [accountId, urlOrPath]
            );

            if (attachmentResult.rows.length > 0 && attachmentResult.rows[0].metadata?.gcs_path) {
              gcsPath = attachmentResult.rows[0].metadata.gcs_path;
            }
          } catch (dbError) {
            console.error('Error querying attachment records:', dbError);
          }

          // Se ancora non abbiamo il path, prova a estrarre dall'URL
          if (!gcsPath) {
            const urlMatch = urlOrPath.match(/\/o\/([^?]+)/);
            if (urlMatch) {
              gcsPath = decodeURIComponent(urlMatch[1]);
            }
          }
        }

        // Se abbiamo un path GCS, rigenera il Signed URL
        if (gcsPath) {
          const file = bucket.file(gcsPath);
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 giorni
            version: 'v4'
          });
          updatedAttachments.push(signedUrl);
        } else {
          // Se non riusciamo a rigenerare, mantieni l'URL originale
          updatedAttachments.push(urlOrPath);
        }
      } catch (error) {
        console.error('Error regenerating signed URL:', error);
        // In caso di errore, mantieni l'URL originale
        updatedAttachments.push(urlOrPath);
      }
    }

    return {
      ...metadata,
      attachments: updatedAttachments
    };
  }

  // Se è un attachment_upload con gcs_path, rigenera il Signed URL
  if (metadata.gcs_path && typeof metadata.gcs_path === 'string') {
    try {
      const bucketName = process.env.GCS_BUCKET_NAME;
      if (!bucketName) {
        return metadata;
      }

      const storage = new Storage();
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(metadata.gcs_path);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 giorni
        version: 'v4'
      });

      return {
        ...metadata,
        signed_url: signedUrl
      };
    } catch (error) {
      console.error('Error regenerating signed URL for attachment:', error);
      return metadata;
    }
  }

  return metadata;
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

    // Rigenera Signed URLs per tutte le attività con allegati
    const orgId = event.auth?.orgId || '';
    const activitiesWithFreshUrls = await Promise.all(
      result.rows.map(async (activity) => {
        if (activity.metadata) {
          const updatedMetadata = await regenerateSignedUrlIfNeeded(activity.metadata, orgId, account_id, event.dbPool);
          return {
            ...activity,
            metadata: updatedMetadata
          };
        }
        return activity;
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, activities: activitiesWithFreshUrls || [] })
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

