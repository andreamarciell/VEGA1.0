import React, { useEffect } from 'react';
import { useAmlStore } from '@/store/amlStore';

/**
 * Placeholder / wrap per la view "Grafici".
 * I dati dei grafici (serie, categorie, ecc.) vengono salvati nello store
 * ogni volta che cambiano, così da poterli esportare in JSON.
 */
const Grafici: React.FC = () => {
  /** Esempio di stato o prop esistente contenente i dati dei grafici */
  const [graficiData, setGraficiData] = React.useState<any[]>([]);

  // Setter zustand
  const setGrafici = useAmlStore(s => s.setGrafici);

  // Salva sempre l'ultima versione disponibile per l'export
  useEffect(() => {
    if (graficiData && graficiData.length) {
      setGrafici(graficiData);
    }
  }, [graficiData, setGrafici]);

  /* -------------------------
   * Rendering UI dei grafici
   * ------------------------ */
  return (
    <div>
      {/* Grafici reali… */}
    </div>
  );
};

export default Grafici;
