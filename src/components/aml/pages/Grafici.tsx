import React, { useEffect } from 'react';
import { useAmlExportStore } from '@/store/amlExportStore';

/**
 * View Grafici: oltre al rendering originale intercetta i dati
 * per salvarli nello slice zustand dedicato all'export JSON.
 */
const Grafici: React.FC = () => {
  const [chartData, setChartData] = React.useState<any[]>([]);

  const setGrafici = useAmlExportStore(s => s.setGrafici);

  useEffect(() => {
    if (chartData && chartData.length) {
      setGrafici(chartData);
    }
  }, [chartData, setGrafici]);

  /** Render originale (placeholder) */
  return (
    <div>{/* ...contenuto Grafici... */}</div>
  );
};

export default Grafici;
