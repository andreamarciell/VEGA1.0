
import React, { useEffect, useMemo } from 'react';
import { useAmlStore } from '@/store/amlStore';
import { useAmlExportStore } from '@/store/amlExportStore';
import { Grafico } from '@/types/aml';

const Grafici: React.FC = () => {
  const { transactionResults, setGrafici } = useAmlStore(state => ({
    transactionResults: state.transactionResults,
    setGrafici: state.setGrafici,
  }));

  const setGraficiExport = useAmlExportStore(state => state.setGrafici);

  // Deriva i dati dei grafici dal risultato transazioni
  const chartData: Grafico[] = useMemo(() => {
    if (!transactionResults) return [];

    const months = new Set<string>([
      ...(transactionResults.depositData?.months ?? []),
      ...(transactionResults.withdrawData?.months ?? []),
    ]);

    const sumObj = (obj?: Record<string, number>) =>
      obj ? Object.values(obj).reduce((acc, v) => acc + (v || 0), 0) : 0;

    return Array.from(months).sort().map(month => ({
      month,
      depositi: sumObj(transactionResults.depositData?.perMonth?.[month]),
      prelievi: sumObj(transactionResults.withdrawData?.perMonth?.[month]),
    }));
  }, [transactionResults]);

  useEffect(() => {
    if (chartData.length) {
      setGrafici(chartData);
      setGraficiExport(chartData);
    }
  }, [chartData, setGrafici, setGraficiExport]);

  return (
    <div>
      {/* UI dei grafici pre‑esistente */}
    </div>
  );
};

export default Grafici;
