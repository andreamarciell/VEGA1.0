import { useMemo } from 'react';
import { useAmlStore } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';
import { useAmlExportStore } from '@/store/amlExportStore';

/**
 * Hook che aggrega tutti i dati da serializzare
 * nell'esportazione JSON dell'area AML.
 *
 * – Transazioni        ➜ useTransactionsStore
 * – Accessi            ➜ useAmlStore
 * – Grafici            ➜ derivati da transactionResults *oppure* slice export
 * – Sessioni Notturne  ➜ derivate da accessResults *oppure* slice export
 *
 * L'obiettivo è ottenere un oggetto completo anche se
 * l'utente non ha ancora aperto le tab “Grafici” o “Sessioni Notturne”.
 */
export default function useAmlData() {
  /* --- Slice principali già esistenti --- */
  const transactionResults = useAmlStore(s => s.transactionResults);
  const accessResults      = useAmlStore(s => s.accessResults);
  const transactionsResult = useTransactionsStore(s => s.result);

  /* --- Slice aggiuntive usate dalle view --- */
  const graficiExtra         = useAmlExportStore(s => s.grafici);
  const sessioniNotturneExtra = useAmlExportStore(s => s.sessioniNotturne);

  /* ------------------------------------------------------------------
   *  SESSIONI NOTTURNE
   *  1) Usa i dati salvati nello slice export se presenti
   *  2) Altrimenti li costruisce “on‑the‑fly” partendo da accessResults
   * ------------------------------------------------------------------ */
  const sessioni = useMemo(() => {
    if (sessioniNotturneExtra.length) return sessioniNotturneExtra;

    if (!accessResults?.length) return [];

    return accessResults
      .filter((r: any) => (r?.nSessions ?? 0) > 0)
      .map((r: any) => ({
        ip: r.ip,
        country: r.country ?? r.paese,   // country o paese a seconda del loader usato
        isp: r.isp,
        nSessions: r.nSessions,
      }));
  }, [sessioniNotturneExtra, accessResults]);

  /* ------------------------------------------------------------------
   *  GRAFICI
   *  1) Usa i dati della slice export se già popolati
   *  2) In fallback li calcola dai deposit/withdraw di transactionResults
   * ------------------------------------------------------------------ */
  const grafici = useMemo(() => {
    if (graficiExtra.length) return graficiExtra;

    if (!transactionResults) return null;

    const dep = (transactionResults as any).depositData;
    const wit = (transactionResults as any).withdrawData;

    const sumObj = (obj?: Record<string, number>) =>
      obj ? Object.values(obj).reduce((a, b) => a + (b || 0), 0) : 0;

    const monthsSet = new Set<string>([
      ...(dep?.months ?? []),
      ...(wit?.months ?? []),
    ]);

    return Array.from(monthsSet)
      .sort()
      .map(month => ({
        month,
        depositi: sumObj(dep?.perMonth?.[month]),
        prelievi: sumObj(wit?.perMonth?.[month]),
      }));
  }, [graficiExtra, transactionResults]);

  return {
    sessioni,
    transazioni: transactionsResult,
    grafici,
    accessi: accessResults,
  };
}