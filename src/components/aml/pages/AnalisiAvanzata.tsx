// src/components/aml/pages/AnalisiAvanzata.tsx
// Renders Advanced Analysis section. Flags removed. Shows only detailed summary + risk badge.
// Keeps existing charts and other sections untouched.
/* eslint-disable */

import React, { useCallback, useMemo, useState } from 'react';

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

const AnalisiAvanzata: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // read transactions from store or localStorage
  const txs: Tx[] = useMemo(() => {
    try {
      const ls = localStorage.getItem('amlTransactions');
      if (!ls) return [];
      const parsed = JSON.parse(ls);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

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
        <button
          onClick={run}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
        >
          {loading ? 'Analisi in corso…' : 'ricalcola'}
        </button>
      </div>

      <p className="text-sm text-slate-500">i dati inviati all’AI sono anonimizzati.</p>

      {/* card */}
      <div className="rounded-xl border p-4 space-y-3 bg-white">
        {/* rischio badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
            rischio: {result ? Number(result.risk_score || 0).toFixed(1) : '0.0'} ({riskLabel})
          </span>
        </div>

        {/* Flags section removed as requested */}

        <div className="space-y-1">
          <h3 className="font-semibold">Sintesi generale</h3>
          <p className="text-sm leading-6 whitespace-pre-wrap">
            {result?.summary || (error ? '' : 'esegui analisi per ottenere la sintesi dettagliata…')}
          </p>
          {error && (
            <p className="text-sm text-red-600">analisi fallita: {error}</p>
          )}
        </div>
      </div>

      {/* NOTE: charts and the rest of the page are assumed to be rendered elsewhere in the same route.
         We don't modify them here. */}
    </div>
  );
};

export default AnalisiAvanzata;
