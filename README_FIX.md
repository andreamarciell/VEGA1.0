
# Toppery AML — Analisi Avanzata (fix v2)

Modifiche richieste:
- RIMOSSA la sezione **Flags** dalla carta dell’analisi avanzata.
- La **Sintesi generale** ora è l’unico blocco descrittivo mostrato nella scheda, e viene popolata con un testo dettagliato che include:
  - totali di **depositato** e **prelevato**;
  - prodotti principali (slot, casino live, sportsbook, poker, lotterie, ecc. — se deducibili dalla causale);
  - anomalie/pattern e indicatori AML;
  - picchi con **giorni e orari**;
  - cambi di metodo di pagamento (se deducibili).
- Conservato il **badge del rischio** (0–100) senza modificare grafici o altre pagine.

## File modificati
- `netlify/functions/amlAdvancedAnalysis.js`
  - prompt aggiornato per una **sintesi molto dettagliata**; output ristretto a `{ summary, risk_score }`.
  - uso di `response_format: { type: 'json_object' }` con parsing robusto.
  - invio al modello dei soli dati anonimizzati `ts,amount,dir,reason` in CSV.

- `src/components/aml/pages/AnalisiAvanzata.tsx`
  - rimossa la sezione **Flags**.
  - UI della carta: **solo** badge rischio + **Sintesi generale**.
  - nessuna modifica ai grafici o ad altre sezioni.

## Variabili ambiente
Assicurarsi che `OPENROUTER_API_KEY` sia presente nell'ambiente **Functions** su Netlify.
