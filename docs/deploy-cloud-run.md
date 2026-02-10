# Guida Deploy Cloud Run - VEGA Multi-tenant

Questa guida descrive come deployare l'applicazione VEGA su Google Cloud Run con architettura multi-tenant e doppio servizio (clienti e master admin).

## Architettura

L'applicazione è divisa in due servizi Cloud Run:

1. **Servizio Clienti** (branch `main`): API per i tenant, accessibile ai clienti
2. **Servizio Master Admin** (branch `master-admin`): API amministrative per onboarding tenant

Entrambi i servizi condividono:
- Istanza Cloud SQL PostgreSQL (multi-database)
- Secret Manager per credenziali
- Autenticazione Clerk

## Prerequisiti

1. Google Cloud Project configurato
2. Cloud SQL PostgreSQL istanza creata
3. Secret Manager abilitato
4. Cloud Run API abilitata
5. Clerk account e applicazione configurata

## Setup Secret Manager

Crea i seguenti segreti in Secret Manager:

```bash
# Database credentials
echo -n "your-db-password" | gcloud secrets create DB_PASSWORD --data-file=-
echo -n "postgresql://user:password@host:5432/vega_master" | gcloud secrets create MASTER_DB_URL --data-file=-
echo -n "postgres" | gcloud secrets create DB_USER --data-file=-

# Clerk credentials
echo -n "sk_live_..." | gcloud secrets create CLERK_SECRET_KEY --data-file=-
echo -n "pk_live_..." | gcloud secrets create CLERK_PUBLISHABLE_KEY --data-file=-

# Master admin
echo -n "user_39UH4MSDAOEKSYKoqlbdDKXnPKT" | gcloud secrets create MASTER_ADMIN_CLERK_ID --data-file=-

# Optional: CORS origin
echo -n "https://yourdomain.com" | gcloud secrets create ALLOWED_ORIGIN --data-file=-
```

### Grant access to Cloud Run service account

```bash
# Get your Cloud Run service account
SERVICE_ACCOUNT="your-project-number@cloudbuild.gserviceaccount.com"

# Grant secret accessor role
gcloud secrets add-iam-policy-binding DB_PASSWORD \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding MASTER_DB_URL \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DB_USER \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding CLERK_SECRET_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding CLERK_PUBLISHABLE_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding MASTER_ADMIN_CLERK_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding ALLOWED_ORIGIN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

## Setup Cloud SQL

1. Crea l'istanza Cloud SQL PostgreSQL se non esiste:

```bash
gcloud sql instances create vega-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --network=default
```

2. Crea il database master:

```bash
gcloud sql databases create vega_master --instance=vega-postgres
```

3. Crea la tabella `tenants` nel database master:

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT NOT NULL UNIQUE,
  db_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_clerk_org_id ON tenants(clerk_org_id);
CREATE INDEX idx_tenants_db_name ON tenants(db_name);
```

## Deploy Servizio Clienti (Branch main)

### Build e Push Container

```bash
# Set variables
PROJECT_ID="your-project-id"
REGION="europe-west1"
SERVICE_NAME="vega-tenant-api"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Build container
gcloud builds submit --tag ${IMAGE_NAME} \
  --substitutions=_BRANCH=main

# Or build locally and push
docker build -t ${IMAGE_NAME} .
docker push ${IMAGE_NAME}
```

### Deploy to Cloud Run

```bash
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:vega-postgres \
  --set-secrets="DB_PASSWORD=DB_PASSWORD:latest,MASTER_DB_URL=MASTER_DB_URL:latest,DB_USER=DB_USER:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,CLERK_PUBLISHABLE_KEY=CLERK_PUBLISHABLE_KEY:latest,ALLOWED_ORIGIN=ALLOWED_ORIGIN:latest" \
  --set-env-vars="NODE_ENV=production,PGSSLMODE=require" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

### Note per Servizio Clienti

- `--allow-unauthenticated`: Le API tenant richiedono autenticazione Clerk via middleware
- Le route `/api/v1/*` sono protette da `tenantAuthMiddleware`
- Il servizio legge `MASTER_DB_URL` per connettersi al database master e risolvere il mapping tenant

## Deploy Servizio Master Admin (Branch master-admin)

### Build e Push Container

```bash
# Set variables
PROJECT_ID="your-project-id"
REGION="europe-west1"
SERVICE_NAME="vega-master-admin"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Build container from master-admin branch
gcloud builds submit --tag ${IMAGE_NAME} \
  --substitutions=_BRANCH=master-admin

# Or build locally and push
docker build -t ${IMAGE_NAME} .
docker push ${IMAGE_NAME}
```

### Deploy to Cloud Run

```bash
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --no-allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:vega-postgres \
  --set-secrets="DB_PASSWORD=DB_PASSWORD:latest,MASTER_DB_URL=MASTER_DB_URL:latest,DB_USER=DB_USER:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,MASTER_ADMIN_CLERK_ID=MASTER_ADMIN_CLERK_ID:latest" \
  --set-env-vars="NODE_ENV=production,PGSSLMODE=require" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 5 \
  --min-instances 0
```

### Note per Servizio Master Admin

- `--no-allow-unauthenticated`: Richiede autenticazione IAM o Clerk
- Le route `/api/master/*` sono protette da `masterAdminAuthMiddleware`
- Solo l'utente con `MASTER_ADMIN_CLERK_ID` può accedere

## Dockerfile

Assicurati che il `Dockerfile` nella root del progetto sia configurato correttamente:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
EXPOSE 8080
CMD ["npm", "run", "start:prod"]
```

## Health Checks

Cloud Run esegue automaticamente health checks su `/`. Assicurati che il server risponda correttamente:

```typescript
// In src/server/index.ts
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

## Variabili d'Ambiente

### Variabili da Secret Manager

- `DB_PASSWORD`: Password database Cloud SQL
- `MASTER_DB_URL`: Connection string database master
- `DB_USER`: Username database (default: postgres)
- `CLERK_SECRET_KEY`: Clerk secret key per server-side
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key per frontend
- `MASTER_ADMIN_CLERK_ID`: Clerk user ID del master admin

### Variabili d'Ambiente Standard

- `NODE_ENV`: `production`
- `PGSSLMODE`: `require` (per Cloud SQL)
- `PORT`: `8080` (default Cloud Run)
- `ALLOWED_ORIGIN`: Origin CORS consentita (opzionale)

## Connessione Cloud SQL

Cloud Run si connette a Cloud SQL tramite Unix socket quando usi `--add-cloudsql-instances`.

Il formato della connection string deve essere:

```
postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

Oppure usa l'IP privato:

```
postgresql://user:password@PRIVATE_IP:5432/database
```

## Testing

### Test Servizio Clienti

```bash
# Get service URL
TENANT_URL=$(gcloud run services describe vega-tenant-api \
  --region europe-west1 \
  --format 'value(status.url)')

# Test health check
curl ${TENANT_URL}/health

# Test API (richiede token Clerk)
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  ${TENANT_URL}/api/v1/players
```

### Test Servizio Master Admin

```bash
# Get service URL
ADMIN_URL=$(gcloud run services describe vega-master-admin \
  --region europe-west1 \
  --format 'value(status.url)')

# Test onboarding (richiede master admin token)
curl -X POST ${ADMIN_URL}/api/master/onboard \
  -H "Authorization: Bearer MASTER_ADMIN_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clerk_org_id": "org_xxx",
    "db_name": "tenant_db_001",
    "display_name": "Tenant 001"
  }'
```

## Monitoring e Logging

I log sono disponibili in Cloud Logging:

```bash
# View logs for tenant service
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vega-tenant-api" --limit 50

# View logs for admin service
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vega-master-admin" --limit 50
```

## Troubleshooting

### Errore: "Database pool not available"

- Verifica che `MASTER_DB_URL` sia configurato correttamente
- Verifica che Cloud SQL instance sia accessibile da Cloud Run
- Verifica che il service account abbia i permessi necessari

### Errore: "CLERK_SECRET_KEY not configured"

- Verifica che il secret esista in Secret Manager
- Verifica che il service account abbia il ruolo `secretAccessor`
- Verifica che il secret sia referenziato correttamente nel deploy

### Errore: "Forbidden - Master admin access required"

- Verifica che `MASTER_ADMIN_CLERK_ID` corrisponda al tuo Clerk user ID
- Verifica che il token JWT sia valido e non scaduto
- Verifica che il token appartenga all'utente master admin

## Aggiornamenti

Per aggiornare un servizio:

```bash
# Rebuild and redeploy
gcloud builds submit --tag ${IMAGE_NAME}
gcloud run deploy ${SERVICE_NAME} --image ${IMAGE_NAME} --region ${REGION}
```

## Rollback

Per fare rollback a una versione precedente:

```bash
# List revisions
gcloud run revisions list --service ${SERVICE_NAME} --region ${REGION}

# Rollback to specific revision
gcloud run services update-traffic ${SERVICE_NAME} \
  --to-revisions REVISION_NAME=100 \
  --region ${REGION}
```
