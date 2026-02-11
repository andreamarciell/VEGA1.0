import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
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

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
console.log('🔑 Clerk Publishable Key configured:', !!clerkPublishableKey, clerkPublishableKey ? `${clerkPublishableKey.substring(0, 20)}...` : 'NOT SET');

if (!clerkPublishableKey) {
  console.warn('⚠️ VITE_CLERK_PUBLISHABLE_KEY not configured - Clerk features will be unavailable');
}

createRoot(document.getElementById("root")!).render(
  clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <App />
    </ClerkProvider>
  ) : (
    <App />
  )
);
