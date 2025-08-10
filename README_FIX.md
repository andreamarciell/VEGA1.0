
# Toppery AML — Analisi Avanzata (fix v4)

**Richieste implementate**
- Passaggio al modello **gpt-5-mini** su OpenRouter.
- I grafici della pagina **appaiono solo dopo** che l'analisi è stata eseguita, alimentati **esclusivamente** dai dati dell'analisi, con shape identiche a *FUNGE.zip*.

**Cosa è cambiato**
- `netlify/functions/amlAdvancedAnalysis.js`
  - `model: 'openai/gpt-5-mini'` (OpenRouter).
  - Calcolo **server-side** degli indicatori per i grafici, mantenendo l'anonimizzazione:
    - `net_flow_by_month: [{ month, deposits, withdrawals }]`
    - `hourly_histogram: [{ hour, count }]`
    - `method_breakdown: [{ method, pct }]`
    - `daily_flow: [{ day, deposits, withdrawals }]`
    - `daily_count: [{ day, count }]`
  - Prompt invariato nella logica, output LLM forzato con `response_format: { type: 'json_object' }` e parsing robusto.
  - Response finale: `{ summary, risk_score, indicators }`.

- `src/components/aml/pages/AnalisiAvanzata.tsx`
  - La card **Sintesi generale** e **tutti i grafici** sono renderizzati **solo se** `result` è presente.
  - Grafici ripristinati con **Chart.js** e ciclo destroy→create, come in FUNGE.

**Env**
- Imposta `OPENROUTER_API_KEY` nelle Netlify Functions.
- (Opzionali) `APP_PUBLIC_URL`, `APP_TITLE` per attribution.

