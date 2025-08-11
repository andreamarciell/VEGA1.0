
# Toppery AML — Analisi Avanzata (fix v8)

**Perché vedevi 502**  
La function andava oltre le finestre di tempo del runtime o il provider rifiutava il payload,
producendo errori non gestiti a monte → Netlify rispondeva 502.

**Fix definitivi**
- **Timeout budget < 10s** complessivi: gpt‑5‑mini (7s) → fallback gpt‑4.1‑nano (4s).  
- **Dual-mode chiamata**: prima *function-calling (tools)*, poi `response_format: json_object` come fallback.  
- **Mai più 5xx alla UI**: tutte le eccezioni vengono intercettate e la funzione restituisce sempre JSON valido (o un fallback descrittivo).
- **Parsing date europeo** robusto (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, con orario) + ISO UTC.  
- **Indicatori per i grafici** calcolati server-side (shape identica a FUNGE): net flow mese, distribuzione oraria, metodi, flusso e conteggio giornalieri.
- **Cap su righe inviate al modello** per evitare prompt eccessivi (`MAX_TXS_LINES = 6000`). I grafici usano comunque **tutte** le transazioni valide.
- **Sintesi garantita**: se il modello non risponde in tempo o non è strutturato, viene generata una sintesi server-side, così la card non resta mai vuota.

**File nel pacchetto**
- `netlify/functions/amlAdvancedAnalysis.js` — v8 (robusta e compatibile Netlify).  
- `src/components/aml/pages/AnalisiAvanzata.tsx` — mostra sintesi e grafici **solo dopo** l’analisi.

**Note**
- Verifica che `OPENROUTER_API_KEY` sia presente nelle **Functions** (non solo nel build env).

