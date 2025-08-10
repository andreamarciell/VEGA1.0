
# Toppery AML — Analisi Avanzata (fix v3)

Richieste:
1) Il box della sintesi non deve comparire prima dell'analisi.
2) I grafici precedenti sono scomparsi: ripristinarli.

Modifiche effettuate:
- **UI**: la card con badge rischio + "Sintesi generale" viene renderizzata **solo** quando `result` è disponibile (dopo una chiamata andata a buon fine). Prima, il pulsante mostra "esegui analisi".
- **Grafici ripristinati** all'interno della pagina: 
  - *Net Flow mensile* (Depositi vs Prelievi, stack bar) calcolato dai `txs` locali.
  - *Distribuzione oraria* (conteggio transazioni per ora UTC).
  - *Metodi di pagamento* (pie chart con rule-based classification di causali: ewallet, card, bank, bonus, other).
- Nessuna modifica alla funzione Netlify (si riutilizza la v2: output `{ summary, risk_score }`).
- Dati AI restano anonimizzati lato funzione.

File nel pacchetto:
- `src/components/aml/pages/AnalisiAvanzata.tsx` — aggiornato (condizionale del box + grafici ripristinati).
- `netlify/functions/amlAdvancedAnalysis.js` — identico a v2 (per completezza nel pacchetto).
