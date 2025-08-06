import React, { useEffect } from 'react';
import { useAmlStore } from '@/store/amlStore';

/**
 * Placeholder / wrap della view originale "Sessioni Notturne".
 * Si assume che recuperi i dati in qualche modo – qui rappresentati da `sessioni`.
 * Dopo ogni cambio, i dati vengono propagati allo store globale.
 */
const SessioniNotturne: React.FC = () => {
  /** Esempio di stato locale esistente */
  const [sessioni, setSessioniLocal] = React.useState<any[]>([]);

  // Setter zustand
  const setSessioni = useAmlStore(s => s.setSessioni);

  // Sincronizza lo stato locale con lo store (per export JSON)
  useEffect(() => {
    if (sessioni && sessioni.length) {
      setSessioni(sessioni);
    }
  }, [sessioni, setSessioni]);

  /* -------------------------
   * Rendering UI preesistente
   * ------------------------ */
  return (
    <div>
      {/* Contenuto originale… */}
    </div>
  );
};

export default SessioniNotturne;
