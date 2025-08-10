import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Try to use the main AML store if present (types loosely typed on purpose)
import { useAmlStore } from '@/store/amlStore';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

type Dir = 'in' | 'out';
type TxPayload = { ts: string; amount: number; dir: Dir; reason?: string };

function parseAmount(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const s = v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]')
    .replace(/\b\w{28,}\b/g, '[token]')
    .slice(0, 300);
}
function inferDir(obj: any, amount: number, reason: string): Dir {
  const s = (reason || obj?.causale || obj?.reason || '').toLowerCase();
  if (typeof obj?.dir === 'string') {
    const d = obj.dir.toLowerCase();
    if (d.startsWith('in')) return 'in';
    if (d.startsWith('out')) return 'out';
  }
  if (/preliev|withdraw|cashout|payout/i.test(s)) return 'out';
  if (/deposit|ricaric|topup|riforn|add funds/i.test(s)) return 'in';
  if (amount < 0) return 'out';
  return 'in';
}

function loadTransactionsFromLocalStorage(): any[] {
  try {
    const raw = localStorage.getItem('amlTransactions');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function buildAnonPayload(): { txs: TxPayload[] } {
  const arr = loadTransactionsFromLocalStorage();
  const txs: TxPayload[] = [];

  for (const t of arr) {
    const dateLike: any = (t?.data ?? t?.date ?? t?.ts ?? t?.dataStr);
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (isNaN(d.getTime())) continue;

    const amt = parseAmount(t?.importo ?? t?.amount ?? t?.importo_raw ?? 0);
    // Keep zeros too (explicitly requested)
    const reason = sanitizeReason(String(t?.causale ?? t?.reason ?? ''));
    const dir: Dir = inferDir(t, amt, reason);

    txs.push({
      ts: d.toISOString(),
      amount: +amt.toFixed(2),
      dir,
      reason,
    });
  }

  // sort by date asc
  txs.sort((a, b) => a.ts.localeCompare(b.ts));
  return { txs };
}

/** Simple indicator derivation on client in case the model omits them */
function computeIndicatorsFromTxs(txs: TxPayload[]) {
  // monthly net flow
  const byMonth: Record<string, { deposits: number; withdrawals: number; net: number }> = {};
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const methodCounts: Record<string, number> = {};

  for (const t of txs) {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) continue;

    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth[key] ||= { deposits: 0, withdrawals: 0, net: 0 };
    if (t.dir === 'in') {
      byMonth[key].deposits += t.amount;
      byMonth[key].net += t.amount;
    } else {
      byMonth[key].withdrawals += t.amount;
      byMonth[key].net -= t.amount;
    }
    hourly[d.getUTCHours()].count += 1;

    const s = String(t.reason || '').toLowerCase();
    let m = 'other';
    if (/visa|mastercard|amex|maestro|carta|card/.test(s)) m = 'card';
    else if (/sepa|bonifico|bank|iban/.test(s)) m = 'bank';
    else if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) m = 'ewallet';
    else if (/crypto|btc|eth|usdt|usdc/.test(s)) m = 'crypto';
    else if (/paysafecard|voucher|coupon/.test(s)) m = 'voucher';
    else if (/bonus|promo/.test(s)) m = 'bonus';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }

  const net_flow_by_month = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  const total = Object.values(methodCounts).reduce((a, b) => a + b, 0) || 1;
  const method_breakdown = Object.entries(methodCounts).map(([method, c]) => ({
    method,
    pct: Math.round((100 * (c as number)) / total * 100) / 100,
  }));

  return { net_flow_by_month, hourly_histogram: hourly, method_breakdown };
}

const AnalisiAvanzata: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);

  const setAdvancedAnalysis = (() => {
    try { return useAmlStore(s => (s as any).setAdvancedAnalysis); } catch { return null as any; }
  })();

  // chart refs
  const netFlowRef = useRef<HTMLCanvasElement>(null);
  const hourlyRef = useRef<HTMLCanvasElement>(null);
  const methodRef = useRef<HTMLCanvasElement>(null);
  const dailyFlowRef = useRef<HTMLCanvasElement>(null);
  const dailyCountRef = useRef<HTMLCanvasElement>(null);

  const netFlowInst = useRef<ChartJS | null>(null);
  const hourlyInst = useRef<ChartJS | null>(null);
  const methodInst = useRef<ChartJS | null>(null);
  const dailyFlowInst = useRef<ChartJS | null>(null);
  const dailyCountInst = useRef<ChartJS | null>(null);

  const riskPct = useMemo(() => {
    if (!analysis) return 0;
    let s = Number((analysis as any).risk_score || 0);
    if (s <= 1) s = s * 100;
    return s;
  }, [analysis]);

  const level = useMemo(() => {
    const s = riskPct;
    if (s >= 75) return { text: 'ALTO', className: 'bg-red-500 text-white' };
    if (s >= 40) return { text: 'MEDIO', className: 'bg-yellow-500 text-black' };
    return { text: 'BASSO', className: 'bg-green-500 text-white' };
  }, [riskPct]);

  const drawCharts = (indicators: any) => {
    try {
      const nf = indicators?.net_flow_by_month ?? [];
      const hh = indicators?.hourly_histogram ?? [];
      const mb = indicators?.method_breakdown ?? [];

      // destroy old
      [netFlowInst, hourlyInst, methodInst, dailyFlowInst, dailyCountInst].forEach(ref => {
        if (ref.current) { ref.current.destroy(); ref.current = null; }
      });

      // net flow monthly
      if (netFlowRef.current && nf.length) {
        const labels = nf.map((r: any) => r.month);
        const net = nf.map((r: any) => r.net ?? (r.deposits - r.withdrawals));
        netFlowInst.current = new ChartJS(netFlowRef.current, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Net Flow mensile', data: net }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }

      // hourly histogram
      if (hourlyRef.current && hh.length) {
        const labels = hh.map((r: any) => `${r.hour}:00`);
        const counts = hh.map((r: any) => r.count);
        hourlyInst.current = new ChartJS(hourlyRef.current, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Distribuzione oraria', data: counts }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }

      // method breakdown
      if (methodRef.current && mb.length) {
        const labels = mb.map((r: any) => r.method);
        const pct = mb.map((r: any) => r.pct);
        methodInst.current = new ChartJS(methodRef.current, {
          type: 'pie',
          data: { labels, datasets: [{ label: 'Metodi di pagamento', data: pct }] },
          options: { responsive: true }
        });
      }

      // daily flows / counts derived client-side
      const { txs } = buildAnonPayload();
      if (dailyFlowRef.current && txs.length) {
        const byDay: Record<string, { in: number; out: number }> = {};
        txs.forEach(t => {
          const day = t.ts.slice(0, 10);
          byDay[day] ||= { in: 0, out: 0 };
          byDay[day][t.dir] += t.amount;
        });
        const labels = Object.keys(byDay).sort();
        const dep = labels.map(d => byDay[d].in);
        const wit = labels.map(d => byDay[d].out);
        dailyFlowInst.current = new ChartJS(dailyFlowRef.current, {
          type: 'line',
          data: { labels, datasets: [{ label: 'Depositi (giornaliero)', data: dep }, { label: 'Prelievi (giornaliero)', data: wit }] },
          options: { responsive: true }
        });
      }

      if (dailyCountRef.current && txs.length) {
        const counts: Record<string, number> = {};
        txs.forEach(t => {
          const day = t.ts.slice(0, 10);
          counts[day] = (counts[day] || 0) + 1;
        });
        const labels = Object.keys(counts).sort();
        const vals = labels.map(d => counts[d]);
        dailyCountInst.current = new ChartJS(dailyCountRef.current, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Transazioni (conteggio giornaliero)', data: vals }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
    }
  };

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

      // ensure indicators if model omitted
      if (!data.indicators || !data.indicators.net_flow_by_month || !data.indicators.hourly_histogram || !data.indicators.method_breakdown) {
        const fb = computeIndicatorsFromTxs(payload.txs);
        data.indicators = { ...(data.indicators || {}), ...fb };
      }

      setAnalysis(data);
      if (setAdvancedAnalysis) {
        try { setAdvancedAnalysis(data); } catch {}
      }
      drawCharts(data.indicators);
    } catch (e: any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysis?.indicators) {
      drawCharts(analysis.indicators);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Analisi avanzata (GPT‑4.1 nano)</h3>
            <p className="text-sm text-muted-foreground">I dati inviati all’AI sono anonimizzati: causale, importi e date.</p>
          </div>
          <Button onClick={handleRun} disabled={loading}>
            {loading ? 'Analisi in corso…' : 'Esegui analisi'}
          </Button>
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {analysis && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-sm font-semibold ${level?.className || ''}`}>
                rischio: {riskPct.toFixed(1)} {level?.text ? `(${level.text})` : ''}
              </div>
              <div className="text-xs opacity-60">modello: gpt‑4.1‑nano via OpenRouter</div>
            </div>

            {analysis.summary && (
              <div>
                <h4 className="font-medium mb-2">Sintesi generale</h4>
                <p className="text-sm leading-6">{analysis.summary}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {analysis && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Net Flow mensile</h4><canvas ref={netFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Distribuzione oraria</h4><canvas ref={hourlyRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Metodi di pagamento</h4><canvas ref={methodRef} /></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card className="p-4"><h4 className="font-medium mb-3">Flusso giornaliero (depositi & prelievi)</h4><canvas ref={dailyFlowRef} /></Card>
            <Card className="p-4"><h4 className="font-medium mb-3">Transazioni (conteggio giornaliero)</h4><canvas ref={dailyCountRef} /></Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalisiAvanzata;