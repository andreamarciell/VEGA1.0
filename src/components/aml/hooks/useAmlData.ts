import { useAmlStore } from '@/store/amlStore';

/**
 * Hook centralizzato: restituisce tutti i dati AML
 * (sessioni, transazioni, grafici, accessi) in un unico oggetto.
 */
export default function useAmlData() {
  const sessioni     = useAmlStore(s => s.sessioniNotturne);
  const transazioni  = useAmlStore(s => s.transazioni);
  const grafici      = useAmlStore(s => s.grafici);
  const accessi      = useAmlStore(s => s.accessi);

  return { sessioni, transazioni, grafici, accessi };
}
