import { useAmlExportStore } from '@/store/amlExportStore';
import { useTransactionsStore } from '@/store/transactionsStore'; // presumendo esista
import { useAccessiStore } from '@/store/accessiStore'; // presumendo esista

/**
 * Raccoglie i dati da tutti gli store (quelli già esistenti + export slice)
 * e li restituisce in un unico oggetto pronto per essere serializzato.
 */
export default function useAmlData() {
  // Slice aggiuntivi (grafici, sessioni)
  const sessioni     = useAmlExportStore(s => s.sessioniNotturne);
  const grafici      = useAmlExportStore(s => s.grafici);

  // Store già presenti in progetto
  const transazioni  = useTransactionsStore(s => s.transazioni);
  const accessi      = useAccessiStore(s => s.accessi);

  return { sessioni, transazioni, grafici, accessi };
}
