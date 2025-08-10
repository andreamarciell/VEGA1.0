// src/components/aml/pages/AnalisiAvanzata.tsx
// Advanced Analysis: hide summary card until analysis is completed; restore charts.
// No changes to other pages; anonymization preserved on server side.
/* eslint-disable */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';

type Tx = {
  ts?: string;
  timestamp?: string;
  date?: string;
  datetime?: string;
  created_at?: string;
  amount?: number | string;
  importo?: number | string;
  value?: number | string;
  sum?: number | string;
  dir?: 'in' | 'out' | string;
  direction?: 'in' | 'out' | string;
  type?: string;
  reason?: string;
  causale?: string;
  description?: string;
};

type AnalysisResult = {
  summary: string;
  risk_score: number;
};

function toISO(raw?: string): string | null {
  if (!raw) return null;
  try {
    return new Date(raw).toISOString();
  } catch {
    return null;
  }
}
function toNum(v: any): number {
  const n = Number(v);
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

const AnalisiAvanzata: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // read transactions from localStorage
  const txsRaw: Tx[] = useMemo(() => {
    try {
      const ls = localStorage.getItem('amlTransactions');
      if (!ls) return [];
      const parsed = JSON.parse(ls);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  // normalized txs (used for charts)
  const txs = useMemo(() => {
    return txsRaw.map(t => {
      const ts = toISO(t.ts || t.timestamp || t.date || t.datetime || t.created_at) || new Date().toISOString();
      const amount = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
      const dir = inferDir(t);
      const reason = (t.reason || t.causale || t.description || '') + '';
      return { ts, amount, dir, reason };
    });
  }, [txsRaw]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/.netlify/functions/amlAdvancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // risk label
  const riskLabel = useMemo(() => {
    const v = result?.risk_score ?? 0;
    if (v >= 75) return 'ALTO';
    if (v >= 45) return 'MEDIO';
    return 'BASSO';
  }, [result]);

  // ---- Charts data (computed locally, like before) ----
  // 1) Net flow per month (Depositi vs Prelievi)
  const monthly = useMemo(() => {
    const map: Record<string, { month: string, depositi: number, prelievi: number }> = {};
    for (const t of txs) {
      const ym = (t.ts || '').slice(0, 7) || 'n/a';
      if (!map[ym]) map[ym] = { month: ym, depositi: 0, prelievi: 0 };
      if (t.dir === 'in') map[ym].depositi += Math.abs(t.amount);
      else map[ym].prelievi += Math.abs(t.amount);
    }
    // sort by month asc
    const data = Object.values(map).sort((a,b)=>a.month.localeCompare(b.month));
    return data;
  }, [txs]);

  // 2) Hourly distribution (counts)
  const hourly = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const t of txs) {
      const h = new Date(t.ts).getUTCHours();
      if (Number.isFinite(h)) arr[h].count += 1;
    }
    return arr;
  }, [txs]);

  // 3) Payment method breakdown (simple keyword-based)
  const methods = useMemo(() => {
    const buckets: Record<string, number> = { ewallet: 0, card: 0, bank: 0, bonus: 0, other: 0 };
    const rules: [string, RegExp][] = [
      ['ewallet', /(skrill|neteller|paypal|ewallet|wise|revolut)/i],
      ['card', /(visa|mastercard|amex|maestro|card|carta)/i],
      ['bank', /(bank|bonifico|iban|sepa|wire)/i],
      ['bonus', /(bonus|promo|freebet|voucher)/i]
    ];
    for (const t of txs) {
      const r = t.reason || '';
      let matched = false;
      for (const [k, re] of rules) {
        if (re.test(r)) { buckets[k] += 1; matched = true; break; }
      }
      if (!matched) buckets.other += 1;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [txs]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analisi Avanzata (AI)</h2>
        <button
          onClick={run}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
        >
          {loading ? 'Analisi in corso…' : (result ? 'ricalcola' : 'esegui analisi')}
        </button>
      </div>

      <p className="text-sm text-slate-500">i dati inviati all’AI sono anonimizzati.</p>

      {/* show summary card ONLY after analysis completed */}
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

      {error && (
        <p className="text-sm text-red-600">analisi fallita: {error}</p>
      )}

      {/* Charts restored (always available when there are transactions) */}
      {!!txs.length && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Net Flow mensile */}
          <div className="rounded-xl border p-4 bg-white">
            <h4 className="font-semibold mb-3">Net Flow mensile</h4>
            <div className="w-full h-56">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="depositi" stackId="a" />
                  <Bar dataKey="prelievi" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuzione oraria */}
          <div className="rounded-xl border p-4 bg-white">
            <h4 className="font-semibold mb-3">Distribuzione oraria</h4>
            <div className="w-full h-56">
              <ResponsiveContainer>
                <BarChart data={hourly}>
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metodi di pagamento */}
          <div className="rounded-xl border p-4 bg-white">
            <h4 className="font-semibold mb-3">Metodi di pagamento</h4>
            <div className="w-full h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={methods} dataKey="value" nameKey="name" outerRadius={80}>
                    {methods.map((entry, idx) => (<Cell key={`c-${idx}`} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisiAvanzata;
