import React, { useEffect } from 'react';
import { useAmlExportStore } from '@/store/amlExportStore';

/**
 * Wrapper leggero attorno alla view originale Sessioni Notturne.
 * Si limita a intercettare i dati (qualunque sia la loro fonte originale)
 * per salvarli nello slice zustand dedicato all'export.
 */
const SessioniNotturne: React.FC = () => {
  // Stato/dati della view originale – placeholder
  const [sessioniData, setSessioniData] = React.useState<any[]>([]);

  // Setter zustand
  const setSessioni = useAmlExportStore(s => s.setSessioni);

  useEffect(() => {
    if (sessioniData && sessioniData.length) {
      setSessioni(sessioniData);
    }
  }, [sessioniData, setSessioni]);

  /** Render originale (placeholder) */
  return (
    <div>{/* ...contenuto Sessioni Notturne... */}</div>
  );
};

export default SessioniNotturne;
