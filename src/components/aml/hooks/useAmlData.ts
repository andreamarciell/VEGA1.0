import { useAmlStore } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';
import { useAmlExportStore } from '@/store/amlExportStore';

/**
 * Hook che raccoglie, normalizza e mette in un unico
 * oggetto tutti i dati destinati all'esportazione JSON.
 *
 * - Transazioni   ➜ useTransactionsStore             (già esistente)
 * - Accessi       ➜ useAmlStore                      (già esistente)
 * - Grafici       ➜ useAmlExportStore ▸ grafici
 * - Sessioni Notturne ➜ useAmlExportStore ▸ sessioniNotturne
 *
 * In ottica retro‑compatibilità se le slice "extra" sono vuote
 * si ricade sul meccanismo storico basato su transactionResults.
 */
export default function useAmlData() {
  /* ---------- Slice “core” già presenti ---------- */
  const transactionResults = useAmlStore(state => state.transactionResults);
  const accessResults      = useAmlStore(state => state.accessResults);
  const transactionsResult = useTransactionsStore(state => state.result);

  /* ---------- Nuove slice dedicate a export ---------- */
  const graficiExtra         = useAmlExportStore(state => state.grafici);
  const sessioniNotturneExtra = useAmlExportStore(state => state.sessioniNotturne);

  /* ---------- Normalizzazione / fallback ---------- */
  const sessioni = sessioniNotturneExtra.length
    ? sessioniNotturneExtra
    // fallback legacy
    : (transactionResults as any)?.sessions ?? [];

  const grafici = graficiExtra.length
    ? graficiExtra
    // fallback legacy
    : transactionResults ?? null;

  return {
    sessioni,
    transazioni: transactionsResult,
    grafici,
    accessi: accessResults,
  };
}
