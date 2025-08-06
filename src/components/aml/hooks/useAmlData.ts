import { useAmlStore } from '@/store/amlStore'

/**
 * Raccoglie centralmente i dati che vogliamo esportare:
 *  - Risultati transazioni
 *  - Risultati accessi
 * Aggiungere altri slice qui se in futuro verranno salvati nello store.
 */
export default function useAmlData () {
  const { transactionResults, accessResults } = useAmlStore(state => ({
    transactionResults: state.transactionResults,
    accessResults: state.accessResults
  }))

  return { transactionResults, accessResults }
}