/**
 * Generic API types for Cloud Run/Express deployment
 * Replaces @netlify/functions types
 */

export interface ApiEvent {
  httpMethod: string;
  path: string;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  headers: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext?: {
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
  };
  rawUrl?: string;
}

export interface ApiResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string | object;
}

export type ApiHandler = (event: ApiEvent) => Promise<ApiResponse>;
