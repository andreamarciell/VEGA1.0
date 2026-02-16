import type { ApiHandler } from '../types';

interface RiskConfigRow {
  config_key: string;
  config_value: any; // JSONB
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

    // Recupera la configurazione dal database tenant
    const result = await event.dbPool.query<RiskConfigRow>(
      `SELECT config_key, config_value
       FROM risk_engine_config
       WHERE is_active = true`
    );

    // Costruisci l'oggetto di configurazione
    const config: any = {};
    result.rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });

    // Costruisci la risposta nel formato atteso
    const response = {
      volumeThresholds: config.volume_thresholds || {
        daily: 5000,
        weekly: 10000,
        monthly: 15000
      },
      riskMotivations: config.risk_motivations || {
        frazionate: {
          name: "Rilevato structuring tramite operazioni frazionate.",
          weight: "major",
          enabled: true
        },
        bonus_concentration: {
          name: "Rilevata concentrazione di bonus.",
          weight: "major",
          threshold_percentage: 10,
          enabled: true
        },
        casino_live: {
          name: "Rilevata attività significativa su casino live.",
          weight: "minor",
          threshold_percentage: 40,
          enabled: true
        },
        volumes_daily: {
          name: "Rilevati volumi significativamente elevati su base giornaliera",
          weight: "base",
          enabled: true
        },
        volumes_weekly: {
          name: "Rilevati volumi significativamente elevati su base settimanale",
          weight: "base",
          enabled: true
        },
        volumes_monthly: {
          name: "Rilevati volumi significativamente elevati su base mensile",
          weight: "base",
          enabled: true
        }
      },
      riskLevels: config.risk_levels || {
        base_levels: {
          monthly_exceeded: "High",
          weekly_or_daily_exceeded: "Medium",
          default: "Low"
        },
        escalation_rules: {
          Low: {
            major_aggravants: "High",
            minor_aggravants: "Medium"
          },
          Medium: {
            major_aggravants: "High"
          },
          High: {
            any_aggravants: "Elevato"
          }
        },
        score_mapping: {
          Elevato: 100,
          High: 80,
          Medium: 50,
          Low: 20
        }
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, config: response })
    };
  } catch (error) {
    console.error('Error getting risk config:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to get risk config',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
