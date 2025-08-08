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

// ✅ your store does NOT export default; use a **named** export.
import { useAmlStore } from "../../../store/amlStore";

const AnalisiAvanzata: React.FC = () => {
  // selectors resilient to naming differences already used in the codebase
  const transactions = useAmlStore((s: any) => s.transactions ?? s.transazioni ?? []);
  const analysis = useAmlStore((s: any) => s.advancedAnalysis ?? s.analysis ?? s.analisiAvanzata ?? null);
  const setAdvancedAnalysis = useAmlStore(
    (s: any) => s.setAdvancedAnalysis ?? s.setAnalysis ?? s.setAnalisiAvanzata ?? undefined
  );

  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const payload = useMemo(() => {
    const source = Array.isArray(transactions) ? transactions : [];
    const txs = source
      .filter((t: any) => t)
      .map((t: any) => ({
        ts: t.ts || t.timestamp || t.date || t.created_at,
        amount: Number(t.amount ?? t.importo ?? t.value ?? 0),
        direction: (t.direction || t.dir || t.type || t.movimento || "").toString().toLowerCase(),
        method: (t.method || t.payment_method || t.metodo || "other").toString().toLowerCase(),
        cause: (t.cause || t.causale || t.category || "other").toString().toLowerCase(),
      }))
      .filter((t: any) => t.ts && isFinite(t.amount));
    return { transactions: txs };
  }, [transactions]);

  const runAI = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
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
    const ind = (analysis && analysis.indicators) || null;
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
  }, [analysis]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Analisi Avanzata (AI)</h3>
            <p className="text-sm text-muted-foreground">
              i dati inviati all’AI sono anonimizzati (timestamp, importo, direzione, causale normalizzata).
            </p>
            {error && <p className="text-sm text-red-600 mt-2">analisi fallita ({error.replace(/^HTTP \d+\s*/,'')})</p>}
          </div>
          <button disabled={loading} onClick={runAI} className="btn btn-primary">
            {loading ? "in corso..." : "esegui analisi ai"}
          </button>
        </div>

        {analysis?.recommendations?.length ? (
          <div className="mt-6 space-y-3">
            <ul className="list-disc pl-6 text-sm">
              {analysis.recommendations.map((r: string, idx: number) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
            {analysis.summary && (
              <p className="text-sm mt-3 opacity-80">
                <strong>Riepilogo:</strong> {analysis.summary}
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
