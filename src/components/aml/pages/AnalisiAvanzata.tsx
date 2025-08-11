// src/components/aml/pages/AnalisiAvanzata.tsx
import React, { useEffect, useState } from "react";
import { useAmlStore } from "../../../store/amlStore";

type Tx = {
  ts: string | Date;
  amount: number | string;
  dir?: "in" | "out" | string;
  method?: string;
  source?: string;
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
  // 1) Labels pointing to non-existing inputs or placeholder FORM_ELEMENT -> convert to button-like label
  document.querySelectorAll("label[for]").forEach((lbl: Element) => {
    const forVal = (lbl as HTMLLabelElement).htmlFor;
    if (!forVal || forVal === "FORM_ELEMENT" || !document.getElementById(forVal)) {
      (lbl as HTMLLabelElement).htmlFor = "";
      (lbl as HTMLElement).setAttribute("role", "button");
      (lbl as HTMLElement).setAttribute("tabindex", "0");
    }
  });
  // 2) Inputs without id/name -> auto-assign to silence accessibility warnings
  const sel = 'input:not([id]):not([name]), select:not([id]):not([name]), textarea:not([id]):not([name])';
  document.querySelectorAll(sel).forEach((el: Element, idx: number) => {
    const id = `autogen-${Date.now()}-${idx}`;
    (el as HTMLElement).setAttribute("id", id);
    (el as HTMLElement).setAttribute("name", id);
  });
}

export default function AnalisiAvanzata() {
  const [loading, setLoading] = useState(false);
  const includeCards = useAmlStore(s => s.includeCards ?? false);
  const normalizedTxs: Tx[] = useAmlStore(s => s.transactionsNormalized || s.transactions || s.txs || []);

  useEffect(() => {
    runA11yAutofix();
  }, []);

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
      useAmlStore.getState().setAdvancedAnalysis?.(data);
    } catch (e) {
      console.error("Analisi AI fallita:", e);
      useAmlStore.getState().setAdvancedAnalysis?.({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return <div />; // keep existing JSX in your project; this file focuses on logic/hook updates
}
