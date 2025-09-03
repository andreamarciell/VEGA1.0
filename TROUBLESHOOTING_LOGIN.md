# 🔍 Troubleshooting: "Invalid username or password" Error

## 🚨 **PROBLEMA IDENTIFICATO**

Ricevi sempre l'errore "Invalid username or password" anche dopo aver rimosso le validazioni restrittive.

## 🛠️ **SOLUZIONE COMPLETA - STEP BY STEP**

### **STEP 1: Verifica le Variabili d'Ambiente**

```bash
# Configura queste variabili
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export VITE_SUPABASE_ANON_KEY="your_anon_key"
export EDGE_FUNCTION_URL="https://your-project.supabase.co/functions/v1/login-with-username"
```

### **STEP 2: Debug della Tabella Profiles**

```bash
# Verifica se la tabella profiles esiste e contiene dati
node debug-profiles.js
```

**Se la tabella è vuota o non esiste:**
- Gli utenti esistono in `auth.users` ma non in `profiles`
- Il trigger `handle_new_user` non ha funzionato

### **STEP 3: Crea i Profili Mancanti**

```bash
# Crea automaticamente i profili per gli utenti esistenti
node create-missing-profiles.js
```

### **STEP 4: Test Diretto del Database**

```bash
# Testa il processo di login direttamente nel database
node test-login-direct.js <username> <password>

# Esempio:
node test-login-direct.js testuser mypassword
```

### **STEP 5: Test dell'Edge Function**

```bash
# Testa direttamente l'Edge Function
node check-edge-function.js <username> <password>

# Esempio:
node check-edge-function.js testuser mypassword
```

## 🔍 **DIAGNOSI DETTAGLIATA**

### **Possibili Cause:**

1. **❌ Tabella `profiles` vuota**
   - Gli utenti esistono solo in `auth.users`
   - Il trigger non ha creato i profili

2. **❌ Policy RLS troppo restrittive**
   - Anche con `supabaseAdmin` le policy bloccano l'accesso
   - Le policy potrebbero essere configurate male

3. **❌ Edge Function non deployata**
   - L'Edge Function potrebbe non essere attiva
   - Potrebbe esserci un errore di sintassi

4. **❌ Variabili d'ambiente sbagliate**
   - Le chiavi potrebbero essere errate
   - L'URL potrebbe essere sbagliato

### **Verifica Rapida:**

```bash
# 1. Controlla se l'Edge Function è attiva
curl -X POST $EDGE_FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# 2. Controlla i log di Supabase
# Vai su Dashboard > Logs > Edge Functions
```

## 🚀 **SOLUZIONI ALTERNATIVE**

### **Opzione A: Bypass Edge Function (Temporaneo)**

Se l'Edge Function non funziona, puoi temporaneamente usare il login diretto:

```typescript
// In src/lib/auth.ts, commenta temporaneamente la chiamata all'Edge Function
// const { data, error } = await supabase.functions.invoke('login-with-username', {
//   body: credentials,
// });

// E usa il login diretto con email
const { data, error } = await supabase.auth.signInWithPassword({
  email: credentials.username, // Assumendo che username sia l'email
  password: credentials.password
});
```

### **Opzione B: Ricrea l'Edge Function**

```bash
# Nel progetto Supabase
supabase functions deploy login-with-username
```

### **Opzione C: Verifica le Policy RLS**

```sql
-- Disabilita temporaneamente RLS per testare
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Testa il login
-- Se funziona, il problema è nelle policy

-- Riabilita RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## 📋 **CHECKLIST COMPLETA**

- [ ] Variabili d'ambiente configurate correttamente
- [ ] Tabella `profiles` esiste e contiene dati
- [ ] Edge Function deployata e attiva
- [ ] Policy RLS non bloccano l'accesso
- [ ] Utenti esistono sia in `auth.users` che in `profiles`
- [ ] Username sono univoci nella tabella `profiles`

## 🆘 **SE NIENTE FUNZIONA**

### **Ultima Risorsa: Login Diretto con Email**

Se tutto il resto fallisce, puoi temporaneamente permettere il login diretto con email:

1. **Modifica il frontend** per accettare email invece di username
2. **Usa `supabase.auth.signInWithPassword`** direttamente
3. **Bypassa completamente** la tabella `profiles`

### **Supporto Tecnico**

1. **Controlla i log di Supabase** per errori specifici
2. **Verifica che l'Edge Function sia deployata** correttamente
3. **Controlla le policy RLS** della tabella `profiles`
4. **Verifica che le migrazioni** siano state applicate

## 🎯 **PROSSIMI PASSI**

1. **Esegui `debug-profiles.js`** per identificare il problema
2. **Se mancano profili, esegui `create-missing-profiles.js`**
3. **Testa con `test-login-direct.js`** per verificare il database
4. **Testa con `check-edge-function.js`** per verificare l'Edge Function
5. **Fammi sapere i risultati** di ogni test

**Inizia con il primo script e dimmi cosa trovi!** 🔍
