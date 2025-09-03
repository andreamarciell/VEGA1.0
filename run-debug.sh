#!/bin/bash

# Script per eseguire i debug script con le variabili d'ambiente caricate

# Carica le variabili d'ambiente
if [ -f .env.local ]; then
    echo "🔧 Loading environment variables from .env.local..."
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "❌ .env.local file not found!"
    exit 1
fi

# Verifica che le variabili principali siano caricate
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Required environment variables not loaded!"
    echo "   VITE_SUPABASE_URL: $VITE_SUPABASE_URL"
    echo "   VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:0:20}..."
    exit 1
fi

echo "✅ Environment variables loaded successfully!"
echo "   VITE_SUPABASE_URL: $VITE_SUPABASE_URL"
echo "   VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:0:20}..."

# Controlla se SUPABASE_SERVICE_ROLE_KEY è configurata
if [ "$SUPABASE_SERVICE_ROLE_KEY" = "your_service_role_key_here" ]; then
    echo "⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not configured!"
    echo "   You need to set this to run the debug scripts."
    echo "   Get it from your Supabase dashboard > Settings > API"
    exit 1
fi

echo "   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

# Menu per scegliere quale script eseguire
echo "🔍 Choose a debug script to run:"
echo "1. Debug profiles table"
echo "2. Create missing profiles"
echo "3. Test login directly"
echo "4. Test Edge Function"
echo "5. Run all scripts in sequence"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🚀 Running debug-profiles.js..."
        node debug-profiles.js
        ;;
    2)
        echo "🚀 Running create-missing-profiles.js..."
        node create-missing-profiles.js
        ;;
    3)
        read -p "Enter username to test: " username
        read -s -p "Enter password to test: " password
        echo ""
        echo "🚀 Running test-login-direct.js with username: $username..."
        node test-login-direct.js "$username" "$password"
        ;;
    4)
        read -p "Enter username to test: " username
        read -s -p "Enter password to test: " password
        echo ""
        echo "🚀 Running check-edge-function.js with username: $username..."
        node check-edge-function.js "$username" "$password"
        ;;
    5)
        echo "🚀 Running all scripts in sequence..."
        echo ""
        echo "=== STEP 1: Debug profiles table ==="
        node debug-profiles.js
        echo ""
        echo "=== STEP 2: Create missing profiles ==="
        node create-missing-profiles.js
        echo ""
        echo "=== STEP 3: Test login directly ==="
        read -p "Enter username to test: " username
        read -s -p "Enter password to test: " password
        echo ""
        node test-login-direct.js "$username" "$password"
        echo ""
        echo "=== STEP 4: Test Edge Function ==="
        node check-edge-function.js "$username" "$password"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac
