import { useAmlStore, TransactionResults } from '@/store/amlStore';


/**
 * Hook che raccoglie, normalizza e mette in un unico
 * oggetto tutti i dati destinati all'esportazione JSON.
 *
 * - Transazioni        ➜ useTransactionsStore
 * - Accessi            ➜ useAmlStore
 */
export default function useAmlData() {
  /* ---------- Slice “core” già presenti ---------- */
  const transactionResults = useAmlStore(state => state.transactionResults);
  const accessResults      = useAmlStore(state => state.accessResults);
  /* ---------- Slice extra: grafici + sessioniNotturne ---------- */
  const { grafici: graficiExtra, sessioniNotturne: sessioniNotturneExtra } =
    useAmlStore(s => ({ grafici: s.grafici, sessioniNotturne: s.sessioniNotturne }));
  
  /* ---------- Nuove slice dedicate a export ---------- */

  /* ---------- Normalizzazione / fallback ---------- */
  const sessioni = sessioniNotturneExtra.length
    ? sessioniNotturneExtra
    : computeSessioni(accessResults);

  const grafici = graficiExtra.length
    ? graficiExtra
    : computeGrafici(transactionResults as any);

  return {
    grafici,
    sessioniNotturne: sessioni,
    transazioni: transactionResults,
    accessi: accessResults,
  };
}


// -----------------------------------------------------------------------------
// Helper per derivare i dataset "Grafici" e "Sessioni Notturne" anche quando
// l’utente non ha ancora aperto le rispettive tab. In questo modo i dati vengono
// sempre inclusi nell’esportazione JSON.
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