
import React from 'react';
import { useAmlStore } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';

/**
 * Raccoglie e normalizza i dati necessari per l'esportazione JSON dalle varie store Zustand.
 */
export default function useAmlData() {
  // Slice principale AML
  const {
    grafici,
    sessioniNotturne,
    accessResults,
    transactionResults,
  } = useAmlStore(state => ({
    grafici:            state.grafici,
    sessioniNotturne:   state.sessioniNotturne,
    accessResults:      state.accessResults,
    transactionResults: state.transactionResults,
  }));

  // Risultati dell'analisi transazioni (tab Transazioni)
  const transactionsResult = useTransactionsStore(state => state.result);

  /** 
   * Fallback:
   * Se l'utente non ha ancora visitato la tab Grafici / Sessioni Notturne,
   * deriviamo i dataset on‑the‑fly a partire dai risultati già presenti
   * così da non esportare mai valori vuoti.
   */
  const derivedGrafici = React.useMemo(() => {
    if (grafici.length || !transactionResults) return grafici;

    const dep = transactionResults?.depositData;
    const wit = transactionResults?.withdrawData;
    const sumObj = (obj: Record<string, number> | undefined) =>
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
  }, [grafici, transactionResults]);

  const derivedSessioni = sessioniNotturne;

  return {
    sessioni:     derivedSessioni,
    transazioni:  transactionsResult,
    grafici:      derivedGrafici,
    accessi:      accessResults,
  };
}
