import React, { useEffect } from 'react';
import { useAmlStore } from '@/store/amlStore';

/**
 * View "Accessi" aggiornata con gestione più sicura dei dati
 * e sincronizzazione allo store globale.
 */
const Accessi: React.FC = () => {
  // Dati attuali nello store (fallback a [] per evitare undefined.length)
  const accessiData    = useAmlStore(s => s.accessi) ?? [];
  const setAccessi     = useAmlStore(s => s.setAccessi);

  /** Se la pagina usa un proprio stato/fetch, sostituire questo mock. */
  const [localAccessi, setLocalAccessi] = React.useState<any[]>(accessiData);

  // Sync locale -> store
  useEffect(() => {
    if (localAccessi && localAccessi.length) {
      setAccessi(localAccessi);
    }
  }, [localAccessi, setAccessi]);

  /* -----------
   * Render view
   * ----------- */
  if (!accessiData.length) {
    return <p className="text-center text-sm text-muted-foreground py-8">Nessun accesso registrato.</p>;
  }

  return (
    <div className="space-y-4">
      {/* UI reale della tab Accessi */}
    </div>
  );
};

export default Accessi;
