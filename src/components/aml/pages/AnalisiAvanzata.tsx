// src/components/aml/pages/AnalisiAvanzata.tsx
/* eslint-disable */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAmlAdvancedStore } from '../../../state/amlAdvanced';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type Indicator = {
  net_flow_by_month: { month: string; deposits: number; withdrawals: number }[];
  hourly_histogram: { hour: number; count: number }[];
  method_breakdown: { method: string; pct: number }[];
  daily_flow: { day: string; deposits: number; withdrawals: number }[];
  daily_count: { day: string; count: number }[];
};
type AnalysisResult = {
  summary: string;
  risk_score: number;
  indicators: Indicator;
};

const AnalisiAvanzata: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = useAmlAdvancedStore((s) => s.result);
  const setResult = useAmlAdvancedStore((s) => s.setResult);

  // chart refs & instances
  const netFlowRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement | null>(null);
  const methodRef = useRef<HTMLCanvasElement | null>(null);
  const dailyFlowRef = useRef<HTMLCanvasElement | null>(null);
  const dailyCountRef = useRef<HTMLCanvasElement | null>(null);

  const netFlowInst = useRef<any>(null);
  const hourlyInst = useRef<any>(null);
  const methodInst = useRef<any>(null);
  const dailyFlowInst = useRef<any>(null);
  const dailyCountInst = useRef<any>(null);

  useEffect(() => {
    try {
      netFlowInst.current?.destroy();
      hourlyInst.current?.destroy();
      methodInst.current?.destroy();
      dailyFlowInst.current?.destroy();
      dailyCountInst.current?.destroy();

      if (!result?.indicators) return;
      const ind = result.indicators;

      if (netFlowRef.current && ind.net_flow_by_month?.length) {
        const labels = ind.net_flow_by_month.map(d => d.month);
        const dep = ind.net_flow_by_month.map(d => d.deposits);
        const wit = ind.net_flow_by_month.map(d => d.withdrawals);
        netFlowInst.current = new ChartJS(netFlowRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Depositi', data: dep, stack: 'flow' }, { label: 'Prelievi', data: wit, stack: 'flow' }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
      if (hourlyRef.current && ind.hourly_histogram?.length) {
        const labels = ind.hourly_histogram.map(d => d.hour);
        const cnt = ind.hourly_histogram.map(d => d.count);
        hourlyInst.current = new ChartJS(hourlyRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Volumi per ora', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
      if (methodRef.current && ind.method_breakdown?.length) {
        const labels = ind.method_breakdown.map(d => d.method);
        const cnt = ind.method_breakdown.map(d => d.pct);
        methodInst.current = new ChartJS(methodRef.current.getContext('2d')!, {
          type: 'doughnut',
          data: { labels, datasets: [{ label: '% metodo pagamento', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
      if (dailyFlowRef.current && ind.daily_flow?.length) {
        const labels = ind.daily_flow.map(d => d.day);
        const dIn = ind.daily_flow.map(d => d.deposits);
        const dOut = ind.daily_flow.map(d => d.withdrawals);
        dailyFlowInst.current = new ChartJS(dailyFlowRef.current.getContext('2d')!, {
          type: 'line',
          data: { labels, datasets: [{ label: 'Depositi', data: dIn }, { label: 'Prelievi', data: dOut }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
      if (dailyCountRef.current && ind.daily_count?.length) {
        const labels = ind.daily_count.map(d => d.day);
        const cnt = ind.daily_count.map(d => d.count);
        dailyCountInst.current = new ChartJS(dailyCountRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Conteggio transazioni', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
    }
    return () => {
      netFlowInst.current?.destroy();
      hourlyInst.current?.destroy();
      methodInst.current?.destroy();
      dailyFlowInst.current?.destroy();
      dailyCountInst.current?.destroy();
    };
  }, [result]);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const ls = localStorage.getItem('amlTransactions');
      const txs = ls ? JSON.parse(ls) : [];
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txs })
      });
      const text = await res.text();
      if (!res.ok) {
        try { const payload = JSON.parse(text); throw new Error(payload.detail || payload.code || `HTTP ${res.status}`); }
        catch { throw new Error(`HTTP ${res.status}`); }
      }
      const json = JSON.parse(text) as AnalysisResult;
      setResult(json); // <- persist to Zustand
    } catch (e: any) {
      setError(e.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }, [setResult]);

  const riskLabel = useMemo(() => {
    const v = result?.risk_score ?? 0;
    if (v >= 75) return 'ALTO';
    if (v >= 45) return 'MEDIO';
    return 'BASSO';
  }, [result]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analisi Avanzata (AI)</h2>
        <button onClick={run} disabled={loading} className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50">
          {loading ? 'analisi in corso…' : (result ? 'ricalcola' : 'esegui analisi')}
        </button>
      </div>

      <p className="text-sm text-slate-500">i dati inviati all’AI sono anonimizzati.</p>

      {result && (
        <div className="rounded-xl border p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
              rischio: {Number(result.risk_score || 0).toFixed(1)} ({riskLabel})
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">Sintesi generale</h3>
            <p className="text-sm leading-6 whitespace-pre-wrap">{result.summary}</p>
          </div>
        </div>
      )}

      {result?.indicators && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border p-4 bg-white">
              <h4 className="font-semibold mb-3">Net Flow mensile</h4>
              <canvas ref={netFlowRef} />
            </div>
            <div className="rounded-xl border p-4 bg-white">
              <h4 className="font-semibold mb-3">Distribuzione oraria</h4>
              <canvas ref={hourlyRef} />
            </div>
            <div className="rounded-xl border p-4 bg-white">
              <h4 className="font-semibold mb-3">Metodi di pagamento</h4>
              <canvas ref={methodRef} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 bg-white">
              <h4 className="font-semibold mb-3">Flusso giornaliero (depositi & prelievi)</h4>
              <canvas ref={dailyFlowRef} />
            </div>
            <div className="rounded-xl border p-4 bg-white">
              <h4 className="font-semibold mb-3">Transazioni (conteggio giornaliero)</h4>
              <canvas ref={dailyCountRef} />
            </div>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">analisi fallita: {error}</p>}
    </div>
  );
};

export default AnalisiAvanzata;
