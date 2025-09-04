# Sistema di Blocco Account - Documentazione Completa

## Panoramica

È stato implementato un sistema completo di blocco account che si attiva dopo 3 tentativi di login falliti, con timer progressivo e persistenza tra le sessioni.

## Caratteristiche Principali

### 1. Blocco Progressivo
- **3 tentativi falliti**: Blocco per 30 secondi
- **6 tentativi falliti**: Blocco per 1 minuto  
- **9+ tentativi falliti**: Blocco per 15 minuti

### 2. Persistenza del Blocco
- Il blocco persiste tra le sessioni e le pagine
- Utilizza sia il database Supabase che il localStorage per la persistenza
- Timer sincronizzato tra frontend e backend

### 3. Interfaccia Utente
- Timer visuale con countdown in tempo reale
- Barra di progresso che mostra il livello di sicurezza
- Messaggi informativi e avvisi di sicurezza
- Design responsive e accessibile

## Architettura Tecnica

### Database (Supabase)

#### Tabella `account_lockouts`
```sql
CREATE TABLE account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  failed_attempts integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  lockout_expires_at timestamptz,
  first_failed_attempt timestamptz DEFAULT NOW(),
  last_failed_attempt timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
```

#### Funzioni RPC
- `record_failed_login_attempt(username, ip_address, user_agent)`: Registra un tentativo fallito
- `check_account_lockout_status(username)`: Controlla lo stato di blocco
- `reset_account_lockout(username)`: Resetta il blocco (per login riuscito)
- `get_lockout_statistics()`: Statistiche del sistema

### Frontend (React + TypeScript)

#### Hook `useAccountLockout`
- Gestisce lo stato del blocco account
- Timer sincronizzato con il database
- Persistenza nel localStorage
- API per controllare e resettare il blocco

#### Componenti
- `LockoutTimer`: Timer visuale con countdown
- `LoginForm`: Form di login integrato con il sistema di blocco
- `TestLockoutSystem`: Componente di test per verificare il funzionamento

## Implementazione

### 1. Migrazione Database
La migrazione `20250102000001_account_lockout_system.sql` crea:
- Tabella per tracciare i tentativi falliti
- Funzioni RPC per la gestione del blocco
- Indici per le performance
- RLS (Row Level Security) per la sicurezza

### 2. Edge Function Aggiornata
La funzione `login-with-username` è stata aggiornata per:
- Controllare lo stato di blocco prima del login
- Registrare i tentativi falliti
- Resettare il blocco sui login riusciti

### 3. Frontend Integrato
Il sistema è completamente integrato nel flusso di login:
- Controllo automatico dello stato di blocco
- Timer visuale durante il blocco
- Gestione degli errori e messaggi informativi

## Utilizzo

### Per gli Utenti
1. **Login Normale**: Funziona come prima
2. **Tentativi Falliti**: Dopo 3 tentativi, l'account viene bloccato
3. **Timer di Sblocco**: Visualizzazione del tempo rimanente
4. **Sblocco Automatico**: L'account si sblocca automaticamente

### Per gli Sviluppatori
1. **Test**: Visita `/test-lockout` per testare il sistema
2. **Monitoraggio**: Usa `get_lockout_statistics()` per le statistiche
3. **Debug**: Controlla i log del database per i dettagli

## Sicurezza

### Protezioni Implementate
- **Rate Limiting**: Limite per IP address
- **Input Sanitization**: Pulizia degli input utente
- **Logging**: Tracciamento completo degli eventi di sicurezza
- **RLS**: Accesso controllato alle tabelle di blocco

### Best Practices
- Nessuna informazione sensibile esposta negli errori
- Timeout progressivi per scoraggiare attacchi brute force
- Persistenza sicura delle informazioni di blocco
- Validazione lato server e client

## Test e Debug

### Rotte di Test
- `/test-lockout`: Interfaccia completa per testare il sistema
- Funzionalità di test per ogni aspetto del sistema

### Log e Monitoraggio
- Log dettagliati nel database
- Statistiche in tempo reale
- Tracciamento degli IP e User Agent

## Configurazione

### Variabili d'Ambiente
- `SUPABASE_URL`: URL del progetto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chiave per le operazioni amministrative
- `SUPABASE_ANON_KEY`: Chiave per le operazioni pubbliche

### Personalizzazione
- Durate di blocco configurabili nelle funzioni RPC
- Messaggi personalizzabili nell'interfaccia
- Stili CSS personalizzabili

## Troubleshooting

### Problemi Comuni
1. **Migrazione Fallita**: Verifica i conflitti con migrazioni esistenti
2. **Funzioni RPC Non Trovate**: Controlla i permessi e la sintassi
3. **Timer Non Sincronizzato**: Verifica la connessione al database

### Soluzioni
1. **Riparazione Migrazioni**: Usa `supabase migration repair`
2. **Controllo Permessi**: Verifica i grant sulle funzioni RPC
3. **Debug Log**: Controlla i log del database e del frontend

## Roadmap Futura

### Miglioramenti Pianificati
- **Notifiche Email**: Avvisi di blocco account
- **Whitelist IP**: Esclusione di IP fidati
- **Analisi Comportamentale**: Rilevamento di pattern sospetti
- **Dashboard Admin**: Interfaccia per la gestione del sistema

### Integrazioni
- **SMS**: Notifiche via SMS per i blocchi
- **Webhook**: Integrazione con sistemi esterni
- **API**: Endpoint REST per la gestione programmatica

## Conclusione

Il sistema di blocco account implementato fornisce:
- **Sicurezza Robusta**: Protezione contro attacchi brute force
- **UX Migliorata**: Feedback chiaro e timer visuali
- **Scalabilità**: Architettura che supporta carichi elevati
- **Manutenibilità**: Codice ben strutturato e documentato

Il sistema è pronto per la produzione e può essere facilmente esteso per soddisfare requisiti futuri.
