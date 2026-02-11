import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    host: true,
    headers: {
      // Content Security Policy per permettere le chiamate a Clerk
      'Content-Security-Policy': [
        "default-src 'self'",
        // Consenti Clerk JS dalla CDN di Clerk in sviluppo
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        // Permetti connessioni a Clerk
        "connect-src 'self' https://*.clerk.accounts.dev",
        // Permetti Web Workers (necessario per Clerk)
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "upgrade-insecure-requests"
      ].join('; ')
    }
  },
  define: {
    global: 'globalThis',
  },
})
