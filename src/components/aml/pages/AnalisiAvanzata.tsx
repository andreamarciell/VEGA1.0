import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAmlStore } from '@/store/amlStore';
// chart.js
// @ts-ignore
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type Tx = { ts: string; amount: number; dir: 'in'|'out'; reason?: string; method?: string };

export default function AnalisiAvanzata() {
  const { transactions } = useAmlStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const dailyTrendRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<HTMLCanvasElement | null>(null);
  const chartRefs = useRef<{daily?: any; peaks?: any}>({});

  const txs: Tx[] = useMemo(() => {
    return (transactions || []).map((t: any) => ({
      ts: t.timestamp || t.ts || t.date,
      amount: Number(t.amount) || 0,
      dir: (t.dir || t.direction) === 'out' ? 'out' : 'in',
      method: t.method || t.paymentMethod || t.reason || 'other'
    }));
  }, [transactions]);

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txs })
      });
      if (!res.ok) {
        const j = await safeJson(res);
        throw new Error(j?.error || `http ${res.status}`);
      }
      const j = await res.json();
      setAnalysis(j);
    } catch (e:any) {
      setError(e?.message || 'errore');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!analysis) return;
    // daily trend chart
    const dailyCtx = dailyTrendRef.current?.getContext('2d');
    if (dailyCtx) {
      chartRefs.current.daily?.destroy?.();
      const daily = computeDaily(analysis.indicators);
      chartRefs.current.daily = new ChartJS(dailyCtx, {
        type: 'line',
        data: {
          labels: daily.map(d => d.date),
          datasets: [
            { label: 'Depositi', data: daily.map(d => d.deposits) },
            { label: 'Prelievi', data: daily.map(d => d.withdrawals) }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    // peaks chart
    const peaksCtx = peaksRef.current?.getContext('2d');
    if (peaksCtx) {
      chartRefs.current.peaks?.destroy?.();
      const arr = (analysis.indicators?.hourlyHistogram || []).slice().sort((a:any,b:any)=>b.count-a.count).slice(0,10).reverse();
      chartRefs.current.peaks = new ChartJS(peaksCtx, {
        type: 'bar',
        data: {
          labels: arr.map((h:any) => String(h.hour).padStart(2,'0')),
          datasets: [{ label: 'Operazioni', data: arr.map((h:any)=>h.count) }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  }, [analysis]);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-semibold">Analisi Avanzata (AI)</h3>
            <p className="text-sm text-muted-foreground">i dati inviati all’AI sono anonimizzati (timestamp, importo, direzione, causale normalizzata).</p>
          </div>
          <Button onClick={run} disabled={loading}>{loading ? 'in corso…' : 'esegui analisi ai'}</Button>
        </div>
        {error && <div className="text-sm text-red-600">analisi fallita ({error})</div>}
        {analysis && (
          <div className="space-y-4">
            {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 && (
              <ul className="list-disc pl-5">
                {analysis.recommendations.map((r:string, i:number) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {typeof analysis.summary === 'string' && analysis.summary && (
              <div className="text-sm text-muted-foreground">{analysis.summary}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-56"><canvas ref={dailyTrendRef}/></div>
              <div className="h-56"><canvas ref={peaksRef}/></div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function safeJson(res: Response) { return res.json().catch(()=>null); }

// Build a daily trend from netFlowByMonth + txs (best-effort)
function computeDaily(ind: any) {
  // If we had per-day data, use that. Otherwise, approximate from monthly split (zeros).
  const out: { date:string, deposits:number, withdrawals:number }[] = [];
  const months = ind?.netFlowByMonth || [];
  for (const m of months) {
    out.push({ date: m.month, deposits: Math.round(m.deposits || 0), withdrawals: Math.round(m.withdrawals || 0) });
  }
  return out;
}
