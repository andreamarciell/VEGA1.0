// Netlify Function: amlAdvancedAnalysis
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  try {
    const { txs } = JSON.parse(event.body || '{}');
    if (!Array.isArray(txs) || txs.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'payload mancante' }) };
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'OPENROUTER_API_KEY mancante' }) };
    }

    // ---------- Helpers ----------
    function parseAmount(v) {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      let s = String(v ?? '').trim();
      if (!s) return 0;
      const hasComma = s.includes(',');
      const hasDot = s.includes('.');
      if (hasComma && hasDot) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (hasComma && !hasDot) {
        s = s.replace(',', '.');
      }
      s = s.replace(/[^0-9.+-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }

    function normalizeMethod(method, reason='') {
      const x = String(method || reason || '').toLowerCase();
      if (/(visa|mastercard|amex|maestro|carta|card|apple ?pay|google ?pay)/.test(x)) return 'card';
      if (/(sepa|bonifico|bank|iban|wire|swift|transfer|trustly|klarna|sofort|revolut)/.test(x)) return 'bank';
      if (/(skrill|neteller|paypal|ewallet|wallet|pay ?pal)/.test(x)) return 'ewallet';
      if (/(crypto|btc|bitcoin|eth|ethereum|usdt|usdc|trx|binance|binance ?pay)/.test(x)) return 'crypto';
      if (/(paysafecard|voucher|coupon|gift ?card|prepaid)/.test(x)) return 'voucher';
      if (/(bonus|promo|cashback)/.test(x)) return 'bonus';
      if (/(refund|chargeback|rimborso|storno)/.test(x)) return 'refund';
      return 'other';
    }

    // STRICT movement classification
    function classifyMove(reason='') {
      const s = String(reason || '').toLowerCase();
      const hasPrelievo = /(^|\b)prelievo(\b|$)/.test(s);
      const isCancelled = /(\bannullamento\b|\bstorno\b|\brimborso\b)/.test(s);
      if (/(^|\b)(deposito|ricarica)(\b|$)/.test(s)) return 'deposit';
      if (hasPrelievo && isCancelled) return 'cancel_withdraw';
      if (hasPrelievo) return 'withdraw';
      if (/(^|\b)bonus(\b|$)/.test(s)) return 'bonus';
      return 'other';
    }

    function sanitizeReason(s='') {
      return String(s || '')
        .toLowerCase()
        .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
        .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
        .replace(/[0-9]{6,}/g, '[num]');
    }

    // Robust POST with timeout using global fetch only
    async function postJSON(url, headers, body, timeoutMs = 10000) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { ...(headers||{}), 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const text = await res.text().catch(()=>'');
          return { status: res.status, ok: res.ok, text };
        } finally {
          clearTimeout(t);
        }
      } catch (e) {
        return { status: 0, ok: false, text: String(e?.message || e) };
      }
    }

    // ---------- Sanitize txs ----------
    let sanitized = txs.map(t => {
      const rawAmount = (t.amount ?? t.importo ?? 0);
      const amountAbs = Math.abs(parseAmount(rawAmount));
      const rawReason = (t.reason ?? t.causale ?? t.desc ?? '');
      const reason = sanitizeReason(rawReason);
      const methodRaw = t.method ?? t.metodo ?? t.payment_method ?? t.paymentMethod ?? t.tipo ?? '';
      const type = classifyMove(rawReason);
      const tsObj = new Date(t.ts || t.date || t.data);
      const tsISO = isNaN(tsObj.getTime()) ? new Date().toISOString() : tsObj.toISOString();
      const amountSigned = (type === 'withdraw' ? -amountAbs : amountAbs); // cancel_withdraw is positive
      const dir = type === 'withdraw' ? 'out' : 'in';
      return { ts: tsISO, amount: amountAbs, amountSigned, dir, type, method: normalizeMethod(methodRaw, rawReason), reason };
    });

    // do NOT drop cancel_withdraw: we need them to net withdrawals

    // ---------- Indicators ----------
    function computeIndicators(list) {
      const monthMap = new Map();
      for (const t of list) {
        const d = new Date(t.ts);
        if (isNaN(d.getTime())) continue;
        const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        let rec = monthMap.get(key);
        if (!rec) { rec = { month: key, depSum: 0, wSigned: 0 }; monthMap.set(key, rec); }
        if (t.type === 'deposit') rec.depSum += Math.abs(t.amount || 0);
        if (t.type === 'withdraw' || t.type === 'cancel_withdraw') rec.wSigned += (t.amountSigned || 0);
      }
      const net_flow_by_month = Array.from(monthMap.entries())
        .sort((a,b)=>a[0].localeCompare(b[0]))
        .map(([month, r]) => ({ month, deposits: +(r.depSum.toFixed(2)), withdrawals: +Math.abs(r.wSigned).toFixed(2) }));

      // hourly histogram (count withdraw events only)
      const hours = Array.from({length:24}, (_,i)=>({ hour: i, count: 0 }));
      for (const t of list) {
        if (t.type !== 'withdraw') continue;
        const d = new Date(t.ts);
        if (isNaN(d.getTime())) continue;
        const h = d.getHours();
        if (h>=0 && h<24) hours[h].count++;
      }
      const hourly_histogram = hours;

      const counts = {};
      const allowed = new Set(['card','bank','ewallet','crypto','voucher']);
      for (const t of list) {
        if (t.type !== 'withdraw' && t.type !== 'deposit') continue;
        const m = t.method;
        if (allowed.has(m)) counts[m] = (counts[m]||0)+1;
      }
      const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
      const method_breakdown = Object.entries(counts).map(([method, c])=>({ method, pct: +(100*c/total).toFixed(2) }));

      return { net_flow_by_month, hourly_histogram, method_breakdown };
    }
    }
    }

    const indicators = computeIndicators(sanitized);

    // ---------- Totals (positive numbers, only deposit/withdraw) ----------
    const totals = sanitized.reduce((acc, t) => {
      if (t.type === 'deposit') acc.deposits += Math.abs(t.amount || 0);
      if (t.type === 'withdraw' || t.type === 'cancel_withdraw') acc._wSigned += (t.amountSigned || 0);
      return acc;
    }, { deposits: 0, _wSigned: 0 });
    totals.withdrawals = Math.abs(totals._wSigned);
    delete totals._wSigned;

    // ---------- AI Call ----------
    const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
    const model = "google/gemini-2.5-flash";

    const systemPrompt =
      "Sei un analista AML/Fraud.\n" +
      "Restituisci SOLO JSON: {\"risk_score\": number 0-100, \"summary\": string}.\n" +
      "Usa ESATTAMENTE 'totals' (solo depositi+prelievi) come importi complessivi, numeri positivi con 2 decimali. Niente markdown.";

    const userPrompt = JSON.stringify({ txs: sanitized, indicators, totals });

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 800
    };

    const http = await postJSON(
      OPENROUTER_API,
      {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_PUBLIC_URL || "https://example.com"
      },
      body,
      7000
    );

    if (!(http && (http.ok || http.status === 200))) {
      throw new Error(`openrouter ${http?.status || 'unknown'}: ${String(http?.text || '').slice(0,200)}`);
    }

    let data;
    try { data = JSON.parse(http.text); } catch { data = null; }
    if (!data) throw new Error('openrouter returned non-JSON');

    const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
    function extractJson(s) {
      try { return JSON.parse(s); } catch {}
      const fence = s.replace(/```(?:json)?/g, '').trim();
      try { return JSON.parse(fence); } catch {}
      const i = s.indexOf('{'), j = s.lastIndexOf('}');
      if (i>=0 && j>i) { try { return JSON.parse(s.slice(i, j+1)); } catch {} }
      return null;
    }
    const parsed = extractJson(content) || {};

    const risk_score = Number(parsed.risk_score ?? 35);
    const summary = String(parsed.summary ?? `Attività: Depositi EUR ${totals.deposits.toFixed(2)}, Prelievi EUR ${totals.withdrawals.toFixed(2)}.`);

    return { statusCode: 200, body: JSON.stringify({ risk_score, summary, indicators }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'errore' }) };
  }
};
