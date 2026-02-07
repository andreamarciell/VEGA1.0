import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { expressToNetlifyEvent, netlifyToExpressResponse } from './adapters/netlifyToExpress.js';

// Import Netlify Function handlers (using .ts extension since tsx handles it)
import { handler as ingestTransactions } from '../../netlify/functions/ingestTransactions.ts';
import { handler as syncFromDatabase } from '../../netlify/functions/syncFromDatabase.ts';
import { handler as calculateRiskScores } from '../../netlify/functions/calculateRiskScores.ts';
import { handler as getPlayersList } from '../../netlify/functions/getPlayersList.ts';
import { handler as uploadPlayerAttachment } from '../../netlify/functions/uploadPlayerAttachment.ts';
import { handler as updatePlayerStatus } from '../../netlify/functions/updatePlayerStatus.ts';
import { handler as addPlayerComment } from '../../netlify/functions/addPlayerComment.ts';
import { handler as getPlayerActivityLog } from '../../netlify/functions/getPlayerActivityLog.ts';
import { handler as adminLogin } from '../../netlify/functions/adminLogin.ts';
import { handler as adminLogout } from '../../netlify/functions/adminLogout.ts';
import { handler as adminSessionCheck } from '../../netlify/functions/adminSessionCheck.ts';
import { handler as adminGetUsers } from '../../netlify/functions/adminGetUsers.ts';
import { handler as createUser } from '../../netlify/functions/createUser.ts';
import { handler as deleteUser } from '../../netlify/functions/deleteUser.ts';
import { handler as adminGetRiskConfig } from '../../netlify/functions/adminGetRiskConfig.ts';
import { handler as adminUpdateRiskConfig } from '../../netlify/functions/adminUpdateRiskConfig.ts';

// Import JS handlers (CommonJS) - will be loaded dynamically
// import aiSummaryModule from '../../netlify/functions/aiSummary.js';
// import amlAdvancedAnalysisModule from '../../netlify/functions/amlAdvancedAnalysis.js';

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  
  next();
});

// Helper function to wrap Netlify handlers
function wrapNetlifyHandler(handler: any) {
  return async (req: Request, res: Response) => {
    try {
      const event = expressToNetlifyEvent(req);
      const response = await handler(event);
      netlifyToExpressResponse(response, res);
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

// Ingest & Sync
apiRouter.post('/ingest', wrapNetlifyHandler(ingestTransactions));
apiRouter.post('/sync', wrapNetlifyHandler(syncFromDatabase));

// Risk Calculation
apiRouter.post('/risk/calculate', wrapNetlifyHandler(calculateRiskScores));

// Players
apiRouter.get('/players', wrapNetlifyHandler(getPlayersList));
apiRouter.post('/players/:id/attachments', wrapNetlifyHandler(uploadPlayerAttachment));
apiRouter.patch('/players/:id/status', wrapNetlifyHandler(updatePlayerStatus));
apiRouter.post('/players/:id/comments', wrapNetlifyHandler(addPlayerComment));
apiRouter.get('/players/:id/activity', wrapNetlifyHandler(getPlayerActivityLog));

// Admin
apiRouter.post('/admin/login', wrapNetlifyHandler(adminLogin));
apiRouter.post('/admin/logout', wrapNetlifyHandler(adminLogout));
apiRouter.get('/admin/session', wrapNetlifyHandler(adminSessionCheck));
apiRouter.get('/admin/users', wrapNetlifyHandler(adminGetUsers));
apiRouter.post('/admin/users', wrapNetlifyHandler(createUser));
apiRouter.delete('/admin/users/:id', wrapNetlifyHandler(deleteUser));
apiRouter.get('/admin/risk/config', wrapNetlifyHandler(adminGetRiskConfig));
apiRouter.put('/admin/risk/config', wrapNetlifyHandler(adminUpdateRiskConfig));

// AI Services - using dynamic imports for CommonJS modules
apiRouter.post('/ai/summary', async (req: Request, res: Response) => {
  try {
    // Use createRequire for CommonJS modules
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const aiSummaryModule = require('../../netlify/functions/aiSummary.js');
    const handler = aiSummaryModule.handler || aiSummaryModule.default?.handler;
    if (!handler) {
      throw new Error('Handler not found in aiSummary module');
    }
    const event = expressToNetlifyEvent(req);
    const response = await handler(event);
    netlifyToExpressResponse(response, res);
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
    const amlModule = require('../../netlify/functions/amlAdvancedAnalysis.js');
    const handler = amlModule.handler || amlModule.default?.handler;
    if (!handler) {
      throw new Error('Handler not found in amlAdvancedAnalysis module');
    }
    const event = expressToNetlifyEvent(req);
    const response = await handler(event);
    netlifyToExpressResponse(response, res);
  } catch (error) {
    console.error('AML Analysis handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.use('/api/v1', apiRouter);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Serving static files from: ${distPath}`);
  console.log(`🔗 API available at: http://localhost:${PORT}/api/v1`);
});

export default app;
