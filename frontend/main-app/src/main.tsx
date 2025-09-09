import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { validateEnvironment } from './lib/env'
import './lib/securityMiddleware' // Initialize security protections

// Initialize environment validation
console.log('🚀 Initializing application...');
const envValidation = validateEnvironment();

if (!envValidation.isValid) {
  console.error('❌ Environment validation failed:', envValidation.errors);
  // Continue anyway with fallback values
}

if (envValidation.warnings.length > 0) {
  console.warn('⚠️ Environment warnings:', envValidation.warnings);
}

console.log('✅ Environment initialized');

createRoot(document.getElementById("root")!).render(<App />);
