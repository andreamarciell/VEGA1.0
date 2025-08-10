
# Toppery AML — Analisi Avanzata (fix v7)

## Perché la sintesi era vuota e i grafici mostravano solo il giorno 10
1) **Parsing date non EU**: il server interpretava `10/08/2025 21:10` come **formato US** oppure non lo parse-ava affatto. Di conseguenza molte righe
   finivano aggregate su un unico giorno (o scartate), e i grafici risultavano piatti / concentrati in un solo giorno.
2) **Output LLM non strutturato**: alcune risposte non producevano `summary` → la UI mostrava una scheda vuota.

## Cosa ho fixato
- **Parser date europeo robusto** (`DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, con orario opzionale; supporta anche `YYYY-MM-DD`):
  converto tutto in **UTC ISO** (es. `2025-08-10T21:10:00.000Z`). Niente fallback a “now”.
- **Indicatori server-side** ricalcolati dalle date corrette: `net_flow_by_month`, `hourly_histogram`, `method_breakdown`, `daily_flow`, `daily_count`.
- **LLM affidabile (gpt-5-mini)** con **function-calling** obbligatorio (`emit({ summary, risk_score })`), timeout e fallback a `gpt-4.1-nano`.
- **Fallback finale**: se per qualsiasi motivo l’LLM non restituisce `summary`, genero una sintesi server-side (mai vuota) usando i totali e i picchi.
- **UI**: invariata rispetto alla tua richiesta precedente (grafici e sintesi compaiono solo dopo l’analisi).

## File modificati
- `netlify/functions/amlAdvancedAnalysis.js` — v7 (parser date EU, tools, fallback, indicatori, sintesi di sicurezza)
- `src/components/aml/pages/AnalisiAvanzata.tsx` — identico alla v5 (grafici dopo analisi)

## Note
- Le transazioni senza data valida vengono **saltate** per non corrompere i grafici. Se vuoi forzare l’inclusione anche senza timestamp,
  posso inserirle con un bucket "unknown".

