# 🚀 **ISTRUZIONI PER IL DEBUG DEL LOGIN**

## ⚠️ **ATTENZIONE: Devi configurare la SUPABASE_SERVICE_ROLE_KEY prima di procedere!**

### **STEP 1: Ottieni la Service Role Key**

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto `vobftcreopaqrfoonybp`
3. Vai su **Settings** → **API**
4. Copia la **Service Role Key** (inizia con `eyJ...`)

### **STEP 2: Configura la Service Role Key**

Modifica il file `.env.local` e sostituisci:
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Con la tua chiave reale:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **STEP 3: Esegui i Debug Script**

Ora puoi eseguire i debug script in due modi:

#### **Opzione A: Script Interattivo (RACCOMANDATO)**
```bash
./run-debug.sh
```

Questo script ti darà un menu per scegliere quale test eseguire.

#### **Opzione B: Script Singoli**
```bash
# 1. Debug della tabella profiles
source .env.local && node debug-profiles.js

# 2. Crea profili mancanti
source .env.local && node create-missing-profiles.js

# 3. Test login diretto
source .env.local && node test-login-direct.js <username> <password>

# 4. Test Edge Function
source .env.local && node check-edge-function.js <username> <password>
```

## 🔍 **COSA FA OGNI SCRIPT:**

### **1. `debug-profiles.js`**
- Verifica se la tabella `profiles` esiste
- Conta quanti profili ci sono
- Lista i primi 10 profili
- Conta gli utenti in `auth.users`
- Identifica utenti senza profili

### **2. `create-missing-profiles.js`**
- Crea automaticamente profili per utenti che esistono in `auth.users` ma non in `profiles`
- Genera username univoci dall'email se necessario

### **3. `test-login-direct.js`**
- Simula esattamente il processo di login dell'Edge Function
- Testa ogni step: ricerca profilo → ottieni email → login
- Mostra esattamente dove fallisce il processo

### **4. `check-edge-function.js`**
- Testa direttamente l'Edge Function
- Mostra la risposta HTTP completa
- Identifica se il problema è nell'Edge Function o nel database

## 🎯 **SEQUENZA RACCOMANDATA:**

1. **Esegui `debug-profiles.js`** per vedere lo stato attuale
2. **Se mancano profili, esegui `create-missing-profiles.js`**
3. **Testa il login con `test-login-direct.js`** usando credenziali reali
4. **Se il database funziona, testa l'Edge Function con `check-edge-function.js`**

## 🚨 **PROBLEMI COMUNI:**

### **❌ "SUPABASE_SERVICE_ROLE_KEY not configured"**
- Devi configurare la chiave nel file `.env.local`
- La chiave è diversa dalla `anon key`

### **❌ "Error accessing profiles table"**
- La tabella `profiles` potrebbe non esistere
- Le policy RLS potrebbero essere troppo restrittive

### **❌ "Profile not found"**
- L'utente esiste in `auth.users` ma non in `profiles`
- Esegui `create-missing-profiles.js`

### **❌ "Edge Function call failed"**
- L'Edge Function potrebbe non essere deployata
- Potrebbe esserci un errore di sintassi

## 🆘 **SE NIENTE FUNZIONA:**

Se tutti gli script falliscono, il problema potrebbe essere:

1. **Edge Function non deployata** → Ricrea l'Edge Function
2. **Policy RLS troppo restrittive** → Disabilita temporaneamente RLS
3. **Tabella `profiles` non esiste** → Verifica le migrazioni
4. **Variabili d'ambiente sbagliate** → Controlla i valori

## 📞 **SUPPORTO:**

Dopo aver eseguito i debug script, fammi sapere:
- **Quali script hanno funzionato**
- **Quali errori hai ricevuto**
- **I risultati di ogni test**

**Inizia configurando la SUPABASE_SERVICE_ROLE_KEY e poi esegui `./run-debug.sh`!** 🚀
