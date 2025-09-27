export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGIN') || '').split(',').map(s => s.trim()).filter(Boolean);

  const allow = allowed.length === 0 ? '' : (allowed.includes(origin) ? origin : '');
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}
