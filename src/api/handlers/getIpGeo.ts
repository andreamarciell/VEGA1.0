import type { ApiHandler } from '../types';

const IP_REGEX = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/;
const isPrivateIp = (ip: string) =>
  /^(10\.|127\.|192\.168\.|0\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

export interface IpGeoResult {
  ip: string;
  paese: string;
  isp: string;
}

const BATCH_SIZE = 100;

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  if (!event.auth) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Unauthorized',
        message: 'Tenant authentication required',
      }),
    };
  }

  let body: { ips?: string[] };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const ips = body.ips;
  if (!Array.isArray(ips) || ips.length === 0) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Body must contain a non-empty array "ips"' }),
    };
  }

  const token = process.env.IPINFO_TOKEN;
  if (!token || token.trim() === '') {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'ip_lookup_unavailable',
        message: 'Servizio di geolocalizzazione IP non configurato (IPINFO_TOKEN mancante)',
      }),
    };
  }

  const results: IpGeoResult[] = [];
  const toLookup: string[] = [];
  const toLookupIndex: number[] = [];

  for (let i = 0; i < ips.length; i++) {
    const ip = String(ips[i]).trim();
    if (!IP_REGEX.test(ip)) {
      results[i] = { ip: ip || '?', paese: 'non valido', isp: '-' };
      continue;
    }
    if (isPrivateIp(ip)) {
      results[i] = { ip, paese: 'privato', isp: '-' };
      continue;
    }
    toLookup.push(ip);
    toLookupIndex.push(i);
  }

  if (toLookup.length > 0) {
    try {
      const batchResults = new Map<string, IpGeoResult>();

      for (let start = 0; start < toLookup.length; start += BATCH_SIZE) {
        const chunk = toLookup.slice(start, start + BATCH_SIZE);
        const url = `https://ipinfo.io/batch?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('[getIpGeo] ipinfo.io batch error:', res.status, errText);
          throw new Error(`IPinfo API error: ${res.status}`);
        }

        const data = (await res.json()) as Record<string, unknown>;
        for (const ip of chunk) {
          const raw = data[ip];
          if (raw == null || typeof raw !== 'object') {
            batchResults.set(ip, { ip, paese: '?', isp: '-' });
            continue;
          }
          const obj = raw as Record<string, unknown>;
          const geo = obj.geo as Record<string, unknown> | undefined;
          const asObj = obj.as as Record<string, unknown> | undefined;
          const paese =
            (geo?.country as string) ?? (obj.country as string) ?? '?';
          const isp =
            (asObj?.name as string) ?? (obj.org as string) ?? (obj.as_name as string) ?? '-';
          batchResults.set(ip, { ip, paese, isp });
        }
      }

      for (let j = 0; j < toLookup.length; j++) {
        const idx = toLookupIndex[j];
        const geo = batchResults.get(toLookup[j]) ?? {
          ip: toLookup[j],
          paese: '?',
          isp: '-',
        };
        results[idx] = geo;
      }
    } catch (err) {
      console.error('[getIpGeo] batch fetch failed:', err);
      return {
        statusCode: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          error: 'ip_lookup_failed',
          message:
            err instanceof Error ? err.message : 'Servizio di geolocalizzazione IP non disponibile',
        }),
      };
    }
  }

  const ordered: IpGeoResult[] = [];
  for (let i = 0; i < ips.length; i++) {
    ordered.push(results[i] ?? { ip: String(ips[i]), paese: '?', isp: '-' });
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(ordered),
  };
};
