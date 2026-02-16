import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { expressToApiEvent, apiToExpressResponse } from './adapters/expressAdapter.js';
import { masterAdminAuthMiddleware } from '../middleware/masterAdminAuth.js';
import { superAdminAuthMiddleware } from '../middleware/superAdminAuth.js';

// Import master admin handler
import { handler as masterOnboard } from '../api/handlers/masterOnboard.js';

// Import super admin handlers
import { handler as superAdminListTenants } from '../api/handlers/superAdminListTenants.js';
import { handler as superAdminGetTenantRiskConfig } from '../api/handlers/superAdminGetTenantRiskConfig.js';
import { handler as superAdminUpdateTenantRiskConfig } from '../api/handlers/superAdminUpdateTenantRiskConfig.js';
import { handler as superAdminGetTenantUsers } from '../api/handlers/superAdminGetTenantUsers.js';
import { handler as superAdminInviteUser } from '../api/handlers/superAdminInviteUser.js';
import { handler as superAdminGetActivity } from '../api/handlers/superAdminGetActivity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-API-Key']
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    // Allow Clerk JS from Clerk's CDN while keeping strong defaults
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Allow Clerk network calls
    "connect-src 'self' https://*.clerk.accounts.dev",
    // Allow Web Workers (needed for Clerk)
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  
  next();
});

// Helper function to wrap API handlers
function wrapApiHandler(handler: any) {
  return async (req: Request, res: Response) => {
    try {
      const event = expressToApiEvent(req);
      const response = await handler(event);
      apiToExpressResponse(response, res);
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

// Master Admin routes (protected by masterAdminAuthMiddleware)
const masterRouter = express.Router();
masterRouter.post('/onboard', masterAdminAuthMiddleware, wrapApiHandler(masterOnboard));
app.use('/api/master', masterRouter);

// Super Admin routes (protected by superAdminAuthMiddleware)
const superAdminRouter = express.Router();
superAdminRouter.get('/tenants', superAdminAuthMiddleware, wrapApiHandler(superAdminListTenants));
superAdminRouter.get('/tenants/:tenantId/risk-config', superAdminAuthMiddleware, wrapApiHandler(superAdminGetTenantRiskConfig));
superAdminRouter.put('/tenants/:tenantId/risk-config', superAdminAuthMiddleware, wrapApiHandler(superAdminUpdateTenantRiskConfig));
superAdminRouter.get('/tenants/:tenantId/users', superAdminAuthMiddleware, wrapApiHandler(superAdminGetTenantUsers));
superAdminRouter.post('/tenants/:tenantId/users/invite', superAdminAuthMiddleware, wrapApiHandler(superAdminInviteUser));
superAdminRouter.get('/activity', superAdminAuthMiddleware, wrapApiHandler(superAdminGetActivity));
app.use('/api/v1/super-admin', superAdminRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'vega-master-admin'
  });
});

// Serve static files from dist directory (Vite build output)
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Catch-all route: For any other request, send index.html so client-side routing works
app.get('*', (req: Request, res: Response) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  
  // Ignore requests for files that should exist but are missing (e.g., images)
  if (req.url.includes('.')) {
    return res.status(404).send('Not found');
  }
  
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// Start server (listen on 0.0.0.0 for Cloud Run)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Master Admin Server running on port ${PORT}`);
  console.log(`📦 Serving static files from: ${distPath}`);
  console.log(`🔗 Master Admin API available at: http://0.0.0.0:${PORT}/api/master`);
});

export default app;
