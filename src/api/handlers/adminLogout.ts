import type { ApiHandler } from '../types';
const COOKIE = 'admin_session';

export const handler: ApiHandler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    },
    body: JSON.stringify({ ok: true })
  };
};

