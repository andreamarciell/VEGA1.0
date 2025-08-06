import React, { useEffect } from 'react';
import { useAmlStore } from '@/store/amlStore';

/**
 * View Sessioni Notturne
 * ----------------------------------------------------------------------------
 * 1. Recupera gli accessi dal main store.
 * 2. Deriva un dataset compatto delle sessioni notturne
 *    ({ ip, country, isp, nSessions }).
 * 3. Salva il dataset nello slice export.
 * ----------------------------------------------------------------------------
 * Il rendering esistente rimane invariato.
 */
const SessioniNotturne: React.FC = () => {
  const accessResults = useAmlStore(s => s.accessResults);

    const setSessioni = useAmlStore(s => s.setSessioniNotturne);

  // Estrae record con almeno una sessione
  const sessioniData = React.useMemo(
    () =>
      (accessResults ?? [])
        .filter(r => (r as any)?.nSessions > 0)
        .map(r => ({
          ip: (r as any).ip,
          country: (r as any).country,
          isp: (r as any).isp,
          nSessions: (r as any).nSessions,
        })),
    [accessResults]
  );

  useEffect(() => {
    if (sessioniData.length) {
      setSessioni(sessioniData);
    }
  }, [sessioniData, setSessioni]);

  /** Render originale (placeholder) */
  return (
    <div>{/* ...contenuto Sessioni Notturne... */}</div>
  );
};

export default SessioniNotturne;