
# Toppery AML — Analisi Avanzata (fix v9)

**Perché vedevi HTTP 422**  
Il server scartava tutte le righe perché i campi arrivavano con **nomi diversi** (es. `Date`, `Amount`, `Reason` in maiuscolo)
rispetto a quelli attesi; quindi non trovava timestamp validi → nessuna transazione valida → 422.

**Fix applicati**
- **Mapping case‑insensitive** dei campi: ora accettiamo `ts/timestamp/date/datetime/created_at/Date/DATA`, `amount/Amount/Importo`, `reason/Reason/Descrizione/Motivo`, ecc.
- **Direzione robusta**: inferita da più sorgenti (colonne deposit/withdraw esplicite, keyword nel valore/chiave, segno dell’importo, parole nella causale).
- **Niente più 422**: anche con 0 record validi, la funzione risponde 200 con una sintesi di fallback e indicatori vuoti (la UI non va in errore).
- **gpt‑5 mini** usato per l’analisi, con fallback a json_object e a **gpt‑4.1‑nano** per resilienza.
- **Parser date europeo** e **indicatori server‑side** (shape identica a FUNGE), così i grafici riflettono correttamente *tutti* i giorni e le ore.

**File inclusi**
- `netlify/functions/amlAdvancedAnalysis.js` — v9 (mapping campi + inferenza dir + tool/json fallback + timeouts).
- `src/components/aml/pages/AnalisiAvanzata.tsx` — invariato: mostra card e grafici **solo dopo** l’analisi.

**Note**
- Verifica che `OPENROUTER_API_KEY` sia valorizzata nelle **Functions**.
- Se hai dataset con altre colonne particolari per la direzione, dimmele e le aggiungo ai pattern.

