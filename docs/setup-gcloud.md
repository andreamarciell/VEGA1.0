# Setup Google Cloud CLI

Guida rapida per installare e configurare Google Cloud CLI su macOS.

## Installazione

### Opzione 1: Homebrew (Consigliato)

```bash
# Installa Homebrew se non ce l'hai
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installa Google Cloud CLI
brew install --cask google-cloud-sdk
```

### Opzione 2: Installer Ufficiale

```bash
# Scarica e installa
curl https://sdk.cloud.google.com | bash

# Riavvia il terminale o esegui:
exec -l $SHELL
```

## Configurazione Iniziale

### 1. Login a Google Cloud

```bash
# Autenticazione interattiva (apre il browser)
gcloud auth login

# Se hai un account aziendale, usa:
gcloud auth login --no-launch-browser
```

### 2. Imposta il Project ID

```bash
# Sostituisci YOUR_PROJECT_ID con il tuo project ID Google Cloud
gcloud config set project YOUR_PROJECT_ID

# Verifica la configurazione
gcloud config list
```

### 3. Abilita le API necessarie

```bash
# Cloud Run API
gcloud services enable run.googleapis.com

# Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Cloud Build API (per build container)
gcloud services enable cloudbuild.googleapis.com

# Container Registry API
gcloud services enable containerregistry.googleapis.com
```

### 4. Verifica Installazione

```bash
# Verifica versione
gcloud --version

# Verifica configurazione
gcloud config list

# Verifica autenticazione
gcloud auth list
```

## Setup Service Account (Opzionale ma Consigliato)

Per deploy automatizzati, crea un service account:

```bash
PROJECT_ID="your-project-id"
SERVICE_ACCOUNT="cloud-run-deployer"

# Crea service account
gcloud iam service-accounts create ${SERVICE_ACCOUNT} \
  --display-name="Cloud Run Deployer" \
  --project=${PROJECT_ID}

# Assegna ruoli necessari
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

# Crea e scarica key JSON
gcloud iam service-accounts keys create ~/gcloud-key.json \
  --iam-account=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com

# Usa la key per autenticazione
gcloud auth activate-service-account ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --key-file=~/gcloud-key.json
```

## Variabili d'Ambiente Utili

Aggiungi al tuo `~/.zshrc` o `~/.bashrc`:

```bash
# Google Cloud
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/gcloud-key.json"  # Se usi service account

# Alias utili
alias gcp-project='gcloud config get-value project'
alias gcp-set='gcloud config set project'
```

## Troubleshooting

### "Command not found: gcloud"

Dopo l'installazione, riavvia il terminale o esegui:
```bash
source ~/.zshrc  # o ~/.bashrc
```

### "Permission denied" o errori di autenticazione

```bash
# Verifica account attivo
gcloud auth list

# Re-autentica se necessario
gcloud auth login

# Imposta application default credentials
gcloud auth application-default login
```

### "API not enabled"

Abilita le API necessarie (vedi punto 3 sopra).

## Prossimi Passi

Dopo aver configurato gcloud, procedi con:

1. **Setup Secret Manager** - Vedi `docs/deploy-cloud-run.md`
2. **Setup Cloud SQL** - Crea istanza PostgreSQL
3. **Deploy** - Usa gli script in `scripts/`

```bash
# Test rapido
gcloud projects list
gcloud run services list
```
