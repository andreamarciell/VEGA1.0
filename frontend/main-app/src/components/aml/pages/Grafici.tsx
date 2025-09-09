import React, { useEffect } from 'react';
import { useAmlStore } from '@/store/amlStore';

/**
 * View Grafici
 * ----------------------------------------------------------------------------
 * 1. Recupera i risultati transazioni dal main store.
 * 2. Deriva in modo lightweight i dati per i grafici (totale depositi/prelievi ✕ mese).
 * 3. Salva il dataset nello slice zustand ad hoc così che compaia nell’export.
 * ----------------------------------------------------------------------------
 * NB: Non altera il rendering originale – continua a mostrare il contenuto
 *     esistente (commentato qui in placeholder).
 */
const Grafici: React.FC = () => {
  const { transactionResults } = useAmlStore(state => ({
    transactionResults: state.transactionResults
  }));

  const setGrafici = useAmlStore(s => s.setGrafici);

  // Dato derivato per il grafico: un array di
  // { month: 'YYYY‑MM', depositi: number, prelievi: number }
  const chartData = React.useMemo(() => {
    if (!transactionResults) return [];

    const dep = transactionResults.depositData;
    const wit = transactionResults.withdrawData;

    // Helper che somma i valori di un oggetto numerico
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
  }, [transactionResults]);

  // Aggiorna slice export appena i dati sono disponibili
  useEffect(() => {
    if (chartData.length) {
      setGrafici(chartData);
    }
  }, [chartData, setGrafici]);

  /** Render originale (placeholder) */
  return (
    <div>{/* ...contenuto Grafici... */}</div>
  );
};

export default Grafici;