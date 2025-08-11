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

function classifyMoveStrict(reason: string): 'deposit'|'withdraw'|'cancel_withdraw'|'other' {
  const s = String(reason || '').toLowerCase();
  const hasPrelievo = /(^|\b)prelievo(\b|$)/.test(s);
  const isCancelled = /(\bannullamento\b|\bstorno\b|\brimborso\b)/.test(s);
  if (/(^|\b)(deposito|ricarica)(\b|$)/.test(s)) return 'deposit';
  if (hasPrelievo && isCancelled) return 'cancel_withdraw';
  if (hasPrelievo) return 'withdraw';
  return 'other';
}

/** Build payload from the Excel originally loaded and persisted in localStorage */

function buildAnonPayload(): { txs: TxPayload[]; gameplay?: { ts: string; amount: number; reason: string; }[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [], gameplay: [] };
  try {
    const arr = JSON.parse(raw) as any[];

    // --- existing txs pipeline (unchanged) ---
    const txs: TxPayload[] = arr.map((t) => {
      const d = new Date(t?.data ?? t?.date ?? t?.ts);
      const causale = String(t?.causale ?? t?.reason ?? '');
      const amount = parseNum(t?.importo ?? t?.amount ?? 0);
      const move = classifyMoveStrict(causale);
      const dir: 'in'|'out' = (move === 'withdraw') ? 'out' : 'in';
      return {
        ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        amount: Number.isFinite(amount) ? amount : 0,
        dir,
        method: (t?.metodo ?? t?.method ?? t?.payment_method ?? t?.paymentMethod ?? t?.tipo ?? causale),
        reason: sanitizeReason(causale),
      };
    })
    // keep ONLY deposit/withdraw/cancel_withdraw movements (we need cancellations for net sum of withdrawals)
    .filter((x) => {
      const m = classifyMoveStrict(x.reason || '');
      return m === 'deposit' || m === 'withdraw' || m === 'cancel_withdraw';
    })
    // final guard
    .filter(x => Number.isFinite(x.amount) && !!x.ts);

    // --- NEW: lightweight gameplay causali for AI (does not affect totals/charts) ---
    const gp: { ts: string; amount: number; reason: string; }[] = [];
    for (const t of arr) {
      const r = String(t?.causale ?? t?.reason ?? '');
      if (!r) continue;
      const rl = r.toLowerCase();
      // select only gameplay-related reasons (slot sessions, bets, wins)
      if (/(session\s+slot|giocata\s+scommessa|vincita\s+scommessa)/i.test(rl)) {
        const d = new Date(t?.data ?? t?.date ?? t?.ts);
        const amount = parseNum(t?.importo ?? t?.amount ?? 0);
        gp.push({
          ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
          amount: Number.isFinite(amount) ? amount : 0,
          reason: sanitizeReason(r),
        });
      }
    }

    return { txs, gameplay: gp };
  } catch {
    return { txs: [], gameplay: [] };
  }
}
