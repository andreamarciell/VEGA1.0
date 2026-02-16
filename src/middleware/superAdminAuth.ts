import { Request, Response, NextFunction } from 'express';
import { clerkVerifyToken } from '@clerk/backend';

/**
 * Middleware to verify super admin access using Clerk
 * Checks for a valid Clerk session token
 */
export async function superAdminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided. Please ensure you are signed in.'
      });
      return;
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      console.error('CLERK_SECRET_KEY not configured');
      res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Authentication service not configured'
      });
      return;
    }

    try {
      // Verify the Clerk token
      const session = await clerkVerifyToken(token, { secretKey: clerkSecretKey });
      
      // Attach user info to request
      (req as any).auth = {
        userId: session.sub,
        orgId: session.org_id || session.orgId,
      };

      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    console.error('Super admin auth middleware error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication check failed'
    });
  }
}
