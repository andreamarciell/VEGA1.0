import type { ApiHandler } from '../types';
import { createServiceClient } from './_supabaseAdmin';
import { getUserTenantCode, validateAccountIdBelongsToTenant } from './_tenantHelper.js';

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

    // Recupera tenant_code dell'utente loggato
    const tenantResult = await getUserTenantCode(event);
    if (tenantResult.error || !tenantResult.tenantCode) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: tenantResult.error || 'User does not have a tenant_code assigned'
        })
      };
    }

    const userTenantCode = tenantResult.tenantCode;

    // Verifica che l'account_id appartenga al tenant_code dell'utente
    const validation = await validateAccountIdBelongsToTenant(account_id, userTenantCode);
    if (!validation.valid) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Forbidden',
          message: validation.error || 'You do not have access to this account_id'
        })
      };
    }

    const supabase = createServiceClient();
    
    // Converti base64 in buffer
    const fileBuffer = Buffer.from(file_data, 'base64');
    
    // Crea un path univoco per il file: player-attachments/{tenant_code}/{account_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `player-attachments/${userTenantCode}/${account_id}/${timestamp}_${sanitizedFileName}`;
    
    // Upload del file al bucket topperylive esistente
    const { data, error } = await supabase.storage
      .from('topperylive')
      .upload(filePath, fileBuffer, {
        contentType: file_type || 'application/octet-stream',
        upsert: false
      });

    if (error) throw error;

    // Ottieni l'URL pubblico del file
    const { data: urlData } = supabase.storage
      .from('topperylive')
      .getPublicUrl(filePath);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        success: true, 
        url: urlData.publicUrl,
        path: filePath
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

