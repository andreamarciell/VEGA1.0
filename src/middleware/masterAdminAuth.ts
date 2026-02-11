import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken as clerkVerifyToken } from '@clerk/backend';

// Initialize Clerk client
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey) {
  console.warn('CLERK_SECRET_KEY not configured - Clerk authentication will fail');
}
const clerkClient = createClerkClient({ secretKey: clerkSecretKey || '' });

/**
 * Extended Express Request with master admin context
 */
export interface MasterAdminRequest extends Request {
  auth?: {
    userId: string;
    orgId: string;
    dbName: string;
  };
}

/**
 * Middleware to protect master admin routes
 * Only allows access if the Clerk userId matches MASTER_ADMIN_CLERK_ID
 * 
 * This middleware should be applied to all /api/master/* routes
 */
export async function masterAdminAuthMiddleware(
  req: MasterAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  console.log('🔐 masterAdminAuthMiddleware called:', {
    method: req.method,
    path: req.path,
    hasAuthHeader: !!(req.headers.authorization || req.headers.Authorization)
  });

  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      console.error('❌ Missing authorization header');
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('❌ Invalid authorization header format');
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    // Verify Clerk token
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.error('❌ CLERK_SECRET_KEY not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Try MASTER_ADMIN_CLERK_ID first, fallback to VITE_MASTER_ADMIN_CLERK_ID
    // (VITE_ prefix is for build-time, but we can use it at runtime too)
    const masterAdminClerkId = process.env.MASTER_ADMIN_CLERK_ID || process.env.VITE_MASTER_ADMIN_CLERK_ID;
    if (!masterAdminClerkId) {
      console.error('❌ MASTER_ADMIN_CLERK_ID or VITE_MASTER_ADMIN_CLERK_ID not configured');
      console.error('   Available env vars:', Object.keys(process.env).filter(k => k.includes('MASTER') || k.includes('CLERK')));
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    console.log('🔍 Verifying token...', {
      hasToken: !!token,
      tokenLength: token.length,
      expectedMasterAdminId: masterAdminClerkId
    });

    let userId: string;

    try {
      // Verify the token and extract claims
      const session = await clerkVerifyToken(token, {
        secretKey: clerkSecretKey,
      });

      userId = session.sub; // Clerk user ID
      console.log('✅ Token verified:', { userId, orgId: session.org_id });

      // Check if user is the master admin
      if (userId !== masterAdminClerkId) {
        console.error('❌ User is not master admin:', {
          userId,
          expected: masterAdminClerkId
        });
        res.status(403).json({ 
          error: 'Forbidden',
          message: 'Master admin access required'
        });
        return;
      }

      // Inject auth context
      req.auth = {
        userId,
        orgId: (session.org_id as string) || '',
        dbName: '', // Not applicable for master admin
      };

      console.log('✅ Authentication successful, proceeding to handler');
      next();
    } catch (error) {
      console.error('❌ Clerk token verification failed:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined
      });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    console.error('❌ Error in masterAdminAuthMiddleware:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
