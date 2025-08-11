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

function classifyMethod(reason='') {
  const s = String(reason).toLowerCase();
  if (/visa|mastercard|amex|maestro|carta|card/.test(s)) return 'card';
  if (/sepa|bonifico|bank|iban/.test(s)) return 'bank';
  if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) return 'ewallet';
  if (/crypto|btc|eth|usdt|usdc/.test(s)) return 'crypto';
  if (/paysafecard|voucher|coupon/.test(s)) return 'voucher';
  if (/bonus|promo/.test(s)) return 'bonus';
  return 'other';
}

function buildAnonPayload(): { txs: TxPayload[] } {
  // Usa i dati salvati dal caricamento iniziale (pagina principale)
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [] };
  try {
    const arr = JSON.parse(raw) as any[];
    const txs: TxPayload[] = arr.map((t) => {
      const d = new Date(t?.data ?? t?.date ?? t?.ts);
      const causale = String(t?.causale ?? t?.reason ?? '');
      const amount = parseNum(t?.importo ?? t?.amount ?? 0);
      const norm = causale.toLowerCase();
      const dir: 'in'|'out' = norm.includes('preliev') ? 'out' : 'in';
      return {
        ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        amount: Number.isFinite(amount) ? amount : 0,
        dir,
        method: classifyMethod(norm),
        reason: sanitizeReason(causale),
      };
    }).filter(x => Number.isFinite(x.amount) && x.ts);
    return { txs };
  } catch {
    return { txs: [] };
  }
}

function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0); }

export default function AnalisiAvanzata() {
  const analysis = useAmlStore(s => s.advancedAnalysis);
  const setAnalysis = useAmlStore(s => s.setAdvancedAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // canvases
  const netFlowRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyRef = useRef<HTMLCanvasElement | null>(null);
  const methodRef = useRef<HTMLCanvasElement | null>(null);

  const riskPct = useMemo(() => {
    if (!analysis) return 0;
    let s = Number(analysis.risk_score || 0);
    if (s <= 1) s = s * 100;
    return Math.max(0, Math.min(100, s));
  }, [analysis]);

  const level = useMemo(() => {
    if (!analysis) return null;
    const s = riskPct;
    if (s >= 75) return { text: 'ALTO', className: 'bg-red-500 text-white' };
    if (s >= 40) return { text: 'MEDIO', className: 'bg-yellow-500 text-black' };
    return { text: 'BASSO', className: 'bg-green-500 text-white' };
  }, [riskPct, analysis]);

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
        const txt = await res.text();
        throw new Error(`analisi fallita (${res.status}): ${txt.slice(0,160)}`);
      }
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  // Render charts when analysis changes
  useEffect(() => {
    if (!analysis?.indicators) return;
    const { net_flow_by_month = [], hourly_histogram = [], method_breakdown = [] } = analysis.indicators || {};
    // Net flow by month
    if (netFlowRef.current) {
      const ctx = netFlowRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: net_flow_by_month.map(m => m.month),
            datasets: [
              { label: 'Depositi', data: net_flow_by_month.map(m => +(m.deposits?.toFixed?.(2) ?? m.deposits ?? 0)) },
              { label: 'Prelievi', data: net_flow_by_month.map(m => +(m.withdrawals?.toFixed?.(2) ?? m.withdrawals ?? 0)) },
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
        new Chart(ctx, {
          type: 'line',
          data: { labels: hourly_histogram.map(h => String(h.hour)), datasets: [{ label: 'Transazioni/ora', data: hourly_histogram.map(h => h.count) }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }
    // Method breakdown
    if (methodRef.current) {
      const ctx = methodRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'doughnut',
          data: { labels: method_breakdown.map(m => m.method), datasets: [{ label: '%', data: method_breakdown.map(m => m.pct) }] },
          options: { responsive: true, plugins: { legend: { display: true } } }
        });
      }
    }
  }, [analysis]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Analisi avanzata</h3>
        <Button onClick={handleRun} disabled={loading}>
          {loading ? 'Analizzo…' : (analysis ? 'Riesegui analisi' : 'Esegui analisi')}
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50 text-red-800">
          <p className="text-sm">{error}</p>
        </Card>
      )}

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
            <Card className="p-4">
              <h4 className="font-medium mb-3">Net Flow mensile</h4>
              <canvas ref={netFlowRef} />
            </Card>
            <Card className="p-4">
              <h4 className="font-medium mb-3">Distribuzione oraria</h4>
              <canvas ref={hourlyRef} />
            </Card>
            <Card className="p-4">
              <h4 className="font-medium mb-3">Metodi di pagamento</h4>
              <canvas ref={methodRef} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}