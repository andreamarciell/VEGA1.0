import { useSelector } from 'react-redux';
import { RootState } from '@/store';

/**
 * Hook che restituisce in un solo oggetto tutti i dati usati dalle view AML
 * in modo che possano essere serializzati/esportati come JSON.
 */
export default function useAmlData() {
  const sessioni = useSelector((s: RootState) => s.aml.sessioniNotturne);
  const transazioni = useSelector((s: RootState) => s.aml.transazioni);
  const grafici     = useSelector((s: RootState) => s.aml.grafici);
  const accessi     = useSelector((s: RootState) => s.aml.accessi);

  return { sessioni, transazioni, grafici, accessi };
}
