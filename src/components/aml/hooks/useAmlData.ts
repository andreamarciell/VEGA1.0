import { useAmlStore, TransactionResults } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';
import { useAmlExportStore } from '@/store/amlExportStore';


/**
 * Hook che raccoglie, normalizza e mette in un unico
 * oggetto tutti i dati destinati all'esportazione JSON.
 *
 * - Transazioni        ➜ useTransactionsStore
 * - Accessi            ➜ useAmlStore
 * - Grafici            ➜ useAmlExportStore ▸ grafici (o fallback derive)
 * - Sessioni Notturne  ➜ useAmlExportStore ▸ sessioniNotturne (o fallback derive)
 */
export default function useAmlData() {
  /* ---------- Slice “core” già presenti ---------- */
  const transactionResults = useAmlStore(state => state.transactionResults);
  const accessResults      = useAmlStore(state => state.accessResults);
  const transactionsResult = useTransactionsStore(state => state.result);

  /* ---------- Nuove slice dedicate a export ---------- */
  const graficiExtra          = useAmlExportStore(state => state.grafici);
  const sessioniNotturneExtra = useAmlExportStore(state => state.sessioniNotturne);

  /* ---------- Normalizzazione / fallback ---------- */
  const sessioni = sessioniNotturneExtra.length
    ? sessioniNotturneExtra
    : computeSessioni((accessResults && accessResults.length ? accessResults : (transactionResults as any)?.sessions) ?? []);

  const grafici = graficiExtra.length
    ? graficiExtra
    : computeGrafici(transactionResults);

  return {
    sessioni,
    transazioni: transactionsResult,
    grafici,
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