import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAmlStore } from '@/store/amlStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type TxPayload = { ts: string; amount: number; dir: 'in'|'out'; method?: string; reason?: string };

function parseNum(v: any): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]');
}

function classifyMoveStrict(reason: string): 'deposit'|'withdraw'|'cancel_withdraw'|'other' {
  const s = String(reason || '').toLowerCase();
  const hasPrelievo = /(^|\b)prelievo(\b|$)/.test(s);
  const isCancelled = /(\bannullamento\b|\bstorno\b|\brimborso\b)/.test(s);
  if (/(^|\b)(deposito|ricarica)(\b|$)/.test(s)) return 'deposit';
  if (hasPrelievo && isCancelled) return 'cancel_withdraw';
  if (hasPrelievo) return 'withdraw';
  return 'other';
}

/** Build payload from the Excel originally loaded and persisted in localStorage */

function buildAnonPayload(): { txs: TxPayload[]; gameplay?: { ts: string; amount: number; reason: string; }[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [], gameplay: [] };
  try {
    const arr = JSON.parse(raw) as any[];

    // --- existing txs pipeline (unchanged) ---
    const txs: TxPayload[] = arr.map((t) => {
      const d = new Date(t?.data ?? t?.date ?? t?.ts);
      const causale = String(t?.causale ?? t?.reason ?? '');
      const amount = parseNum(t?.importo ?? t?.amount ?? 0);
      const move = classifyMoveStrict(causale);
      const dir: 'in'|'out' = (move === 'withdraw') ? 'out' : 'in';
      return {
        ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        amount: Number.isFinite(amount) ? amount : 0,
        dir,
        method: (t?.metodo ?? t?.method ?? t?.payment_method ?? t?.paymentMethod ?? t?.tipo ?? causale),
        reason: sanitizeReason(causale),
      };
    })
    // keep ONLY deposit/withdraw/cancel_withdraw movements (we need cancellations for net sum of withdrawals)
    .filter((x) => {
      const m = classifyMoveStrict(x.reason || '');
      return m === 'deposit' || m === 'withdraw' || m === 'cancel_withdraw';
    })
    // final guard
    .filter(x => Number.isFinite(x.amount) && !!x.ts);

    // --- NEW: lightweight gameplay causali for AI (does not affect totals/charts) ---
    const gp: { ts: string; amount: number; reason: string; }[] = [];
    for (const t of arr) {
      const r = String(t?.causale ?? t?.reason ?? '');
      if (!r) continue;
      const rl = r.toLowerCase();
      // select only gameplay-related reasons (slot sessions, bets, wins)
      if (/(session\s+slot|giocata\s+scommessa|vincita\s+scommessa)/i.test(rl)) {
        const d = new Date(t?.data ?? t?.date ?? t?.ts);
        const amount = parseNum(t?.importo ?? t?.amount ?? 0);
        gp.push({
          ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
          amount: Number.isFinite(amount) ? amount : 0,
          reason: sanitizeReason(r),
        });
      }
    }

    return { txs, gameplay: gp };
  } catch {
    return { txs: [], gameplay: [] };
  }
}

// ---------------- Component: AnalisiAvanzata ----------------
export default function AnalisiAvanzata() {
  const { advancedAnalysis, setAdvancedAnalysis } = useAmlStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chart1Ref = useRef<HTMLCanvasElement | null>(null);
  const chart2Ref = useRef<HTMLCanvasElement | null>(null);
  const chart3Ref = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{c1?: any; c2?: any; c3?: any}>({});

  async function handleRun() {
    setError(null);
    setLoading(true);
    try {
      const payload = buildAnonPayload();
      if (!payload.txs || payload.txs.length === 0) {
        setError('nessuna transazione valida trovata (deposito/ricarica o prelievo)');
        return;
      }
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`analisi fallita (${res.status}): ${text.slice(0,200)}`);
      const data = JSON.parse(text);
      setAdvancedAnalysis(data);
    } catch (e:any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  // draw charts when analysis changes
  useEffect(() => {
    const a = advancedAnalysis;
    if (!a?.indicators) return;

    try {
      // destroy previous
      if (chartInstances.current.c1) { chartInstances.current.c1.destroy(); chartInstances.current.c1 = undefined; }
      if (chartInstances.current.c2) { chartInstances.current.c2.destroy(); chartInstances.current.c2 = undefined; }
      if (chartInstances.current.c3) { chartInstances.current.c3.destroy(); chartInstances.current.c3 = undefined; }

      const ctx1 = chart1Ref.current?.getContext('2d');
      if (ctx1) {
        const labels = (a.indicators.net_flow_by_month || []).map((r:any)=>r.month);
        const deps = (a.indicators.net_flow_by_month || []).map((r:any)=>r.deposits);
        const withs = (a.indicators.net_flow_by_month || []).map((r:any)=>r.withdrawals);
        chartInstances.current.c1 = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Depositi', data: deps },
              { label: 'Prelievi', data: withs },
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      const ctx2 = chart2Ref.current?.getContext('2d');
      if (ctx2) {
        const hours = (a.indicators.hourly_histogram || []).map((h:any)=>h.hour);
        const counts = (a.indicators.hourly_histogram || []).map((h:any)=>h.count);
        chartInstances.current.c2 = new Chart(ctx2, {
          type: 'line',
          data: { labels: hours, datasets: [{ label: 'Transazioni/ora', data: counts }] },
          options: { responsive: true, maintainAspectRatio: false, elements: { point: { radius: 2 } } }
        });
      }

      const ctx3 = chart3Ref.current?.getContext('2d');
      if (ctx3) {
        const md = a.indicators.method_breakdown || [];
        chartInstances.current.c3 = new Chart(ctx3, {
          type: 'doughnut',
          data: {
            labels: md.map((x:any)=>x.method),
            datasets: [{ data: md.map((x:any)=>x.pct) }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
    }
  }, [advancedAnalysis]);

  const risk = advancedAnalysis?.risk_score ?? null;
  const summary = advancedAnalysis?.summary ?? '';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button onClick={handleRun} disabled={loading}>
          {loading ? 'Analisi in corso…' : 'Esegui analisi'}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {risk !== null && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-semibold">{risk}%</div>
            <div className="text-sm uppercase px-2 py-1 rounded bg-red-100 text-red-700">alto</div>
            <div className="text-sm text-gray-500">valutazione rischio</div>
          </div>
          <p className="mt-4 text-sm leading-6">{summary}</p>
        </Card>
      )}

      {advancedAnalysis?.indicators && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 h-64">
            <div className="font-medium mb-2">Net Flow mensile</div>
            <canvas ref={chart1Ref} className="w-full h-full" />
          </Card>
          <Card className="p-4 h-64">
            <div className="font-medium mb-2">Distribuzione oraria</div>
            <canvas ref={chart2Ref} className="w-full h-full" />
          </Card>
          <Card className="p-4 h-64">
            <div className="font-medium mb-2">Metodi di pagamento</div>
            <canvas ref={chart3Ref} className="w-full h-full" />
          </Card>
        </div>
      )}
    </div>
  );
}




/** =====================
 * React component
 * ===================== */
type IndicatorNetFlow = { month: string; deposits: number; withdrawals: number };
type IndicatorHour = { hour: number; count: number };
type IndicatorMethod = { method: string; pct: number };
type AnalysisOut = {
  risk_score: number;
  summary: string;
  indicators?: {
    net_flow_by_month?: IndicatorNetFlow[];
    hourly_histogram?: IndicatorHour[];
    method_breakdown?: IndicatorMethod[];
  };
};

const AnalisiAvanzata = () => {
  const { advancedAnalysis: analysis, setAdvancedAnalysis } = useAmlStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const barRef = useRef<HTMLCanvasElement | null>(null);
  const lineRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutRef = useRef<HTMLCanvasElement | null>(null);

  const barChart = useRef<Chart | null>(null);
  const lineChart = useRef<Chart | null>(null);
  const doughnutChart = useRef<Chart | null>(null);

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = buildAnonPayload();
      if (!payload.txs || payload.txs.length === 0) {
        setError('nessuna transazione valida trovata (deposito/ricarica o prelievo)');
        return;
      }
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`analisi fallita (${res.status}): ${txt.slice(0,200)}`);
      const data = JSON.parse(txt) as AnalysisOut;
      setAdvancedAnalysis(data as any);
    } catch (e: any) {
      setError(e?.message || 'errore');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis) return;

    // Net Flow mensile (bar)
    try {
      if (barChart.current) barChart.current.destroy();
      if (barRef.current) {
        const labels = analysis.indicators?.net_flow_by_month?.map(x => x.month) ?? [];
        const dep = analysis.indicators?.net_flow_by_month?.map(x => x.deposits) ?? [];
        const wit = analysis.indicators?.net_flow_by_month?.map(x => x.withdrawals) ?? [];
        barChart.current = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Depositi', data: dep },
              { label: 'Prelievi', data: wit },
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) { console.error('[AnalisiAvanzata] bar chart error', e); }

    // Distribuzione oraria (line)
    try {
      if (lineChart.current) lineChart.current.destroy();
      if (lineRef.current) {
        const labels = (analysis.indicators?.hourly_histogram ?? []).map(x => String(x.hour).padStart(2,'0') + ':00');
        const series = (analysis.indicators?.hourly_histogram ?? []).map(x => x.count);
        lineChart.current = new Chart(lineRef.current, {
          type: 'line',
          data: { labels, datasets: [{ label: 'Transazioni/ora', data: series }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) { console.error('[AnalisiAvanzata] line chart error', e); }

    // Metodi di pagamento (doughnut)
    try {
      if (doughnutChart.current) doughnutChart.current.destroy();
      if (doughnutRef.current) {
        const labels = (analysis.indicators?.method_breakdown ?? []).map(x => x.method);
        const data = (analysis.indicators?.method_breakdown ?? []).map(x => x.pct);
        doughnutChart.current = new Chart(doughnutRef.current, {
          type: 'doughnut',
          data: { labels, datasets: [{ label: 'Metodi', data }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) { console.error('[AnalisiAvanzata] doughnut chart error', e); }
  }, [analysis]);

  return (
    <div className="space-y-6">
      <Button disabled={loading} onClick={handleRun}>
        {loading ? 'Analisi in corso…' : 'Esegui analisi'}
      </Button>

      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}

      {analysis && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-bold">{Math.round(analysis.risk_score)}%</div>
            <span className="uppercase text-sm">valutazione rischio</span>
          </div>
          <Card className="p-4 whitespace-pre-line">{analysis.summary}</Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 h-64"><canvas ref={barRef} /></Card>
            <Card className="p-4 h-64"><canvas ref={lineRef} /></Card>
            <Card className="p-4 h-64"><canvas ref={doughnutRef} /></Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisiAvanzata;
