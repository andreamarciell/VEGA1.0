
import React, { useEffect, useMemo } from 'react';
import { useAmlStore } from '@/store/amlStore';
import { useAmlExportStore } from '@/store/amlExportStore';
import { SessioneNotturna } from '@/types/aml';

/**
 * Consideriamo "sessioni notturne" gli accessi tra le 00:00 e le 06:00.
 * Il dataset di accessResults è semplificato in { ip, country, isp, date }.
 */
function isNight(dateStr: string) {
  const h = new Date(dateStr).getHours();
  return h >= 0 && h < 6;
}

const SessioniNotturne: React.FC = () => {
  const { accessResults, setSessioniNotturne } = useAmlStore(state => ({
    accessResults: state.accessResults,
    setSessioniNotturne: state.setSessioniNotturne,
  }));

  const setSessioniExport = useAmlExportStore(state => state.setSessioni);

  // Deriva dati compatti raggruppando per ip/country/isp
  const sessioniData: SessioneNotturna[] = useMemo(() => {
    const map = new Map<string, SessioneNotturna>();

    accessResults
      .filter(a => isNight(a.date))
      .forEach(a => {
        const key = `${a.ip}-${a.country}-${a.isp}`;
        const current = map.get(key) ?? { ip: a.ip, country: a.country || '', isp: a.isp || '', nSessions: 0 };
        current.nSessions += 1;
        map.set(key, current);
      });

    return Array.from(map.values());
  }, [accessResults]);

  useEffect(() => {
    setSessioniNotturne(sessioniData);
    setSessioniExport(sessioniData);
  }, [sessioniData, setSessioniNotturne, setSessioniExport]);

  return (
    <div>
      {/* UI delle sessioni notturne pre‑esistente */}
    </div>
  );
};

export default SessioniNotturne;
