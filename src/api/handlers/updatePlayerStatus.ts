import type { ApiHandler } from '../types';

interface PlayerRiskScoreRow {
  account_id: string;
  risk_score: number;
  risk_level: string;
  status: string;
}

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'PATCH,POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  // Accetta sia PATCH che POST per retrocompatibilità
  if (event.httpMethod !== 'PATCH' && event.httpMethod !== 'POST') {
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

    const { account_id, status, username } = JSON.parse(event.body || '{}');

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

    // Normalizza account_id a stringa per consistenza
    const accountIdKey = String(account_id).trim();

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

    // Verifica se esiste già un record
    const existingResult = await event.dbPool.query<PlayerRiskScoreRow>(
      'SELECT account_id, risk_score, risk_level, status FROM player_risk_scores WHERE account_id = $1',
      [accountIdKey]
    );

    const existing = existingResult.rows[0];
    const oldStatus = existing?.status || null;

    if (existing) {
      // Aggiorna il record esistente preservando risk_score e risk_level
      // Se lo status è reviewed/escalated/archived, salva il timestamp dell'azione
      const updateFields: string[] = ['status = $2'];
      const updateValues: any[] = [accountIdKey, status];
      let paramIndex = 3;

      // Se stiamo impostando uno status manuale, salva il timestamp
      if (['reviewed', 'escalated', 'archived'].includes(status)) {
        updateFields.push(`last_action_at = $${paramIndex}`);
        updateValues.push(new Date().toISOString());
        paramIndex++;
      }

      await event.dbPool.query(
        `UPDATE player_risk_scores SET ${updateFields.join(', ')} WHERE account_id = $1`,
        updateValues
      );

      // Log del cambio di status se è cambiato
      if (oldStatus !== status) {
        await event.dbPool.query(
          `INSERT INTO player_activity_log (account_id, activity_type, old_status, new_status, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [accountIdKey, 'status_change', oldStatus, status, username || 'user']
        );
      }
    } else {
      // Crea un nuovo record con status (con valori di default per risk)
      const insertFields = ['account_id', 'risk_score', 'risk_level', 'status'];
      const insertValues: any[] = [accountIdKey, 0, 'Low', status];
      const placeholders: string[] = ['$1', '$2', '$3', '$4'];
      let paramIndex = 5;

      // Se lo status è manuale, salva il timestamp
      if (['reviewed', 'escalated', 'archived'].includes(status)) {
        insertFields.push('last_action_at');
        insertValues.push(new Date().toISOString());
        placeholders.push(`$${paramIndex}`);
        paramIndex++;
      }

      await event.dbPool.query(
        `INSERT INTO player_risk_scores (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        insertValues
      );
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

