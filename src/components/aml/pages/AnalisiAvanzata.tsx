import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAmlStore } from '@/store/amlStore';
// @ts-ignore
import { Chart, registerables, Chart as ChartJS } from 'chart.js';
Chart.register(...registerables);

type TxPayload = { ts: string; amount: number; dir: 'in'|'out'; reason?: string };

function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]')
    .slice(0, 140);
}

function buildAnonPayload(): { txs: TxPayload[] } {
  // Preferisci i dati salvati dal caricamento iniziale della pagina
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [] };
  try {
    const arr = JSON.parse(raw) as any[];
    const txs: TxPayload[] = arr.map((t) => {
      const d = new Date(t?.data ?? t?.date ?? t?.ts);
      const causale = String(t?.causale ?? t?.reason ?? '');
      const amount = Number(t?.importo ?? t?.amount ?? 0);
      const norm = causale.toLowerCase();
      const dir: 'in'|'out' = norm.includes('preliev') ? 'out' : 'in';
      return {
        ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        amount: Number.isFinite(amount) ? amount : 0,
        dir,
        reason: sanitizeReason(causale),
      };
    }).filter(x => Number.isFinite(x.amount) && x.ts);
    return { txs };
  } catch {
    return { txs: [] };
  }
}

export default function AnalisiAvanzata() {
  const analysis = useAmlStore(s => s.advancedAnalysis);
  const setAnalysis = useAmlStore(s => s.setAdvancedAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // chart refs
  const netFlowRef = useRef<HTMLCanvasElement>(null);
  const netFlowInst = useRef<ChartJS | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement>(null);
  const hourlyInst = useRef<ChartJS | null>(null);
  const methodRef = useRef<HTMLCanvasElement>(null);
  const methodInst = useRef<ChartJS | null>(null);

  useEffect(() => {
    // (re)draw charts on analysis change
    if (!analysis) return;
    // destroy previous
    netFlowInst.current?.destroy();
    hourlyInst.current?.destroy();
    methodInst.current?.destroy();

    if (netFlowRef.current && analysis.indicators?.net_flow_by_month?.length) {
      const labels = analysis.indicators.net_flow_by_month.map(d => d.month);
      const dep = analysis.indicators.net_flow_by_month.map(d => d.deposits);
      const wit = analysis.indicators.net_flow_by_month.map(d => d.withdrawals);
      netFlowInst.current = new ChartJS(netFlowRef.current.getContext('2d')!, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Depositi', data: dep, stack: 'flow' },
            { label: 'Prelievi', data: wit, stack: 'flow' },
          ]
        },
        options: { responsive: true, plugins: { legend: { display: true } } }
      });
    }

    if (hourlyRef.current && analysis.indicators?.hourly_histogram?.length) {
      const labels = analysis.indicators.hourly_histogram.map(d => String(d.hour).padStart(2,'0'));
      const cnt = analysis.indicators.hourly_histogram.map(d => d.count);
      hourlyInst.current = new ChartJS(hourlyRef.current.getContext('2d')!, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Volumi per ora', data: cnt }] },
        options: { responsive: true, plugins: { legend: { display: true } } }
      });
    }

    if (methodRef.current && analysis.indicators?.method_breakdown?.length) {
      const labels = analysis.indicators.method_breakdown.map(d => d.method);
      const cnt = analysis.indicators.method_breakdown.map(d => d.pct);
      methodInst.current = new ChartJS(methodRef.current.getContext('2d')!, {
        type: 'doughnut',
        data: { labels, datasets: [{ label: '% metodo pagamento', data: cnt }] },
        options: { responsive: true, plugins: { legend: { display: true } } }
      });
    }
  }, [analysis]);

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = buildAnonPayload();
      if (!payload.txs.length) {
        throw new Error('nessuna transazione disponibile: carica il file excel nella pagina principale.');
      }
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`analisi fallita (${res.status})`);
      }
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const level = useMemo(() => {
    if (!analysis) return null;
    const s = analysis.risk_score;
    if (s >= 75) return { text: 'ALTO', className: 'bg-red-500 text-white' };
    if (s >= 40) return { text: 'MEDIO', className: 'bg-yellow-500 text-black' };
    return { text: 'BASSO', className: 'bg-green-500 text-white' };
  }, [analysis]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold">Analisi Avanzata (AI)</h3>
            <p className="text-sm text-muted-foreground">
              i dati inviati all'AI sono anonimizzati (timestamp, importo, direzione, causale normalizzata).
            </p>
          </div>
          <Button onClick={handleRun} disabled={loading} variant="default">
            {loading ? 'analizzando...' : (analysis ? 'ricalcola' : 'esegui analisi ai')}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </Card>

      {analysis && (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${level?.className || ''}`}>
                rischio: {analysis.risk_score.toFixed(1)} {level?.text ? `(${level.text})` : ''}
              </div>
              <div className="text-sm text-muted-foreground">flags: {analysis.flags?.length || 0}</div>
            </div>

            {analysis.flags?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Flags</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.flags.map((f, i) => (
                    <li key={i}><span className="font-mono uppercase">{f.severity}</span> – <b>{f.code}</b>: {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Raccomandazioni</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Net Flow mensile</h4><canvas ref={netFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Distribuzione oraria</h4><canvas ref={hourlyRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Metodi di pagamento</h4><canvas ref={methodRef} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
