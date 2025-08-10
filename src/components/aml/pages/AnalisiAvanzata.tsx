// src/components/aml/pages/AnalisiAvanzata.tsx
// Restore charts logic from FUNGE (Chart.js w/ 5 canvases), keep current summary behavior.
/* eslint-disable */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
// Chart.js like in FUNGE
// @ts-ignore
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type Tx = {
  ts?: string; timestamp?: string; date?: string; datetime?: string; created_at?: string;
  amount?: number | string; importo?: number | string; value?: number | string; sum?: number | string;
  dir?: 'in' | 'out' | string; direction?: 'in' | 'out' | string; type?: string;
  reason?: string; causale?: string; description?: string;
};

type AnalysisResult = { summary: string; risk_score: number };

function toISO(raw?: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function toNum(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s+/g, '');
  const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(/,/g, '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    s = s.replace(/[^0-9.-]/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function inferDir(t: Tx): 'in' | 'out' {
  let dir = (t.dir || t.direction || t.type || '').toString().toLowerCase();
  if (dir === 'in' || dir === 'deposit') return 'in';
  if (dir === 'out' || dir === 'withdraw') return 'out';
  const a = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
  if (a < 0) return 'out';
  if (a > 0) return 'in';
  const r = (t.reason || t.causale || t.description || '').toString().toLowerCase();
  if (/preliev|withdraw|cashout|payout/.test(r)) return 'out';
  return 'in';
}
function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]')
    .slice(0, 140);
}

/** Build anonymized tx payload exactly like FUNGE did (localStorage source). */
function buildAnonPayload(): { txs: { ts: string; amount: number; dir: 'in'|'out'; reason?: string }[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [] };
  try {
    const arr = JSON.parse(raw) as any[];
    const txs = arr.map((t) => {
      const ts = toISO(t?.ts || t?.timestamp || t?.date || t?.datetime || t?.created_at) || new Date().toISOString();
      const amount = toNum(t?.amount ?? t?.importo ?? t?.value ?? t?.sum ?? 0);
      const dir = inferDir(t);
      const reason = sanitizeReason(t?.reason ?? t?.causale ?? t?.description ?? '');
      return { ts, amount, dir, reason };
    }).filter(x => x && Number.isFinite(x.amount) && x.ts);
    return { txs };
  } catch {
    return { txs: [] };
  }
}

/** Daily series (fallback identical to FUNGE). */
function computeDailySeries() {
  const payload = buildAnonPayload();
  const byDay = new Map<string, { day: string; deposits: number; withdrawals: number; count: number }>();
  for (const t of payload.txs) {
    const day = t.ts.slice(0, 10);
    const rec = byDay.get(day) || { day, deposits: 0, withdrawals: 0, count: 0 };
    if (t.dir === 'out') rec.withdrawals += Math.abs(Number(t.amount) || 0);
    else rec.deposits += Math.abs(Number(t.amount) || 0);
    rec.count += 1;
    byDay.set(day, rec);
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

/** Extra helpers (client-computed when indicators non presenti): faithful to FUNGE shapes */
function computeMonthlyFlow() {
  const payload = buildAnonPayload();
  const byMonth = new Map<string, { month: string; deposits: number; withdrawals: number }>();
  for (const t of payload.txs) {
    const ym = t.ts.slice(0, 7);
    const rec = byMonth.get(ym) || { month: ym, deposits: 0, withdrawals: 0 };
    if (t.dir === 'out') rec.withdrawals += Math.abs(Number(t.amount) || 0);
    else rec.deposits += Math.abs(Number(t.amount) || 0);
    byMonth.set(ym, rec);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}
function computeHourlyHistogram() {
  const payload = buildAnonPayload();
  const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const t of payload.txs) {
    const h = new Date(t.ts).getUTCHours();
    if (Number.isFinite(h)) arr[h].count += 1;
  }
  return arr;
}
function computeMethodBreakdown() {
  const payload = buildAnonPayload();
  const buckets: Record<string, number> = { ewallet: 0, card: 0, bank: 0, bonus: 0, other: 0 };
  const rules: [string, RegExp][] = [
    ['ewallet', /(skrill|neteller|paypal|ewallet|wise|revolut)/i],
    ['card', /(visa|mastercard|amex|maestro|card|carta)/i],
    ['bank', /(bank|bonifico|iban|sepa|wire)/i],
    ['bonus', /(bonus|promo|freebet|voucher)/i]
  ];
  for (const t of payload.txs) {
    const r = t.reason || '';
    let matched = false;
    for (const [k, re] of rules) { if (re.test(r)) { buckets[k] += 1; matched = true; break; } }
    if (!matched) buckets.other += 1;
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(buckets).map(([method, count]) => ({ method, pct: Math.round((count * 1000) / total) / 10 }));
}

const AnalisiAvanzata: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // unify txs for client-computed indicators when needed
  const txs = useMemo(() => buildAnonPayload().txs, []);

  // chart refs (as in FUNGE)
  const netFlowRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement | null>(null);
  const methodRef = useRef<HTMLCanvasElement | null>(null);
  const dailyFlowRef = useRef<HTMLCanvasElement | null>(null);
  const dailyCountRef = useRef<HTMLCanvasElement | null>(null);

  // instances to destroy/recreate
  const netFlowInst = useRef<any>(null);
  const hourlyInst = useRef<any>(null);
  const methodInst = useRef<any>(null);
  const dailyFlowInst = useRef<any>(null);
  const dailyCountInst = useRef<any>(null);

  // we build an analysis-like object only for charts, matching FUNGE shapes
  const analysisForCharts = useMemo(() => {
    return {
      indicators: {
        net_flow_by_month: computeMonthlyFlow(),
        hourly_histogram: computeHourlyHistogram(),
        method_breakdown: computeMethodBreakdown()
      }
    };
  }, [txs]);

  // draw charts when analysisForCharts changes (identical sequence to FUNGE, plus daily fallback)
  useEffect(() => {
    try {
      // destroy previous before re-draw
      netFlowInst.current?.destroy();
      hourlyInst.current?.destroy();
      methodInst.current?.destroy();
      dailyFlowInst.current?.destroy();
      dailyCountInst.current?.destroy();

      const indicators = analysisForCharts?.indicators;
      if (!indicators) return;

      // Net flow by month
      if (netFlowRef.current && indicators.net_flow_by_month?.length) {
        const labels = indicators.net_flow_by_month.map(d => d.month);
        const dep = indicators.net_flow_by_month.map(d => d.deposits);
        const wit = indicators.net_flow_by_month.map(d => d.withdrawals);
        netFlowInst.current = new ChartJS(netFlowRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [
            { label: 'Depositi', data: dep, stack: 'flow' },
            { label: 'Prelievi', data: wit, stack: 'flow' },
          ]},
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }

      // Hourly histogram
      if (hourlyRef.current && indicators.hourly_histogram?.length) {
        const labels = indicators.hourly_histogram.map(d => d.hour);
        const cnt = indicators.hourly_histogram.map(d => d.count);
        hourlyInst.current = new ChartJS(hourlyRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Volumi per ora', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }

      // Method breakdown
      if (methodRef.current && indicators.method_breakdown?.length) {
        const labels = indicators.method_breakdown.map(d => d.method);
        const cnt = indicators.method_breakdown.map(d => d.pct);
        methodInst.current = new ChartJS(methodRef.current.getContext('2d')!, {
          type: 'doughnut',
          data: { labels, datasets: [{ label: '% metodo pagamento', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }

      // Daily series (fallback local like FUNGE)
      const dailyRows = computeDailySeries();
      if (dailyFlowRef.current && dailyRows.length) {
        const labels = dailyRows.map(r => r.day);
        const dIn = dailyRows.map(r => r.deposits);
        const dOut = dailyRows.map(r => r.withdrawals);
        dailyFlowInst.current = new ChartJS(dailyFlowRef.current.getContext('2d')!, {
          type: 'line',
          data: { labels, datasets: [
            { label: 'Depositi', data: dIn },
            { label: 'Prelievi', data: dOut },
          ]},
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
      if (dailyCountRef.current && dailyRows.length) {
        const labels = dailyRows.map(r => r.day);
        const counts = dailyRows.map(r => r.count);
        dailyCountInst.current = new ChartJS(dailyCountRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Conteggio transazioni', data: counts }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
    }
    // cleanup on unmount
    return () => {
      netFlowInst.current?.destroy();
      hourlyInst.current?.destroy();
      methodInst.current?.destroy();
      dailyFlowInst.current?.destroy();
      dailyCountInst.current?.destroy();
    };
  }, [analysisForCharts]);

  // -------- Existing behavior for running analysis (unchanged) --------
  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txs })
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text);
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }, [txs]);

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
          {loading ? 'Analisi in corso…' : (result ? 'ricalcola' : 'esegui analisi')}
        </button>
      </div>

      <p className="text-sm text-slate-500">i dati inviati all’AI sono anonimizzati.</p>

      {/* Summary card appears only after analysis completes */}
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

      {error && <p className="text-sm text-red-600">analisi fallita: {error}</p>}

      {/* Charts from FUNGE (always rendered; they update via Chart.js effect) */}
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
    </div>
  );
};

export default AnalisiAvanzata;
