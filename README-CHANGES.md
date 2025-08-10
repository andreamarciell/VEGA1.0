
# Fix: Analisi Avanzata — Toppery AML

Questa patch risolve due problemi principali:
1) **Dati non passati correttamente all'AI (consumo token troppo basso)**  
   - Ora l'analisi legge *tutte* le transazioni parse e salvate in `localStorage['amlTransactions']` (inserite da AmlDashboard) e costruisce un payload **completo** con `{ ts, amount, dir, reason }`, mantenendo l’anonimizzazione (solo causale, importi e date).
   - Zero inclusi: non vengono più scartate le transazioni con importo `0`.

2) **Gestione risposta e visualizzazione**  
   - La Netlify Function (`netlify/functions/amlAdvancedAnalysis.js`) chiama **OpenRouter** con **openai/gpt-4.1-nano** usando `response_format: { type: "json_object" }` per evitare 500 legati a `json_schema`.  
   - La risposta è un JSON con `summary` (sintesi descrittiva, IT), `risk_score` (0–100), ed eventualmente `indicators` (per i grafici).  
   - In `AnalisiAvanzata.tsx`, se il modello non fornisce `indicators`, vengono calcolati **in locale** per garantire che i grafici restino invariati e funzionanti.

## File modificati
- `src/components/aml/pages/AnalisiAvanzata.tsx`
- `netlify/functions/amlAdvancedAnalysis.js`

## Dettagli implementativi
- **Anonimizzazione**: email, ID, numeri lunghi e token vengono mascherati; la causale è limitata a 300 caratteri.
- **Direzione (dir)**: inferita in modo robusto (prelievo/withdraw/cashout => `out`; deposito/ricarica/topup => `in`; fallback su segno dell’importo).
- **Endpoint**: `POST https://openrouter.ai/api/v1/chat/completions`, header `Authorization: Bearer <OPENROUTER_API_KEY>`, `HTTP-Referer`, `X-Title`.
- **Prompt**: istruzioni in italiano specifiche per i casi AML iGaming con output **solo JSON**.
- **Compatibilità grafici**: mantenuti 5 grafici (Net flow mensile, Distribuzione oraria, Metodi, Flusso giornaliero, Conteggio giornaliero).  
  I dataset passati sono identici per semantica a quelli già attesi (`net_flow_by_month`, `hourly_histogram`, `method_breakdown`).

## Cosa resta invariato
- Tutte le altre pagine e componenti.
- Il modello usato: **gpt‑4.1‑nano** via OpenRouter.
- La UI/UX della pagina e i grafici già presenti.

## Note operative
- Verifica che la variabile `OPENROUTER_API_KEY` sia valorizzata nell’ambiente Netlify.
- Facoltativo: imposta `APP_PUBLIC_URL` e `APP_TITLE` per comparire correttamente nei log OpenRouter.
