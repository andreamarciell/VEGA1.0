
# Toppery AML — Analisi Avanzata (fix v5)

**Perché vedevi 504 Cloudflare**
La funzione Netlify aspettava troppo la risposta del modello (upstream) e superava la finestra di attesa del CDN → Cloudflare 504/timeout.

**Fix implementati**
- **Timeout e fallback** in funzione:
  - Prima tenta **`openai/gpt-5-mini`** con timeout **28s**.
  - Se non risponde in tempo o dà 5xx, fa **fallback** a **`openai/gpt-4.1-nano`** (timeout **18s**).
  - In caso di fallimento, la funzione restituisce JSON `{ code: 'upstream_timeout_or_error', detail }` con **504** (così il client non stampa HTML Cloudflare).
- **UI**:
  - Mostra un messaggio di errore pulito (parsa JSON dell’errore se presente) invece del markup HTML di Cloudflare.
  - Grafici e sintesi appaiono **solo** dopo un risultato valido.
- **Indicatori server-side** inclusi nella risposta, forme identiche a FUNGE:
  `net_flow_by_month, hourly_histogram, method_breakdown, daily_flow, daily_count`.

**Env richieste**
- `OPENROUTER_API_KEY` nelle Netlify Functions.

