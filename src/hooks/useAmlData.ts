
import { useAmlExportStore } from '@/store/amlExportStore';
import { useAmlStore } from '@/store/amlStore';

/**
 * Hook che colleziona tutti i dati pronti per l'esportazione JSON.
 */
export default function useAmlData() {
  const { grafici, sessioniNotturne } = useAmlExportStore(state => ({
    grafici: state.grafici,
    sessioniNotturne: state.sessioniNotturne,
  }));

  const { transactionResults, accessResults } = useAmlStore(state => ({
    transactionResults: state.transactionResults,
    accessResults: state.accessResults,
  }));

  return {
    grafici,
    sessioniNotturne,
    transazioni: transactionResults,
    accessi: accessResults,
  };
}
