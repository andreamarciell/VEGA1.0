import type { ApiHandler } from '../types';

/**
 * Admin logout handler - DISABLED after Supabase migration
 * The admin panel (/control) has been disabled. This endpoint returns 501 Not Implemented.
 */
export const handler: ApiHandler = async () => {
  return {
    statusCode: 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({
      error: 'Not Implemented',
      message: 'Admin logout has been disabled after Supabase migration. The /control panel is no longer available.'
    })
  };
};

