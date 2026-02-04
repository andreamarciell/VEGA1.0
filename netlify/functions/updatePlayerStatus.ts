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
      const { error } = await supabase
        .from('player_risk_scores')
        .update({ status })
        .eq('account_id', account_id);

      if (error) throw error;
    } else {
      // Crea un nuovo record con status (con valori di default per risk)
      const { error } = await supabase
        .from('player_risk_scores')
        .insert({
          account_id,
          risk_score: 0,
          risk_level: 'Low',
          status
        });

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
