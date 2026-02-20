import type { ApiHandler } from '../types';

/**
 * Returns enabled features for the current tenant (from auth injected by tenantAuthMiddleware).
 * Used by the frontend to show/hide feature-specific UI (e.g. Text Wizard).
 */
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

  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const features = event.auth?.features ?? { text_wizard: false };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify({ features }),
  };
};
