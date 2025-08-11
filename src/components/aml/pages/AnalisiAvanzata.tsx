import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAmlStore } from '@/store/amlStore';
// @ts-ignore
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);
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


/** robust number parser: supports "671.95", "671,95", "1.234,56", "1,234.56", currency symbols */
function parseNum(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s+/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
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

function classifyMethod(reason: string = ''): string {
  const s = String(reason).toLowerCase();
  if (/visa|mastercard|amex|maestro|carta|card/.test(s)) return 'card';
  if (/sepa|bonifico|bank|iban/.test(s)) return 'bank';
  if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) return 'ewallet';
  if (/crypto|btc|eth|usdt|usdc/.test(s)) return 'crypto';
  if (/paysafecard|voucher|coupon/.test(s)) return 'voucher';
  if (/bonus|promo/.test(s)) return 'bonus';
  return 'other';
}

function computeIndicatorsFromTxs(txs: TxPayload[]) {
  const monthMap = new Map<string, { month: string; deposits: number; withdrawals: number }>();
  txs.forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    const month = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const rec = monthMap.get(month) || { month, deposits: 0, withdrawals: 0 };
    if (t.dir === 'out') rec.withdrawals += Math.abs(Number(t.amount)||0);
    else rec.deposits += Math.abs(Number(t.amount)||0);
    monthMap.set(month, rec);
  });
  const net_flow_by_month = Array.from(monthMap.values()).sort((a,b)=>a.month.localeCompare(b.month));

  const hourly: { hour: number; count: number }[] = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
  txs.forEach(t => {
    const d = new Date(t.ts);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      if (h>=0 && h<24) hourly[h].count++;
    }
  });

  const counts: Record<string, number> = {};
  txs.forEach(t => {
    const m = classifyMethod(t.reason || '');
    counts[m] = (counts[m]||0)+1;
  });
  const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
  const method_breakdown = Object.entries(counts).map(([method,c]) => ({ method, pct: +(100*c/total).toFixed(2) }));

  return { net_flow_by_month, hourly_histogram: hourly, method_breakdown };
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
      let amount = parseNum(t?.importo ?? t?.amount ?? 0);
      const norm = causale.toLowerCase();
      let dir: 'in'|'out' = norm.includes('preliev') ? 'out' : 'in';
      if (Number.isFinite(amount) && amount < 0) { dir = 'out'; amount = Math.abs(amount); }
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
  const dailyFlowRef = useRef<HTMLCanvasElement>(null);
  const dailyFlowInst = useRef<ChartJS | null>(null);
  const dailyCountRef = useRef<HTMLCanvasElement>(null);
  const dailyCountInst = useRef<ChartJS | null>(null);
  const methodInst = useRef<ChartJS | null>(null);

  function computeDailySeries() {
    const payload = buildAnonPayload();
    const byDay = new Map<string, {day: string, deposits: number, withdrawals: number, count: number}>();
    for (const t of payload.txs) {
      const day = t.ts.slice(0,10);
      const rec = byDay.get(day) || { day, deposits:0, withdrawals:0, count:0 };
      if (t.dir === 'out') rec.withdrawals += Math.abs(Number(t.amount)||0);
      else rec.deposits += Math.abs(Number(t.amount)||0);
      rec.count += 1;
      byDay.set(day, rec);
    }
    const rows = Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));
    return rows;
  }

  
  useEffect(() => {
    /* CHART GUARD */
    try {
      // (re)draw charts on analysis change
      if (!analysis) return;

      // destroy previous
      netFlowInst.current?.destroy();
      hourlyInst.current?.destroy();
      methodInst.current?.destroy();
      dailyFlowInst.current?.destroy();
      dailyCountInst.current?.destroy();

      // Net flow by month
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

      // Hourly histogram
      if (hourlyRef.current && analysis.indicators?.hourly_histogram?.length) {
        const labels = analysis.indicators.hourly_histogram.map(d => String(d.hour).padStart(2,'0'));
        const cnt = analysis.indicators.hourly_histogram.map(d => d.count);
        hourlyInst.current = new ChartJS(hourlyRef.current.getContext('2d')!, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Volumi per ora', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }

      // Method breakdown
      if (methodRef.current && analysis.indicators?.method_breakdown?.length) {
        const labels = analysis.indicators.method_breakdown.map(d => d.method);
        const cnt = analysis.indicators.method_breakdown.map(d => d.pct);
        methodInst.current = new ChartJS(methodRef.current.getContext('2d')!, {
          type: 'doughnut',
          data: { labels, datasets: [{ label: '% metodo pagamento', data: cnt }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }

      // Daily trends (depositi & prelievi) + daily activity count
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
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }

    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
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
      // fill charts if model skipped them
      if (!data.indicators || !data.indicators.net_flow_by_month?.length || !data.indicators.hourly_histogram?.length || !data.indicators.method_breakdown?.length) {
        const fb = computeIndicatorsFromTxs(payload.txs);
        data.indicators = { ...(data.indicators||{}), ...fb };
      }
      setAnalysis(data);
    } catch (e: any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const riskPct = useMemo(() => {
    if (!analysis) return 0;
    let s = Number(analysis.risk_score || 0);
    if (s <= 1) s = s * 100;
    return s;
  }, [analysis]);

  const level = useMemo(() => {
    if (!analysis) return null;
    const s = riskPct;
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
              i dati inviati all'AI sono anonimizzati.
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
                rischio: {riskPct.toFixed(1)} {level?.text ? `(${level.text})` : ''}
              </div>
              <div className="text-sm text-muted-foreground">flags: {analysis.flags?.length || 0}</div>
            </div>

            {
              <div>
                <h4 className="font-medium mb-2">Flags</h4>
                {analysis.flags?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {analysis.flags.map((f, i) => (
                      <li key={i}><span className="font-mono uppercase">{f.severity}</span> – <b>{f.code}</b>: {f.reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">nessun flag rilevato</p>
                )}
              </div>
            }

            {analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Raccomandazioni</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
                </ul>
              </div>
            )}
            {analysis.summary && (
              <div>
                <h4 className="font-medium mb-2">Sintesi generale</h4>
                <p className="text-sm leading-6">{analysis.summary}</p>
              </div>
            )}

          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Net Flow mensile</h4><canvas ref={netFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Distribuzione oraria</h4><canvas ref={hourlyRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Metodi di pagamento</h4><canvas ref={methodRef} /></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Trend giornaliero (depositi & prelievi)</h4><canvas ref={dailyFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Picchi attività (conteggio giornaliero)</h4><canvas ref={dailyCountRef} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
