
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

/** ------------------------------------------------------------------
 * 6) Forecast Depositi (line with prediction)
 * ------------------------------------------------------------------ */
export const DepositsForecast: React.FC<{
  deposit?: MovementSummary | null;
}> = ({ deposit }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useRef<ChartJS | null>(null);

  const { historicalData, forecastData, labels } = useMemo(() => {
    if (!deposit || !deposit.months || deposit.months.length < 3) {
      return { historicalData: [], forecastData: [], labels: [] };
    }

    // Prepare historical data (monthly totals)
    const monthlyTotals = new Map<string, number>();
    deposit.months.forEach(month => {
      const total = Object.values(deposit.perMonth || {}).reduce((acc, months) => 
        acc + (months[month] || 0), 0);
      monthlyTotals.set(month, total);
    });

    // Sort months chronologically
    const sortedMonths = Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    if (sortedMonths.length < 3) {
      return { historicalData: [], forecastData: [], labels: [] };
    }

    // Extract values for forecasting
    const values = sortedMonths.map(([, value]) => value);
    const monthLabels = sortedMonths.map(([month]) => month);

    // Simple linear regression with trend analysis
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    // Calculate means
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Generate forecast for next 6 months
    const forecastMonths = [];
    const forecastValues = [];
    
    for (let i = 1; i <= 6; i++) {
      const nextMonthIndex = n + i - 1;
      const predictedValue = slope * nextMonthIndex + intercept;
      
      // Ensure prediction is not negative
      const safePrediction = Math.max(0, predictedValue);
      
      // Generate next month label
      const lastMonth = monthLabels[monthLabels.length - 1];
      const [year, month] = lastMonth.split('-').map(Number);
      let nextYear = year;
      let nextMonth = month + i;
      
      if (nextMonth > 12) {
        nextMonth = nextMonth - 12;
        nextYear = year + 1;
      }
      
      const nextMonthLabel = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
      forecastMonths.push(nextMonthLabel);
      forecastValues.push(safePrediction);
    }

    // Combine historical and forecast data
    const allLabels = [...monthLabels, ...forecastMonths];
    const historicalData = values;
    const forecastData = forecastValues;

    return { historicalData, forecastData, labels: allLabels };
  }, [deposit]);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) { inst.current.destroy(); inst.current = null; }
    const ctx = ref.current.getContext("2d");
    if (!ctx || labels.length === 0) return;

    const historicalLength = historicalData.length;
    const forecastStartIndex = historicalLength;

    inst.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels: labels.map(monthLabel),
        datasets: [
          {
            label: "Depositi Storici",
            data: historicalData,
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.2,
          },
          {
            label: "Forecast (6 mesi)",
            data: [...Array(historicalLength).fill(null), ...forecastData],
            borderColor: "rgb(239, 68, 68)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom" },
          tooltip: { 
            callbacks: { 
              label: (ctx) => {
                const value = Number(ctx.raw) || 0;
                const isForecast = ctx.datasetIndex === 1;
                return `${ctx.dataset.label}: ${eur(value)}${isForecast ? ' (previsione)' : ''}`;
              }
            } 
          },
        },
        scales: {
          x: { 
            ticks: { maxRotation: 0, autoSkip: true },
            grid: {
              color: (context) => {
                const index = context.tick?.value;
                return index >= forecastStartIndex ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 0, 0, 0.1)';
              }
            }
          },
          y: { 
            ticks: { callback: (v) => eur(Number(v)) },
            grid: {
              color: (context) => {
                const index = context.tick?.value;
                return index >= forecastStartIndex ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 0, 0, 0.1)';
              }
            }
          },
        },
      },
    });

    return () => { inst.current?.destroy(); inst.current = null; };
  }, [labels, historicalData, forecastData]);

  if (!labels.length || historicalData.length < 3) return null;
  
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-medium">Forecast Depositi (6 mesi)</div>
      <div className="mb-2 text-xs text-muted-foreground">
        Basato su trend lineare dei dati storici
      </div>
      <div className="relative h-[280px] w-full overflow-hidden">
        <canvas ref={ref} />
      </div>
    </div>
  );
};

const TransactionsCharts = { DepositiVsPrelievi, TrendDepositi, TotalePerMetodo, TopCardsByApproved, DepositsForecast };
export default TransactionsCharts;
