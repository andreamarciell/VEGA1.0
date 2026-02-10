#!/bin/bash
# Deploy script for Master Admin Service (branch master-admin)
# Usage: ./scripts/deploy-master-admin.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-europe-west1}
SERVICE_NAME="vega-master-admin"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required"
  echo "Usage: $0 [PROJECT_ID] [REGION]"
  exit 1
fi

echo "🚀 Deploying Master Admin Service (branch: master-admin)"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Ensure we're on master-admin branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master-admin" ]; then
  echo "⚠️  Warning: Not on master-admin branch (current: ${CURRENT_BRANCH})"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Build and push container
echo "📦 Building container..."
# Retrieve MASTER_ADMIN_CLERK_ID from secrets for VITE_MASTER_ADMIN_ID
MASTER_ADMIN_ID=$(gcloud secrets versions access latest --secret=MASTER_ADMIN_CLERK_ID --project ${PROJECT_ID} 2>/dev/null || echo "")
# Use cloudbuild.yaml to pass Vite environment variables as build args
gcloud builds submit \
  --config cloudbuild.yaml \
  --project ${PROJECT_ID} \
  --substitutions=_IMAGE_NAME=${IMAGE_NAME},_BRANCH=master-admin,_VITE_MASTER_ADMIN_ID=${MASTER_ADMIN_ID}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --no-allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:vega-postgres \
  --set-secrets="DB_PASSWORD=DB_PASSWORD:latest,MASTER_DB_URL=MASTER_DB_URL:latest,DB_USER=DB_USER:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,MASTER_ADMIN_CLERK_ID=MASTER_ADMIN_CLERK_ID:latest" \
  --set-env-vars="NODE_ENV=production,PGSSLMODE=require" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 5 \
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
echo "⚠️  Note: This service requires authentication"
echo "Only users with MASTER_ADMIN_CLERK_ID can access /api/master/* endpoints"
