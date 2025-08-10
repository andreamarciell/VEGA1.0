
# Toppery AML — Analisi Avanzata (fix v6)

**Problema del 422**
Il modello restituiva testo non perfettamente JSON → parsing fallito → 422.
Ora forziamo l'output **strutturato** usando **function-calling (tools)**: il modello deve
rispondere chiamando la funzione `emit({ summary, risk_score })`. Questo elimina la variabilità
e previene i 422.

**Cosa include v6**
- Netlify function aggiornata:
  - Struttura output con `tools` + `tool_choice` su OpenRouter.
  - Timeout + fallback: `gpt-5-mini` (28s) → `gpt-4.1-nano` (18s).
  - Calcolo server-side degli **indicatori** per i grafici (forme identiche a FUNGE).
- Frontend (identico a v5): i grafici appaiono **solo dopo** l’analisi; errori puliti.

**Env**
- `OPENROUTER_API_KEY` nelle Netlify Functions.

