import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { expressToApiEvent, apiToExpressResponse } from './adapters/expressAdapter.js';
import { tenantAuthMiddleware } from '../middleware/tenantAuth.js';

// Import API handlers
import { handler as ingestTransactions } from '../api/handlers/ingestTransactions.js';
import { handler as syncFromDatabase } from '../api/handlers/syncFromDatabase.js';
import { handler as calculateRiskScores } from '../api/handlers/calculateRiskScores.js';
import { handler as getPlayersList } from '../api/handlers/getPlayersList.js';
import { handler as uploadPlayerAttachment } from '../api/handlers/uploadPlayerAttachment.js';
import { handler as updatePlayerStatus } from '../api/handlers/updatePlayerStatus.js';
import { handler as addPlayerComment } from '../api/handlers/addPlayerComment.js';
import { handler as getPlayerActivityLog } from '../api/handlers/getPlayerActivityLog.js';
import { handler as getUserAccountId } from '../api/handlers/getUserAccountId.js';
import { handler as getRiskConfig } from '../api/handlers/getRiskConfig.js';
// Admin handlers - kept for backward compatibility but all return 501 Not Implemented
import { handler as adminLogin } from '../api/handlers/adminLogin.js';
import { handler as adminLogout } from '../api/handlers/adminLogout.js';
import { handler as adminSessionCheck } from '../api/handlers/adminSessionCheck.js';
import { handler as adminGetUsers } from '../api/handlers/adminGetUsers.js';
import { handler as createUser } from '../api/handlers/createUser.js';
import { handler as deleteUser } from '../api/handlers/deleteUser.js';
import { handler as adminGetRiskConfig } from '../api/handlers/adminGetRiskConfig.js';
import { handler as adminUpdateRiskConfig } from '../api/handlers/adminUpdateRiskConfig.js';
import { handler as adminAssociateAccountId } from '../api/handlers/adminAssociateAccountId.js';

// Import JS handlers (CommonJS) - will be loaded dynamically

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
  
  // Content Security Policy - adjusted for Clerk
  const csp = [
    "default-src 'self'",
    // Allow Clerk JS from Clerk's CDN (both script-src and script-src-elem)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://enhanced-parakeet-13.clerk.accounts.dev",
    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://enhanced-parakeet-13.clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: https://img.clerk.com",
    "font-src 'self' data:",
    // Allow Clerk connections and telemetry
    "connect-src 'self' https://*.clerk.accounts.dev https://enhanced-parakeet-13.clerk.accounts.dev https://clerk-telemetry.com",
    // Allow Clerk iframes (needed for SignIn component)
    "frame-src 'self' https://*.clerk.accounts.dev",
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


// API Routes - v1
const apiRouter = express.Router();

// Tenant routes (require tenant authentication and DB pool)
// Ingest - uses API Key authentication (no Clerk token required)
apiRouter.post('/ingest', wrapApiHandler(ingestTransactions));
// Sync - uses Clerk token authentication
apiRouter.get('/sync', tenantAuthMiddleware, wrapApiHandler(syncFromDatabase));

// Risk Calculation
apiRouter.post('/risk/calculate', tenantAuthMiddleware, wrapApiHandler(calculateRiskScores));

// Players
apiRouter.get('/players', tenantAuthMiddleware, wrapApiHandler(getPlayersList));
apiRouter.get('/players/my-account-id', tenantAuthMiddleware, wrapApiHandler(getUserAccountId));
apiRouter.get('/players/risk-config', tenantAuthMiddleware, wrapApiHandler(getRiskConfig));
apiRouter.post('/players/:id/attachments', tenantAuthMiddleware, wrapApiHandler(uploadPlayerAttachment));
apiRouter.patch('/players/:id/status', tenantAuthMiddleware, wrapApiHandler(updatePlayerStatus));
apiRouter.post('/players/:id/comments', tenantAuthMiddleware, wrapApiHandler(addPlayerComment));
apiRouter.get('/players/:id/activity', tenantAuthMiddleware, wrapApiHandler(getPlayerActivityLog));

// Admin routes - DISABLED after Supabase migration
// All admin routes return 501 Not Implemented
apiRouter.post('/admin/login', wrapApiHandler(adminLogin));
apiRouter.post('/admin/logout', wrapApiHandler(adminLogout));
apiRouter.get('/admin/session', wrapApiHandler(adminSessionCheck));
apiRouter.get('/admin/users', wrapApiHandler(adminGetUsers));
apiRouter.post('/admin/users', wrapApiHandler(createUser));
apiRouter.delete('/admin/users/:id', wrapApiHandler(deleteUser));
apiRouter.get('/admin/risk/config', wrapApiHandler(adminGetRiskConfig));
apiRouter.put('/admin/risk/config', wrapApiHandler(adminUpdateRiskConfig));
apiRouter.post('/admin/profiles/:userId/account-id', wrapApiHandler(adminAssociateAccountId));
apiRouter.put('/admin/profiles/:userId/account-id', wrapApiHandler(adminAssociateAccountId));
apiRouter.delete('/admin/profiles/:userId/account-id', wrapApiHandler(adminAssociateAccountId));

// AI Services - using dynamic imports for CommonJS modules
apiRouter.post('/ai/summary', async (req: Request, res: Response) => {
  try {
    // Use createRequire for CommonJS modules
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const aiSummaryModule = require('../api/handlers/aiSummary.js');
    const handler = aiSummaryModule.handler || aiSummaryModule.default?.handler;
    if (!handler) {
      throw new Error('Handler not found in aiSummary module');
    }
    const event = expressToApiEvent(req);
    const response = await handler(event);
    apiToExpressResponse(response, res);
  } catch (error) {
    console.error('AI Summary handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

apiRouter.post('/aml/advanced-analysis', async (req: Request, res: Response) => {
  try {
    // Use createRequire for CommonJS modules
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const amlModule = require('../api/handlers/amlAdvancedAnalysis.js');
    const handler = amlModule.handler || amlModule.default?.handler;
    if (!handler) {
      throw new Error('Handler not found in amlAdvancedAnalysis module');
    }
    const event = expressToApiEvent(req);
    const response = await handler(event);
    apiToExpressResponse(response, res);
  } catch (error) {
    console.error('AML Analysis handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Tenant API routes
app.use('/api/v1', apiRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'vega-api'
  });
});

// Serve static files from dist directory (Vite build output)
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req: Request, res: Response) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
    return;
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Serving static files from: ${distPath}`);
  console.log(`🔗 API available at: http://0.0.0.0:${PORT}/api/v1`);
});

export default app;
