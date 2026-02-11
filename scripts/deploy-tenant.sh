#!/bin/bash
# Deploy script for Tenant Service (branch main)
# Usage: ./scripts/deploy-tenant.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-europe-west1}
SERVICE_NAME="vega-tenant-api"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required"
  echo "Usage: $0 [PROJECT_ID] [REGION]"
  exit 1
fi

echo "🚀 Deploying Tenant Service (branch: main)"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Build and push container
echo "📦 Building container..."

# Leggi VITE_CLERK_PUBLISHABLE_KEY da variabile d'ambiente locale o dal servizio Cloud Run esistente
if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ]; then
  # Prova a leggere dal servizio Cloud Run esistente
  VITE_CLERK_PUBLISHABLE_KEY=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(spec.template.spec.containers[0].env[?(@.name=="VITE_CLERK_PUBLISHABLE_KEY")].value)' 2>/dev/null || echo "")
fi

if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ]; then
  echo "❌ ERRORE: VITE_CLERK_PUBLISHABLE_KEY non trovata!"
  echo "   Imposta la variabile d'ambiente VITE_CLERK_PUBLISHABLE_KEY prima di eseguire lo script,"
  echo "   oppure configurala nel servizio Cloud Run esistente."
  exit 1
fi

# Use cloudbuild.yaml to pass Vite environment variables as build args
gcloud builds submit \
  --config cloudbuild.yaml \
  --project ${PROJECT_ID} \
  --substitutions=_IMAGE_NAME=${IMAGE_NAME},_BRANCH=main,_VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}"

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:vega-postgres \
  --set-secrets="DB_PASSWORD=DB_PASSWORD:latest,MASTER_DB_URL=MASTER_DB_URL:latest,DB_USER=DB_USER:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,CLERK_PUBLISHABLE_KEY=CLERK_PUBLISHABLE_KEY:latest,ALLOWED_ORIGIN=ALLOWED_ORIGIN:latest" \
  --set-env-vars="NODE_ENV=production,PGSSLMODE=require" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Test health check:"
echo "curl ${SERVICE_URL}/health"
