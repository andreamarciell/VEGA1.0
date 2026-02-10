import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken as clerkVerifyToken } from '@clerk/backend';
import { getMasterPool, getTenantPool } from '../lib/db.js';
import { Pool } from 'pg';

// Initialize Clerk client
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey) {
  console.warn('CLERK_SECRET_KEY not configured - Clerk authentication will fail');
}
const clerkClient = createClerkClient({ secretKey: clerkSecretKey || '' });

/**
 * Extended Express Request with tenant context
 */
export interface TenantRequest extends Request {
  dbPool?: Pool;
  auth?: {
    userId: string;
    orgId: string;
    dbName: string;
  };
}

/**
 * Tenant information from master database
 */
interface TenantInfo {
  id: string;
  clerk_org_id: string;
  db_name: string;
  display_name: string;
  created_at: Date;
}

/**
 * Middleware to authenticate Clerk token and resolve tenant database
 * Extracts orgId from Clerk JWT, queries vega_master for db_name mapping,
 * and injects tenant pool into request
 */
export async function tenantAuthMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    // Verify Clerk token
    if (!clerkSecretKey) {
      console.error('CLERK_SECRET_KEY not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    let userId: string;
    let orgId: string | null = null;

    try {
      // Verify the token and extract claims
      const session = await clerkVerifyToken(token, { secretKey: clerkSecretKey });

      userId = session.sub; // Clerk user ID

      // Extract org_id from token claims
      // Clerk includes org_id in the token when user is part of an organization
      orgId = (session.org_id as string) || null;

      if (!orgId) {
        res.status(403).json({ 
          error: 'User is not associated with an organization',
          message: 'Organization membership required'
        });
        return;
      }
    } catch (error) {
      console.error('Clerk token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Query master database for tenant mapping
    const masterPool = getMasterPool();
    const result = await masterPool.query<TenantInfo>(
      'SELECT id, clerk_org_id, db_name, display_name, created_at FROM tenants WHERE clerk_org_id = $1 LIMIT 1',
      [orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ 
        error: 'Tenant not found',
        message: `No tenant mapping found for organization ${orgId}`
      });
      return;
    }

    const tenant = result.rows[0];
    const dbName = tenant.db_name;

    // Get tenant database pool
    const tenantPool = getTenantPool(dbName);

    // Inject pool and auth context into request
    req.dbPool = tenantPool;
    req.auth = {
      userId,
      orgId,
      dbName,
    };

    next();
  } catch (error) {
    console.error('Error in tenantAuthMiddleware:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Optional middleware for routes that don't require tenant context
 * but still need Clerk authentication
 */
export async function clerkAuthOnlyMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    if (!clerkSecretKey) {
      console.error('CLERK_SECRET_KEY not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    try {
      // Verify the token and extract claims
      const session = await clerkVerifyToken(token, { secretKey: clerkSecretKey });

      req.auth = {
        userId: session.sub,
        orgId: (session.org_id as string) || '',
        dbName: '', // Not needed for auth-only routes
      };

      next();
    } catch (error) {
      console.error('Clerk token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Error in clerkAuthOnlyMiddleware:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
