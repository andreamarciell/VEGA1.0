// src/components/aml/pages/AnalisiAvanzata.tsx
import React, { useEffect, useMemo, useState } from "react";
// prefer named export; if your store exports default, re-export it as named in the store file or adjust here.
import { useAmlStore } from "../../../store/amlStore";

// Recharts (already used in the project for other charts)
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

type Tx = {
  ts: string | Date;
  amount: number | string;
  dir?: "in" | "out" | string;
  method?: string;
  source?: string;
};

type Indicators = {
  totals: { deposits: number; withdrawals: number; net: number };
  monthly?: Array<{ month: string; deposits: number; withdrawals: number }>;
  hourlyCounts?: number[];
  methodVolumes?: Array<{ method: string; volume: number }>;
};

type AiResult = {
  summary?: string;
  risk_score?: number | null;
  indicators?: Indicators;
  error?: string;
};

function toNumber(any: number | string): number {
  if (typeof any === "number") return any;
  let s = String(any).trim().replace(/\s+/g, "");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTx(raw: Tx) {
  const ts = new Date(raw.ts as any).toISOString();
  let amount = toNumber(raw.amount);
  let dir = String(raw.dir || "").toLowerCase();
  const method = String(raw.method || "other").toLowerCase();
  const source = String(raw.source || "").toLowerCase();
  if (!dir) dir = amount < 0 ? "out" : "in";
  if (dir === "deposito" || dir === "deposit") dir = "in";
  if (dir === "prelievo" || dir === "withdraw" || dir === "withdrawal") dir = "out";
  if (amount < 0) amount = Math.abs(amount);
  return { ts, amount, dir, method, source };
}

function dedupe(txs: ReturnType<typeof normalizeTx>[]) {
  const seen = new Set<string>();
  const out: typeof txs = [];
  for (const t of txs) {
    const minute = t.ts.slice(0, 16);
    const key = `${minute}|${t.amount.toFixed(2)}|${t.dir}|${t.method}`;
    if (!seen.has(key)) { seen.add(key); out.push(t); }
  }
  return out;
}

function runA11yAutofix() {
  // Fix labels with invalid "for" and fields without id/name to silence a11y warnings.
  document.querySelectorAll("label[for]").forEach((lbl: Element) => {
    const forVal = (lbl as HTMLLabelElement).htmlFor;
    if (!forVal || forVal === "FORM_ELEMENT" || !document.getElementById(forVal)) {
      (lbl as HTMLLabelElement).htmlFor = "";
      (lbl as HTMLElement).setAttribute("role", "button");
      (lbl as HTMLElement).setAttribute("tabindex", "0");
    }
  });
  const sel = 'input:not([id]):not([name]), select:not([id]):not([name]), textarea:not([id]):not([name])';
  document.querySelectorAll(sel).forEach((el: Element, idx: number) => {
    const id = `autogen-${Date.now()}-${idx}`;
    (el as HTMLElement).setAttribute("id", id);
    (el as HTMLElement).setAttribute("name", id);
  });
}

export default function AnalisiAvanzata() {
  const [loading, setLoading] = useState(false);
  const includeCards = useAmlStore(s => (s as any).includeCards ?? false);
  const normalizedTxs: Tx[] = useAmlStore(s => (s as any).transactionsNormalized || (s as any).transactions || (s as any).txs || []);
  const analysis: AiResult | null = useAmlStore(s => (s as any).advancedAnalysis || null);
  const setAdvancedAnalysis = useAmlStore(s => (s as any).setAdvancedAnalysis);

  useEffect(() => { runA11yAutofix(); }, []);

  async function runAiAnalysis() {
    setLoading(true);
    try {
      let txs = (normalizedTxs || []).map(normalizeTx);
      if (!includeCards) txs = txs.filter(t => t.source !== "card");
      txs = dedupe(txs);
      if (!txs.length) throw new Error("Nessuna transazione valida da inviare all'AI");

      const res = await fetch("/.netlify/functions/amlAdvancedAnalysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txs, includeCards })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore analisi AI");
      setAdvancedAnalysis?.(data);
    } catch (e: any) {
      console.error("[AnalisiAvanzata] AI error:", e);
      setAdvancedAnalysis?.({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  const riskBadge = useMemo(() => {
    const risk = analysis?.risk_score;
    if (typeof risk !== "number") return null;
    let color = "bg-green-100 text-green-800";
    if (risk >= 66) color = "bg-red-100 text-red-800";
    else if (risk >= 33) color = "bg-yellow-100 text-yellow-800";
    return <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${color}`}>rischio: {risk.toFixed(1)}</span>;
  }, [analysis?.risk_score]);

  // ------- Charts data
  const monthlyData = useMemo(() => {
    const list = analysis?.indicators?.monthly || [];
    return list.map(x => ({ month: x.month, Depositi: x.deposits, Prelievi: x.withdrawals }));
  }, [analysis?.indicators?.monthly]);

  const hourlyData = useMemo(() => {
    const arr = analysis?.indicators?.hourlyCounts || [];
    return Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, "0"),
      count: arr[h] || 0
    }));
  }, [analysis?.indicators?.hourlyCounts]);

  const methodData = useMemo(() => {
    const list = analysis?.indicators?.methodVolumes || [];
    return list.map(x => ({ name: x.method, value: x.volume }));
  }, [analysis?.indicators?.methodVolumes]);

  const hasResult = !!analysis?.summary;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Analisi Avanzata (AI)</div>
        <button
          onClick={runAiAnalysis}
          disabled={loading}
          className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          aria-label="esegui analisi ai"
        >
          {loading ? "elaboro..." : "esegui analisi ai"}
        </button>
      </div>

      {analysis?.error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          analisi fallita: {analysis.error}
        </div>
      )}

      {hasResult ? (
        <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-3">
            {riskBadge}
            {analysis?.indicators?.totals && (
              <div className="text-sm text-slate-600">
                <span className="mr-3">depositi: <b>€ {analysis.indicators.totals.deposits.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</b></span>
                <span className="mr-3">prelievi: <b>€ {analysis.indicators.totals.withdrawals.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</b></span>
                <span>net: <b>€ {analysis.indicators.totals.net.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</b></span>
              </div>
            )}
          </div>
          <div className="text-slate-800 leading-relaxed">{analysis.summary}</div>
        </div>
      ) : (
        <div className="text-slate-500 text-sm">nessun risultato ancora. premi “esegui analisi ai”.</div>
      )}

      {/* Charts grid */}
      {hasResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Net Flow mensile */}
          <div className="rounded border border-slate-200 bg-white p-3">
            <div className="font-medium mb-2">Net Flow mensile</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Depositi" stackId="a" />
                  <Bar dataKey="Prelievi" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuzione oraria */}
          <div className="rounded border border-slate-200 bg-white p-3">
            <div className="font-medium mb-2">Distribuzione oraria</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Volumi per ora" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Metodi di pagamento */}
          <div className="rounded border border-slate-200 bg-white p-3">
            <div className="font-medium mb-2">Metodi di pagamento</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {methodData.map((_, i) => <Cell key={i} />)}
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
}
