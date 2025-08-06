import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import useAmlData from './hooks/useAmlData';
import { exportJsonFile } from './utils/exportJson';

/**
 * Dashboard AML con nuova Tab "Esporta file".
 * Il click avvia l'esportazione dei dati in JSON senza cambiare view.
 */
const AmlDashboard: React.FC = () => {
  const amlData = useAmlData();

  /** Esporta i dati correnti in un file JSON nominato con la data odierna. */
  const handleExport = React.useCallback(() => {
    const ts = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    exportJsonFile(amlData, `toppery-aml-${ts}.json`);
  }, [amlData]);

  return (
    <Tabs defaultValue="sessioni" className="w-full">
      <TabsList>
        {/* Trigger pre­esistenti… */}

        {/* Nuova tab: avvia l'esportazione */}
        <TabsTrigger
          value="export"
          onClick={handleExport}
        >
          Esporta file
        </TabsTrigger>
      </TabsList>

      {/* TabsContent pre­esistenti (sessioni, transazioni, grafici, accessi…) */}

      {/* Nessun TabsContent per 'export' perché non serve cambiare view */}
    </Tabs>
  );
};

export default AmlDashboard;
