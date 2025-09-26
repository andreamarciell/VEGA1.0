#!/bin/bash

# Netlify build script for environment variables
echo "🚀 Starting Netlify build..."

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
    echo "🌐 Production environment detected"
    
    # Set production environment variables if not already set
    if [ -z "$VITE_SUPABASE_URL" ]; then
        export VITE_SUPABASE_URL="https://vobftcreopaqrfoonybp.supabase.co"
        echo "✅ Set VITE_SUPABASE_URL"
    fi
    
    if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
        export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAxNDcsImV4cCI6MjA2ODk2NjE0N30.1n0H8fhQLwKWe9x8sdQYXKX002Bo4VywijxGLxX8jbo"
        echo "✅ Set VITE_SUPABASE_ANON_KEY"
    fi
    
    echo "🔧 Environment variables configured for production"
else
    echo "🔧 Development environment detected"
fi

# Run the build
echo "📦 Running npm build..."
npm run build

# Build the presentation
echo "📦 Building presentation..."
cd presentazione
npm run build
cd ..

echo "✅ Build completed successfully!"
