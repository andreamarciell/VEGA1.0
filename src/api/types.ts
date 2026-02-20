/**
 * Generic API types for Cloud Run/Express deployment
 */

import { Pool } from 'pg';

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
  // Tenant context injected by middleware
  dbPool?: Pool;
  auth?: {
    userId: string;
    orgId: string;
    dbName?: string;
    bqDatasetId?: string;
    features?: { text_wizard?: boolean };
  };
}

export interface ApiResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string | object;
}

export type ApiHandler = (event: ApiEvent) => Promise<ApiResponse>;
