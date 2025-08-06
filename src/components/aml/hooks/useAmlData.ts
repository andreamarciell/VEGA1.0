import { useAmlStore } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';

/**
 * Raccoglie e normalizza i dati necessari per l'esportazione JSON dalle varie store Zustand.
 */
export default function useAmlData() {
  // Dati salvati nella store AML (grafici, accessi, ecc.)
  const transactionResults = useAmlStore(state => state.transactionResults);
  const accessResults      = useAmlStore(state => state.accessResults);

  // Risultati dell'analisi transazioni (tab Transazioni)
  const transactionsResult = useTransactionsStore(state => state.result);

  // Sessioni notturne possono essere incluse nei risultati se presenti,
  // altrimenti restituire array vuoto in modo safe.
  const sessioni = (transactionResults as any)?.sessions ?? [];

  // I grafici fanno riferimento ai dati consolidati contenuti in transactionResults.
  const grafici = transactionResults ?? null;

  return {
    sessioni,
    transazioni: transactionsResult,
    grafici,
    accessi: accessResults,
  };
}
