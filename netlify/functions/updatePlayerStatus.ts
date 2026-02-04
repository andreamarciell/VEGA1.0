import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';

const handler: Handler = async (event) => {
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
    const { account_id, status } = JSON.parse(event.body || '{}');

    if (!account_id || !status) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id and status are required' })
      };
    }

    if (!['active', 'reviewed', 'escalated', 'archived', 'high-risk', 'critical-risk'].includes(status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Invalid status value' })
      };
    }

    const supabase = createServiceClient();
    
    // Verifica se esiste già un record
    const { data: existing } = await supabase
      .from('player_risk_scores')
      .select('account_id, risk_score, risk_level')
      .eq('account_id', account_id)
      .single();

    if (existing) {
      // Aggiorna il record esistente preservando risk_score e risk_level
      // Se lo status è reviewed/escalated/archived, salva il timestamp dell'azione
      const updateData: any = { status };
      
      // Se stiamo impostando uno status manuale, salva il timestamp
      if (['reviewed', 'escalated', 'archived'].includes(status)) {
        updateData.last_action_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('player_risk_scores')
        .update(updateData)
        .eq('account_id', account_id);

      if (error) throw error;
    } else {
      // Crea un nuovo record con status (con valori di default per risk)
      const insertData: any = {
        account_id,
        risk_score: 0,
        risk_level: 'Low',
        status
      };
      
      // Se lo status è manuale, salva il timestamp
      if (['reviewed', 'escalated', 'archived'].includes(status)) {
        insertData.last_action_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('player_risk_scores')
        .insert(insertData);

      if (error) throw error;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error updating player status:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to update player status',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
