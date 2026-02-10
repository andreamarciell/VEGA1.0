import { Pool } from 'pg';

/**
 * Extend Express Request type to include tenant context
 * This allows TypeScript to recognize dbPool and auth properties
 */
declare global {
  namespace Express {
    interface Request {
      dbPool?: Pool;
      auth?: {
        userId: string;
        orgId: string;
        dbName: string;
      };
    }
  }
}

export {};
