
# Toppery AML — Analisi Avanzata (fix v11)

**Motivo dello scostamento tra “Transazioni” e “Analisi avanzata”**
L’analisi prendeva *tutte* le righe salvate in `amlTransactions` (anche giocate, vincite, bonus, ecc.) e inferiva la direzione dall’importo o
da parole chiave. In molti export gli importi dei prelievi sono positivi e le righe non contengono la parola “withdraw”, quindi venivano marcate come **depositi**.
Risultato: totali sbagliati e metodo di pagamento non coerente.

**Fix corretti**
1. **Filtro lato client**: ora invio alla function **solo** le righe di **deposito**/**prelievo**.
   - Uso i campi dedicati (case-insensitive): `Deposit domain` ⇒ **dir = in**, `Withdrawal mode` ⇒ **dir = out**.
   - Compongo un payload minimale `{ ts, amount, dir, reason }` mantenendo l’anonimizzazione.
2. **Parser numeri allineato** client/server (migliaia/decimali/parentesi) per evitare discrepanze.
3. **Server trust-first**: se arrivo con `dir`, la function lo **rispetta** (non re-inferisce), e calcola indicatori/summary a partire da questi dati.

**Cosa aspettarsi**
- Totale **Depositi** e **Prelievi** in sintesi ora combacia con la pagina **Transazioni** (es. screenshot: Depositi ≈ 30.298, Prelievi ≈ 14.499,99).
- Grafici coerenti (metodi, flusso giornaliero, distribuzione oraria) perché alimentati solo da movimenti reali di cassa.

**File inclusi**
- `netlify/functions/amlAdvancedAnalysis.js` — v11 (trust dir + parsing robusto + indicatori + gpt-5-mini).
- `src/components/aml/pages/AnalisiAvanzata.tsx` — costruisce e invia solo depositi/prelievi, dir esplicitato.
- `src/state/amlAdvanced.ts` — store Zustand (da v10).

