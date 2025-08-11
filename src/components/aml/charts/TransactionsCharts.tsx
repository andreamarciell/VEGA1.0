
import React, { useEffect, useMemo, useRef } from "react";
import { Chart as ChartJS, registerables } from "chart.js";
ChartJS.register(...registerables);

type MonthMap<T = number> = { [yyyyMM: string]: T };

// Replicate minimal shapes to avoid importing from sibling file
type MovementSummary = {
  totAll: number;
  months: string[]; // "YYYY-MM"
  methods: Record<string, number>;
  perMonth: Record<string, MonthMap>;
};

type CardRow = {
  pan: string;
  app: number;
  dec: number;
  nDec: number;
  bank?: string;
  prod?: string;
  type?: string;
  name?: string;
};

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const monthLabel = (k: string) => {
  if (!k || typeof k !== "string") return k;
  const [y, m] = k.split("-");
  const names = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const mi = Math.max(1, Math.min(12, parseInt(m, 10) || 1)) - 1;
  return `${names[mi]} ${y}`;
};

function sumByMonth(data?: MovementSummary | null) {
  if (!data) return { labels: [] as string[], values: [] as number[] };
  const labels = Array.from(new Set(data.months)).sort();
  const values = labels.map((mm) =>
    Object.values(data.perMonth || {}).reduce((acc, months) => acc + (months[mm] || 0), 0)
  );
  return { labels, values };
}

/** ------------------------------------------------------------------
 * 1) Depositi vs Prelievi (stacked area)
 * ------------------------------------------------------------------ */
export const DepositiVsPrelievi: React.FC<{
  deposit?: MovementSummary | null;
  withdraw?: MovementSummary | null;
}> = ({ deposit, withdraw }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useRef<ChartJS | null>(null);

  const { labels, depVals, witVals } = useMemo(() => {
    const d = sumByMonth(deposit);
    const w = sumByMonth(withdraw);
    const labels = Array.from(new Set([...d.labels, ...w.labels])).sort();
    const depVals = labels.map((k) => (d.labels.includes(k) ? d.values[d.labels.indexOf(k)] : 0));
    const witVals = labels.map((k) => (w.labels.includes(k) ? w.values[w.labels.indexOf(k)] : 0));
    return { labels, depVals, witVals };
  }, [deposit, withdraw]);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext("2d");
    if (!ctx || labels.length === 0) return;

    inst.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels: labels.map(monthLabel),
        datasets: [
          { label: "Depositi", data: depVals, fill: true, tension: 0.25, borderWidth: 2,  },
          { label: "Prelievi", data: witVals, fill: true, tension: 0.25, borderWidth: 2,  },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(Number(ctx.raw) || 0)}` } },
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { stacked: false, ticks: { callback: (v) => eur(Number(v)) } },
        },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  }, [labels, depVals, witVals]);

  if (!labels.length) return null;
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">depositi vs prelievi (mensile)</div>
      <div className="relative h-[280px] w-full overflow-hidden">
        <canvas ref={ref} />
      </div>
    </div>
  );
};

/** ------------------------------------------------------------------
 * 2) Saldo cumulato (line)
 * ------------------------------------------------------------------ */
export const TrendDepositi: React.FC<{
  deposit?: MovementSummary | null;
  withdraw?: MovementSummary | null;
}> = ({ deposit, withdraw }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useRef<ChartJS | null>(null);

  
  const { labels, depVals } = useMemo(() => {
    const d = sumByMonth(deposit);
    const labels = Array.from(new Set([...d.labels])).sort();
    const depVals = labels.map((k) => (d.labels.includes(k) ? d.values[d.labels.indexOf(k)] : 0));
    return { labels, depVals };
  }, [deposit]);


  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext("2d");
    if (!ctx || labels.length === 0) return;

    inst.current = new ChartJS(ctx, {
      type: "line",
      data: { labels: labels.map(monthLabel), datasets: [{ label: "Trend depositi", data: depVals, tension: 0.2, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(Number(ctx.raw) || 0)}` } },
        },
        scales: { y: { ticks: { callback: (v) => eur(Number(v)) } } },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  }, [labels, depVals]);

  if (!labels.length) return null;
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">trend depositi (mensile)</div>
      <div className="relative h-[240px] w-full overflow-hidden">
        <canvas ref={ref} />
      </div>
    </div>
  );
};

/** ------------------------------------------------------------------
 * 3/4) Totale per metodo (bar orizzontale)
 * ------------------------------------------------------------------ */
export const TotalePerMetodo: React.FC<{
  title: string;
  data?: MovementSummary | null;
}> = ({ title, data }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useRef<ChartJS | null>(null);

  const { labels, values } = useMemo(() => {
    if (!data) return { labels: [] as string[], values: [] as number[] };
    const entries = Object.entries(data.methods || {}).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
  }, [data]);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext("2d");
    if (!ctx || labels.length === 0) return;

    inst.current = new ChartJS(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: title, data: values, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => eur(Number(ctx.raw) || 0) } } },
        scales: { x: { ticks: { callback: (v) => eur(Number(v)) } }, y: { ticks: { autoSkip: false } } },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  }, [labels, values, title]);

  if (!labels.length) return null;
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">{title}</div>
      <div className="relative h-[260px] w-full overflow-hidden">
        <canvas ref={ref} />
      </div>
    </div>
  );
};

/** ------------------------------------------------------------------
 * 5) Carte – Top 3 per importo approvato (bar orizzontale)
 * ------------------------------------------------------------------ */
const maskPan = (pan?: string) => {
  if (!pan) return "Carta";
  const s = String(pan).replace(/\s+/g, "");
  const last4 = s.slice(-4);
  return `•••• ${last4}`;
};

export const TopCardsByApproved: React.FC<{ rows?: CardRow[] | null }> = ({ rows }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useRef<ChartJS | null>(null);

  const { labels, values } = useMemo(() => {
    if (!rows?.length) return { labels: [] as string[], values: [] as number[] };
    const agg = new Map<string, number>();
    for (const r of rows) {
      const key = maskPan(r.pan);
      const v = Number(r.app) || 0;
      agg.set(key, (agg.get(key) || 0) + v);
    }
    const top = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { labels: top.map(([k]) => k), values: top.map(([, v]) => v) };
  }, [rows]);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext("2d");
    if (!ctx || labels.length === 0) return;

    inst.current = new ChartJS(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Top 3 carte per importo approvato", data: values, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => eur(Number(ctx.raw) || 0) } } },
        scales: { x: { ticks: { callback: (v) => eur(Number(v)) } }, y: { ticks: { autoSkip: false } } },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  }, [labels, values]);

  if (!labels.length) return null;
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">carte – top 3 per importo approvato</div>
      <div className="relative h-[220px] w-full overflow-hidden">
        <canvas ref={ref} />
      </div>
    </div>
  );
};

const TransactionsCharts = { DepositiVsPrelievi, TrendDepositi, TotalePerMetodo, TopCardsByApproved };
export default TransactionsCharts;
