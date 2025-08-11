
# Toppery AML — Analisi Avanzata (fix v10)

## 1) Importi errati (33,194 → 33.194)
**Motivo:** il parser precedente interpretava stringhe con **sola virgola** come decimale (es. `33,194` → `33.194`), mentre in realtà era il separatore delle **migliaia** → i totali depositi/prelievi risultavano più bassi.

**Fix:** nuova funzione `toNum()`
- riconosce correttamente migliaia e decimali:
  - `33,194` → **33194**
  - `1.234,56` → **1234.56**
  - `1.234` (solo punto) → **1234**
  - `33,19` → **33.19**
  - gestisce anche negativi tra parentesi: `(1.234,56)` → **-1234.56**
- mantiene l'anonimizzazione (al modello inviamo solo `ts,amount,dir,reason` in CSV).

## 2) Persistenza risultato su **Zustand**
- Nuovo store: `src/state/amlAdvanced.ts` con `persist` su `localStorage` (chiave `aml-advanced-analysis`).
- La pagina `AnalisiAvanzata.tsx` ora:
  - legge `result` dallo store all'apertura;
  - salva in store dopo il calcolo (`setResult(json)`);
  - mostra card e grafici anche dopo che l’utente cambia pagina e torna indietro (finché non ricalcola).

## 3) Resto
- Confermati: parsing **EU date**, indicatori per i grafici calcolati **server-side** (shape FUNGE), modello **gpt-5 mini** con fallback e output strutturato.

## File inclusi
- `netlify/functions/amlAdvancedAnalysis.js` — v10 (parser numeri corretto + tutto il resto).
- `src/state/amlAdvanced.ts` — nuovo store Zustand con persistenza.
- `src/components/aml/pages/AnalisiAvanzata.tsx` — usa lo store; card/grafici dopo analisi.

