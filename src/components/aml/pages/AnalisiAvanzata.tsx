import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import Chart from "chart.js/auto";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

// store: named export
import { useAmlStore } from "../../../store/amlStore";

// --- helpers ---
const toNumber = (v: any): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace?.(",", ".") ?? v);
    return isFinite(n) ? n : 0;
  }
  return 0;
};

function normalizeDirection(v: any): "deposit" | "withdrawal" {
  const s = (v ?? "").toString().toLowerCase();
  if (s.includes("with") || s.includes("prel")) return "withdrawal";
  if (s.includes("out")) return "withdrawal";
  return "deposit";
}

type TxInput = {
  ts?: string;
  timestamp?: string;
  date?: string;
  created_at?: string;
  amount?: number | string;
  importo?: number | string;
  value?: number | string;
  direction?: string;
  dir?: string;
  type?: string;
  movimento?: string;
  method?: string;
  payment_method?: string;
  metodo?: string;
  cause?: string;
  causale?: string;
  category?: string;
};

const collectFromStorage = (): TxInput[] => {
  try {
    const keys = [
      "aml_transactions",
      "transactions",
      "public.transactions",
      "toppery.transactions",
      "__AML_TRANSACTIONS__",
    ];
    for (const k of keys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    }
  } catch {}
  try {
    const g: any = (window as any);
    const candidates = [
      g.__AML_TRANSACTIONS__,
      g.aml?.transactions,
      g.toppery?.transactions,
      g.store?.transactions,
    ];
    for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  } catch {}
  return [];
};

const gatherTransactions = (store: any): TxInput[] => {
  if (!store) return [];
  const candidates = [
    store.transactions,
    store.transazioni,
    store.parsedTransactions,
    store.transactionsParsed,
    store.filteredTransactions,
    store.transazioniFiltrate,
    store.userTransactions,
    store.tableTransactions,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c as TxInput[];
  }
  return [];
};

const AnalisiAvanzata: React.FC = () => {
  const storeSlice = useAmlStore((s: any) => s);
  const setAdvancedAnalysis = useAmlStore(
    (s: any) => s.setAdvancedAnalysis ?? s.setAnalysis ?? s.setAnalisiAvanzata ?? undefined
  );

  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const sourceTxs = useMemo(() => {
    // 1) store
    let txs = gatherTransactions(storeSlice);
    // 2) storage/global fallback
    if (!txs.length) txs = collectFromStorage();
    return Array.isArray(txs) ? txs : [];
  }, [storeSlice]);

  const normalized = useMemo(() => {
    const seen = new Set<string>();
    const res = (sourceTxs || [])
      .map((t: any) => {
        const ts = t.ts || t.timestamp || t.date || t.created_at;
        const amount = toNumber(t.amount ?? t.importo ?? t.value ?? 0);
        const direction = normalizeDirection(t.direction ?? t.dir ?? t.type ?? t.movimento);
        const method = (t.method || t.payment_method || t.metodo || "other")?.toString().toLowerCase();
        const cause = (t.cause || t.causale || t.category || "other")?.toString().toLowerCase();
        const key = `${ts}|${amount}|${direction}|${method}|${cause}`;
        if (ts && isFinite(amount) && !seen.has(key)) {
          seen.add(key);
          return { ts, amount, direction, method, cause };
        }
        return null;
      })
      .filter(Boolean) as Array<{ ts: string; amount: number; direction: string; method: string; cause: string }>;
    return res;
  }, [sourceTxs]);

  const payload = useMemo(() => ({ transactions: normalized }), [normalized]);

  const runAI = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (!payload.transactions?.length) {
        throw new Error("nessuna transazione trovata nel contesto");
      }
      const res = await fetch("/.netlify/functions/amlAdvancedAnalysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      const data = await res.json();
      if (typeof setAdvancedAnalysis === "function") setAdvancedAnalysis(data);
    } catch (e: any) {
      console.error("[AnalisiAvanzata] runAI error:", e);
      setError(e?.message || "errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [payload, setAdvancedAnalysis]);

  const dailyTrendRef = useRef<any>(null);
  const dailyCountsRef = useRef<any>(null);

  const destroy = (ref: React.MutableRefObject<any>) => {
    if (ref.current) {
      ref.current.destroy();
      ref.current = null;
    }
  };

  useEffect(() => {
    const ind = (storeSlice.advancedAnalysis ?? storeSlice.analysis ?? storeSlice.analisiAvanzata)?.indicators
      ?? null;
    if (!ind) return;

    const ctx1 = document.getElementById("daily-trend") as HTMLCanvasElement | null;
    if (ctx1) {
      destroy(dailyTrendRef);
      dailyTrendRef.current = new Chart(ctx1, {
        type: "line",
        data: {
          labels: (ind.dailyTrend || []).map((d: any) => d.day),
          datasets: [
            { label: "Depositi", data: (ind.dailyTrend || []).map((d: any) => d.deposits) },
            { label: "Prelievi", data: (ind.dailyTrend || []).map((d: any) => d.withdrawals) },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      } as any);
    }

    const ctx2 = document.getElementById("daily-counts") as HTMLCanvasElement | null;
    if (ctx2) {
      destroy(dailyCountsRef);
      dailyCountsRef.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: (ind.dailyCounts || []).map((d: any) => d.day),
          datasets: [{ label: "Conteggio movimenti", data: (ind.dailyCounts || []).map((d: any) => d.count) }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      } as any);
    }
  }, [storeSlice.advancedAnalysis, storeSlice.analysis, storeSlice.analisiAvanzata]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Analisi Avanzata (AI)</h3>
            <p className="text-sm text-muted-foreground">
              i dati inviati all’AI sono anonimizzati (timestamp, importo, direzione, causale normalizzata).
            </p>
            {!!normalized.length && (
              <p className="text-xs opacity-70 mt-1">transazioni incluse nell'analisi: {normalized.length}</p>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-2">
                analisi fallita ({error.replace(/^HTTP \d+\s*/,"")})
              </p>
            )}
          </div>
          <button disabled={loading} onClick={runAI} className="btn btn-primary">
            {loading ? "in corso..." : "esegui analisi ai"}
          </button>
        </div>

        {(storeSlice.advancedAnalysis ?? storeSlice.analysis ?? storeSlice.analisiAvanzata)?.recommendations?.length ? (
          <div className="mt-6 space-y-3">
            <ul className="list-disc pl-6 text-sm">
              {(storeSlice.advancedAnalysis ?? storeSlice.analysis ?? storeSlice.analisiAvanzata).recommendations.map((r: string, idx: number) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
            {(storeSlice.advancedAnalysis ?? storeSlice.analysis ?? storeSlice.analisiAvanzata).summary && (
              <p className="text-sm mt-3 opacity-80">
                <strong>Riepilogo:</strong> {(storeSlice.advancedAnalysis ?? storeSlice.analysis ?? storeSlice.analisiAvanzata).summary}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6" style={{ height: 280 }}>
          <h4 className="font-medium mb-3">Trend giornaliero (depositi & prelievi)</h4>
          <canvas id="daily-trend" />
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6" style={{ height: 280 }}>
          <h4 className="font-medium mb-3">Picchi attività (conteggio giornaliero)</h4>
          <canvas id="daily-counts" />
        </div>
      </div>
    </div>
  );
};

export default AnalisiAvanzata;
