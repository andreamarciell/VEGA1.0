import { useAmlStore, TransactionResults } from '@/store/amlStore';
import { useAmlExportStore } from '@/store/amlExportStore';

/**
 * Aggrega in un unico oggetto tutti i dati da serializzare nel file JSON.
 *
 * - Transazioni        ➜ useAmlStore ▸ transactionResults
 * - Accessi            ➜ useAmlStore ▸ accessResults
 * - Grafici            ➜ calcolato on‑the‑fly (o proveniente dallo store export)
 * - Sessioni Notturne  ➜ calcolato on‑the‑fly (o proveniente dallo store export)
 *
 * In questo modo i campi «grafici» e «sessioniNotturne» vengono
 * sempre popolati anche se l’utente non ha aperto le rispettive tab.
 */
export default function useAmlData() {
  /* ---------- Stato principale ---------- */
  const { transactionResults, accessResults } = useAmlStore(state => ({
    transactionResults: state.transactionResults,
    accessResults: state.accessResults,
  }));

  /* ---------- Slice export (dati già salvati dalle view) ---------- */
  const graficiPersistiti      = useAmlExportStore(s => s.grafici);
  const sessioniPersistite     = useAmlExportStore(s => s.sessioniNotturne);

  /* ---------- Fallback on‑the‑fly ---------- */
  const graficiFallback        = computeGrafici(transactionResults);
  const sessioniFallback       = computeSessioni(accessResults);

  /* ---------- Risultato finale ---------- */
  const graficiFinal           = graficiPersistiti.length      ? graficiPersistiti      : graficiFallback;
  const sessioniNotturneFinal  = sessioniPersistite.length     ? sessioniPersistite     : sessioniFallback;

  return {
    grafici: graficiFinal,
    sessioniNotturne: sessioniNotturneFinal,
    transazioni: transactionResults,
    accessi: accessResults,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function computeGrafici(transactionResults?: TransactionResults | null) {
  if (!transactionResults) return [];

  const dep = transactionResults.depositData;
  const wit = transactionResults.withdrawData;

  const sumObj = (obj?: Record<string, number>) =>
    obj ? Object.values(obj).reduce((a, b) => a + (b || 0), 0) : 0;

  const monthsSet = new Set<string>([
    ...(dep?.months ?? []),
    ...(wit?.months ?? []),
  ]);

  return Array.from(monthsSet).sort().map(month => ({
    month,
    depositi: sumObj(dep?.perMonth?.[month]),
    prelievi: sumObj(wit?.perMonth?.[month]),
  }));
}

function computeSessioni(accessResults?: any[] | null) {
  return (accessResults ?? [])
    .filter(r => (r as any)?.nSessions > 0)
    .map(r => ({
      ip: (r as any).ip,
      country: (r as any).country,
      isp: (r as any).isp,
      nSessions: (r as any).nSessions,
    }));
}