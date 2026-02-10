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
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.error('CLERK_SECRET_KEY not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const masterAdminClerkId = process.env.MASTER_ADMIN_CLERK_ID;
    if (!masterAdminClerkId) {
      console.error('MASTER_ADMIN_CLERK_ID not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    let userId: string;

    try {
      // Verify the token and extract claims
      const session = await clerkVerifyToken(token, {
        secretKey: clerkSecretKey,
      });

      userId = session.sub; // Clerk user ID

      // Check if user is the master admin
      if (userId !== masterAdminClerkId) {
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

      next();
    } catch (error) {
      console.error('Clerk token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    console.error('Error in masterAdminAuthMiddleware:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
