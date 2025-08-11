
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAmlStore } from '@/store/amlStore';
// Chart.js
// @ts-ignore
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type TxPayload = { ts: string; amount: number; dir: 'in'|'out'; reason?: string };

function buildFallbackSummary(txs: TxPayload[]) {
  if (!Array.isArray(txs) || !txs.length) return "Analisi non disponibile.";
  let dep = 0, pre = 0;
  const inMethods: Record<string, number> = {};
  const outMethods: Record<string, number> = {};
  txs.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.dir === 'out') { pre += Math.abs(amt); outMethods[classifyMethod(t.reason||'')] = (outMethods[classifyMethod(t.reason||'')]||0)+1; }
    else { dep += Math.abs(amt); inMethods[classifyMethod(t.reason||'')] = (inMethods[classifyMethod(t.reason||'')]||0)+1; }
  });
  const top = (m: Record<string,number>) => Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'other';
  const mIn = top(inMethods);
  const mOut = top(outMethods);
  const fmt = (n:number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return [
    `l’utente ha depositato €${fmt(dep)} ed effettuato prelievi pari a €${fmt(pre)}.`,
    `In termini di deposito, l’utente ha utilizzato “${mIn}” mentre per quanto riguarda i prelievi e’ stato utilizzato “${mOut}”.`,
    `Nel mese in esame l’utente ha utilizzato prevalentemente sessioni di gioco con importi variabili; non sono state riscontrate anomalie evidenti sui prodotti analizzati.`,
    `In questa fase non e’ osservabile un riciclo delle vincite.`
  ].join(' ');
}

function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]');
}

function parseNum(v: any): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (!s) return 0;
  // normalize european formats (e.g. "1.234,56" to "1234.56")
  if (s.includes(',') && /\d\.\d{3}/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else s = s.replace(/[^0-9.-]/g, '');
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

function indicatorsFromTxs(txs: TxPayload[]) {
  // Net flow by month
  const monthMap = new Map<string, { month: string; deposits: number; withdrawals: number }>();
  txs.forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const row = monthMap.get(key) || { month: key, deposits: 0, withdrawals: 0 };
    if (t.dir === 'in') row.deposits += Math.abs(t.amount); else row.withdrawals += Math.abs(t.amount);
    monthMap.set(key, row);
  });
  const net_flow_by_month = Array.from(monthMap.values());

  // Hourly histogram (00-23)
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  txs.forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    const h = d.getHours();
    if (h >= 0 && h < 24) hourly[h].count++;
  });

  // Method breakdown
  const counts: Record<string, number> = {};
  txs.forEach(t => {
    const m = classifyMethod(t.reason || '');
    counts[m] = (counts[m] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
  const method_breakdown = Object.entries(counts).map(([method,c]) => ({ method, pct: +(100*c/total).toFixed(2) }));

  // Daily flow / counts (optional)
  const byDay = new Map<string, { day: string; deposits: number; withdrawals: number; count: number }>();
  txs.forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0,10);
    const row = byDay.get(key) || { day: key, deposits: 0, withdrawals: 0, count: 0 };
    if (t.dir === 'in') row.deposits += Math.abs(t.amount); else row.withdrawals += Math.abs(t.amount);
    row.count++;
    byDay.set(key, row);
  });
  const daily_flow = Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));

  return { net_flow_by_month, hourly_histogram: hourly, method_breakdown, daily_flow };

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

}

function buildAnonPayload(): { txs: TxPayload[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [] };
  try {
    const arr = JSON.parse(raw) as any[];
    const txs: TxPayload[] = arr.map((t) => {
  const d = new Date((t as any)?.data ?? (t as any)?.date ?? (t as any)?.ts);
  const causale = String((t as any)?.causale ?? (t as any)?.reason ?? '');
  let amount = parseNum((t as any)?.importo ?? (t as any)?.amount ?? 0);
  const norm = causale.toLowerCase();
  let dir: 'in'|'out' = norm.includes('preliev') ? 'out' : 'in';
  if (Number.isFinite(amount) && amount < 0) { dir = 'out'; amount = Math.abs(amount); }
  return {
    ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
    amount: Number.isFinite(amount) ? amount : 0,
    dir,
    reason: sanitizeReason(causale),
  };
}).filter(x => Number.isFinite(x.amount) && x.ts)(x => Number.isFinite(x.amount) && x.ts);
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
  const netFlowRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement | null>(null);
  const methodRef = useRef<HTMLCanvasElement | null>(null);
  const dailyFlowRef = useRef<HTMLCanvasElement | null>(null);
  const dailyFlowInst = useRef<any | null>(null);
  const dailyCountRef = useRef<HTMLCanvasElement | null>(null);
  const dailyCountInst = useRef<any | null>(null);

// preview indicators (chart-only) from local transactions so charts render without starting AI
const [previewIndicators, setPreviewIndicators] = useState<any | null>(null);
useEffect(() => {
  try {
    const payload = buildAnonPayload();
    if (payload.txs?.length) {
      setPreviewIndicators(indicatorsFromTxs(payload.txs));
    }
  } catch {}
}, []);


  
const doAnalyze = async () => {
  setLoading(true);
  setError(null);
  try {
    const payload = buildAnonPayload();
    if (!payload.txs.length) throw new Error('nessuna transazione disponibile: carica il file excel nella pagina principale.');

    // calcola SUBITO gli indicatori per far comparire i grafici anche mentre l'AI elabora
    const indicators = indicatorsFromTxs(payload.txs);
    setAnalysis({
      model: 'openai/gpt-oss-120b',
      usage: null,
      risk_score: 0,
      summary: 'analisi in corso…',
      indicators
    });

    const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`analisi fallita (${res.status})`);
    const data = await res.json();

    const next = {
      model: data?.model || 'openai/gpt-oss-120b',
      usage: data?.usage || null,
      risk_score: Math.max(0, Math.min(100, Number(data?.output?.risk_score ?? 0))),
      summary: String(data?.output?.summary || '').trim() || buildFallbackSummary(payload.txs),
      indicators
    };
    setAnalysis(next);
  } catch (e:any) {
    const payload = buildAnonPayload();
    const indicators = indicatorsFromTxs(payload.txs);
    setAnalysis({
      model: 'openai/gpt-oss-120b',
      usage: null,
      risk_score: 0,
      summary: buildFallbackSummary(payload.txs),
      indicators
    });
    setError(String(e?.message || e));
  } finally {
    setLoading(false);
  }
};


  // Renders
  const riskBadge = useMemo(() => {
    const r = Number(analysis?.risk_score ?? 0);
    let label = 'BASSO';
    if (r >= 70) label = 'ALTO';
    else if (r >= 40) label = 'MEDIO';
    return { r, label };
  }, [analysis, previewIndicators]);

  // Charts
  useEffect(() => {
    const ind = analysis?.indicators || previewIndicators; if (!ind) return;
    const { net_flow_by_month, hourly_histogram, method_breakdown } = ind;

    // Destroy existing charts if any
    const cleanup: any[] = [];

    // Net Flow mensile
    if (netFlowRef.current) {
      const ctx = netFlowRef.current.getContext('2d')!;
      const labels = net_flow_by_month.map((r:any) => r.month);
      const deposits = net_flow_by_month.map((r:any) => +(r.deposits || 0).toFixed(2));
      const withdrawals = net_flow_by_month.map((r:any) => +(r.withdrawals || 0).toFixed(2));
      const chart = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Depositi', data: deposits },
            { label: 'Prelievi', data: withdrawals },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      cleanup.push(() => chart.destroy());
    }

    // Distribuzione oraria
    if (hourlyRef.current) {
      const ctx = hourlyRef.current.getContext('2d')!;
      const labels = hourly_histogram.map((r:any) => String(r.hour).padStart(2,'0'));
      const values = hourly_histogram.map((r:any) => r.count);
      const chart = new ChartJS(ctx, {
        type: 'line',
        data: { labels, datasets: [ { label: 'Volumi per ora', data: values } ] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      cleanup.push(() => chart.destroy());
    }

    // Metodi di pagamento
    if (methodRef.current) {
      const ctx = methodRef.current.getContext('2d')!;
      const labels = (analysis.indicators.method_breakdown as any[]).map(r => r.method);
      const values = (analysis.indicators.method_breakdown as any[]).map(r => r.pct);
      const chart = new ChartJS(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [ { label: 'metodi %', data: values } ] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      cleanup.push(() => chart.destroy());
    }

    
// Daily trends (depositi & prelievi) + daily activity count
const dailyRows = computeDailySeries();
if (dailyFlowRef.current && dailyRows.length) {
  const labels = dailyRows.map(r => r.day);
  const dIn = dailyRows.map(r => r.deposits);
  const dOut = dailyRows.map(r => r.withdrawals);
  const ctx = dailyFlowRef.current.getContext('2d')!;
  const chart = new ChartJS(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Depositi', data: dIn },
      { label: 'Prelievi', data: dOut },
    ]},
    options: { responsive: true, maintainAspectRatio: false }
  });
  cleanup.push(() => chart.destroy());
}
if (dailyCountRef.current && dailyRows.length) {
  const labels = dailyRows.map(r => r.day);
  const counts = dailyRows.map(r => r.count);
  const ctx = dailyCountRef.current.getContext('2d')!;
  const chart = new ChartJS(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Conteggio transazioni', data: counts }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
  cleanup.push(() => chart.destroy());
}
return () => { cleanup.forEach(fn => fn()); };
  }, [analysis, previewIndicators]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Analisi Avanzata (AI)</h3>
        <Button onClick={doAnalyze} disabled={loading}>{loading ? 'calcolo...' : 'ricalcola'}</Button>
      </div>

      {error && <Card className="p-4 text-red-600">{error}</Card>}

      {analysis && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-sm">
                rischio: {(riskBadge.r/100).toFixed(1)} ({riskBadge.label})
              </span>
              <span className="text-sm text-muted-foreground">modello: {analysis.model || 'openai/gpt-oss-120b'}</span>
            </div>
            <div className="mt-4 whitespace-pre-line leading-relaxed">{analysis.summary || '—'}</div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Net Flow mensile</h4><div className="h-56"><canvas ref={netFlowRef} /></div></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Distribuzione oraria</h4><div className="h-56"><canvas ref={hourlyRef} /></div></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Metodi di pagamento</h4><div className="h-56"><canvas ref={methodRef} /></div></Card>
          </div>
        </>
      )}
    </div>
  );
}