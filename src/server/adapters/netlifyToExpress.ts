import { Request, Response } from 'express';

/**
 * Converts Express request to Netlify Function event format
 * This allows existing Netlify Functions to work without modification
 */
export function expressToNetlifyEvent(req: Request): any {
  // Extract query parameters
  const queryStringParameters: Record<string, string> = {};
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      queryStringParameters[key] = String(value);
    }
  }

  // Extract headers (normalize to lowercase keys for Netlify compatibility)
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : String(value);
    }
  }

  // Get client IP
  const clientIP = 
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-client-ip']?.toString() ||
    req.headers['cf-connecting-ip']?.toString() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';

  // Add client IP to headers if not present
  if (!headers['client-ip'] && !headers['x-client-ip']) {
    headers['client-ip'] = clientIP;
  }

  // Build the Netlify event object
  const event = {
    httpMethod: req.method,
    path: req.path,
    pathParameters: req.params || {},
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : null,
    headers,
    body: req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : null,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: req.method,
        path: req.path,
        protocol: req.protocol,
        sourceIp: clientIP,
        userAgent: req.headers['user-agent'] || ''
      }
    },
    rawUrl: req.originalUrl || req.url
  };

  return event;
}

/**
 * Converts Netlify Function response to Express response
 */
export function netlifyToExpressResponse(
  netlifyResponse: any,
  res: Response
): void {
  // Set status code
  const statusCode = netlifyResponse.statusCode || 200;
  res.status(statusCode);

  // Set headers
  if (netlifyResponse.headers) {
    for (const [key, value] of Object.entries(netlifyResponse.headers)) {
      if (value) {
        res.setHeader(key, String(value));
      }
    }
  }

  // Set CORS headers if not already set
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    const origin = res.req.headers.origin;
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin === '*' ? (origin || '*') : allowedOrigin);
  }

  // Send body
  if (netlifyResponse.body) {
    if (typeof netlifyResponse.body === 'string') {
      res.send(netlifyResponse.body);
    } else {
      res.json(netlifyResponse.body);
    }
  } else {
    res.end();
  }
}
