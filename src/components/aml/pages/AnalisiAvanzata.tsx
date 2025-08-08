import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// IMPORTANT: keep existing imports in your project; we re-declare only what we use here.
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

// If your project already has a typed store, import it instead:
import useAmlStore from "../../../store/amlStore"; // adjust if your path differs

const AnalisiAvanzata: React.FC = () => {
  const { transactions, analysis, setAdvancedAnalysis } = useAmlStore((s:any)=> ({
    transactions: s.transactions,         // expected array
    analysis: s.advancedAnalysis,         // where we store the result
    setAdvancedAnalysis: s.setAdvancedAnalysis,
  }));

  const [error, setError] = useState<string|undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // Build minimal payload from whatever the store exposes
  const payload = useMemo(() => {
    const txs = (transactions ?? analysis?.transactions ?? [])
      .filter((t:any) => t)
      .map((t:any) => ({
        ts: t.ts || t.timestamp || t.date || t.created_at,
        amount: Number(t.amount ?? t.importo ?? t.value ?? 0),
        direction: (t.direction || t.dir || t.type || t.movimento || "").toString().toLowerCase(),
        method: (t.method || t.payment_method || t.metodo || "other").toString().toLowerCase(),
        cause: (t.cause || t.causale || t.category || "other").toString().toLowerCase(),
      }))
      .filter((t:any) => t.ts && isFinite(t.amount));
    return { transactions: txs };
  }, [transactions, analysis]);

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
        const text = await res.text().catch(()=> "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      const data = await res.json();
      // Expect {flags, recommendations, summary, indicators}
      setAdvancedAnalysis?.(data);
    } catch (e:any) {
      console.error("[AnalisiAvanzata] runAI error:", e);
      setError(e?.message || "errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, [payload, setAdvancedAnalysis]);

  // Charts refs (lower tiles)
  const dailyTrendRef = useRef<Chart|null>(null);
  const dailyCountsRef = useRef<Chart|null>(null);

  const destroy = (ref: React.MutableRefObject<Chart|null>) => {
    if (ref.current) {
      ref.current.destroy();
      ref.current = null;
    }
  };

  useEffect(() => {
    const ind = analysis?.indicators;
    if (!ind) return;
    // Trend giornaliero (line)
    const ctx1 = document.getElementById("daily-trend") as HTMLCanvasElement | null;
    if (ctx1) {
      destroy(dailyTrendRef);
      // @ts-ignore new Chart constructor
      dailyTrendRef.current = new Chart(ctx1, {
        type: "line",
        data: {
          labels: (ind.dailyTrend || []).map((d:any)=> d.day),
          datasets: [
            { label: "Depositi", data: (ind.dailyTrend || []).map((d:any)=> d.deposits) },
            { label: "Prelievi", data: (ind.dailyTrend || []).map((d:any)=> d.withdrawals) },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    // Picchi attività (bar)
    const ctx2 = document.getElementById("daily-counts") as HTMLCanvasElement | null;
    if (ctx2) {
      destroy(dailyCountsRef);
      // @ts-ignore new Chart constructor
      dailyCountsRef.current = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: (ind.dailyCounts || []).map((d:any)=> d.day),
          datasets: [
            { label: "Conteggio movimenti", data: (ind.dailyCounts || []).map((d:any)=> d.count) },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
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
              {analysis.recommendations.map((r:string, idx:number)=>(<li key={idx}>{r}</li>))}
            </ul>
            {analysis.summary && (
              <p className="text-sm mt-3 opacity-80"><strong>Riepilogo:</strong> {analysis.summary}</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6" style={{height: 280}}>
          <h4 className="font-medium mb-3">Trend giornaliero (depositi & prelievi)</h4>
          <canvas id="daily-trend" />
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6" style={{height: 280}}>
          <h4 className="font-medium mb-3">Picchi attività (conteggio giornaliero)</h4>
          <canvas id="daily-counts" />
        </div>
      </div>
    </div>
  );
};

export default AnalisiAvanzata;
