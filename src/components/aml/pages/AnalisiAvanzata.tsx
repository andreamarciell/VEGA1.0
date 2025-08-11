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
function buildAnonPayload(): { txs: TxPayload[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [] };
  try {
    const arr = JSON.parse(raw) as any[];
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
    return { txs };
  } catch {
    return { txs: [] };
  }
}type AnalysisOut = {
  risk_score: number;
  summary: string;
  indicators?: {
    net_flow_by_month?: { month: string; deposits: number; withdrawals: number }[];
    hourly_histogram?: { hour: number; count: number }[];
    method_breakdown?: { method: string; pct: number }[];
  };
};

export default function AnalisiAvanzata() {
  const analysis = useAmlStore(s => s.advancedAnalysis);
  const setAnalysis = useAmlStore(s => s.setAdvancedAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // chart refs
  const netFlowRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement | null>(null);
  const methodRef = useRef<HTMLCanvasElement | null>(null);
  const dailyFlowRef = useRef<HTMLCanvasElement | null>(null);
  const dailyCountRef = useRef<HTMLCanvasElement | null>(null);

  // destroy previous instances (avoid overdraw on re-render)
  const netFlowInst = useRef<any>(null);
  const hourlyInst = useRef<any>(null);
  const methodInst = useRef<any>(null);
  const dailyFlowInst = useRef<any>(null);
  const dailyCountInst = useRef<any>(null);

  const handleRun = async () => {
    try {
      setError(null);
      setLoading(true);
      const payload = buildAnonPayload();
      if (!payload.txs || payload.txs.length === 0) {
        setLoading(false);
        setError('nessuna transazione valida trovata (deposito/ricarica o prelievo)');
        return;
      }
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`analisi fallita (${res.status}): ${txt.slice(0,200)}`);
      }
      const data = await res.json() as AnalysisOut;
      setAnalysis(data);
    } catch (e:any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  function computeDailySeries() {
    const payload = buildAnonPayload();
    const byDay = new Map<string, {day: string, deposits: number, withdrawals: number, count: number}>();
    for (const t of payload.txs) {
      const day = t.ts.slice(0,10);
      const rec = byDay.get(day) || { day, deposits:0, withdrawals:0, count:0 };
      const m = classifyMoveStrict(t.reason || '');
      if (m === 'withdraw') rec.withdrawals += Math.abs(Number(t.amount)||0);
      else if (m === 'deposit') rec.deposits += Math.abs(Number(t.amount)||0);
      rec.count += 1;
      byDay.set(day, rec);
    }
    return Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));
  }

  // Render charts when analysis changes
  useEffect(() => {
    // cleanup previous
    netFlowInst.current?.destroy?.(); netFlowInst.current = null;
    hourlyInst.current?.destroy?.();  hourlyInst.current = null;
    methodInst.current?.destroy?.();  methodInst.current = null;
    dailyFlowInst.current?.destroy?.(); dailyFlowInst.current = null;
    dailyCountInst.current?.destroy?.(); dailyCountInst.current = null;

    if (!analysis?.indicators) return;
    const { net_flow_by_month = [], hourly_histogram = [], method_breakdown = [] } = analysis.indicators || {};

    // Net flow by month
    if (netFlowRef.current) {
      const ctx = netFlowRef.current.getContext('2d');
      if (ctx) {
        netFlowInst.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: net_flow_by_month.map(m => m.month),
            datasets: [
              { label: 'Depositi', data: net_flow_by_month.map(m => +(m.deposits ?? 0)) },
              { label: 'Prelievi', data: net_flow_by_month.map(m => +(m.withdrawals ?? 0)) },
            ]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }

    // Hourly histogram
    if (hourlyRef.current) {
      const ctx = hourlyRef.current.getContext('2d');
      if (ctx) {
        hourlyInst.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: hourly_histogram.map(h => String(h.hour).padStart(2,'0') + ':00'),
            datasets: [{ label: 'Transazioni/ora', data: hourly_histogram.map(h => h.count) }]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }

    // Method breakdown
    if (methodRef.current) {
      const ctx = methodRef.current.getContext('2d');
      if (ctx) {
        methodInst.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: method_breakdown.map(m => m.method),
            datasets: [{ label: '%', data: method_breakdown.map(m => m.pct) }]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }

    // Daily series charts (client-side from original Excel payload)
    const dailyRows = computeDailySeries();
    if (dailyFlowRef.current && dailyRows.length) {
      const ctx2 = dailyFlowRef.current.getContext('2d');
      if (ctx2) {
        dailyFlowInst.current = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: dailyRows.map(r => r.day),
            datasets: [
              { label: 'Depositi', data: dailyRows.map(r => r.deposits) },
              { label: 'Prelievi', data: dailyRows.map(r => r.withdrawals) },
            ]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }
    if (dailyCountRef.current && dailyRows.length) {
      const ctx3 = dailyCountRef.current.getContext('2d');
      if (ctx3) {
        dailyCountInst.current = new Chart(ctx3, {
          type: 'bar',
          data: {
            labels: dailyRows.map(r => r.day),
            datasets: [{ label: 'Conteggio transazioni', data: dailyRows.map(r => r.count) }]
          },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }
  }, [analysis]);

  const riskPct = useMemo(() => {
    if (!analysis) return 0;
    let s = Number(analysis.risk_score || 0);
    if (s <= 1) s = s * 100; // tolerate 0–1 inputs
    return s;
  }, [analysis]);

  const level = useMemo(() => {
    const s = riskPct;
    if (s < 30) return { text: 'basso', className: 'bg-green-500/10 text-green-600' };
    if (s < 60) return { text: 'medio', className: 'bg-yellow-500/10 text-yellow-600' };
    return { text: 'alto', className: 'bg-red-500/10 text-red-600' };
  }, [riskPct]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button disabled={loading} onClick={handleRun}>
          {loading ? 'Analisi in corso…' : 'Esegui analisi'}
        </Button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>

      {analysis && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{riskPct.toFixed(0)}%</div>
            <div className={`px-2 py-1 rounded ${level?.className ?? ''}`}>{level?.text}</div>
            <div className="text-sm text-muted-foreground">valutazione rischio</div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Dettaglio attività (AI)</h4>
            <p className="text-sm leading-6 whitespace-pre-wrap">{analysis.summary}</p>
          </div>
        </Card>
      )}

      {analysis?.indicators && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Net Flow mensile</h4><canvas ref={netFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Distribuzione oraria</h4><canvas ref={hourlyRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Metodi di pagamento</h4><canvas ref={methodRef} /></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Andamento giornaliero (depositi & prelievi)</h4><canvas ref={dailyFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Attività giornaliera (conteggio transazioni)</h4><canvas ref={dailyCountRef} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
