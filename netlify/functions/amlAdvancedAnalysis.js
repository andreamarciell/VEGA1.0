/** Netlify Function: amlAdvancedAnalysis
 * POST body: { txs: [{ ts, amount, dir, method?, reason? }] }
 * Returns: { risk_score:number, summary:string, indicators:{ net_flow_by_month, hourly_histogram, method_breakdown } }
 */
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

    // helpers
    function parseAmount(v) {
      if (typeof v === 'number') return v;
      const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }
    function normalizeDir(dir, amount, reason='') {
      const s = String(dir || reason || '').toLowerCase();
      if (/(preliev|withdraw|payout|cash ?out|incasso|uscita)/.test(s)) return 'out';
      if (/(deposit|deposi|versament|ricaric|caric)/.test(s)) return 'in';
      if (typeof amount === 'number' && amount < 0) return 'out';
      return 'in';
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

    // sanitize & normalize txs
    const sanitized = txs.map(t => {
      const rawAmount = (t.amount ?? t.importo ?? 0);
      const amount = parseAmount(rawAmount);
      const reason = String(t.reason ?? t.causale ?? '')
        .toLowerCase()
        .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
        .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
        .replace(/[0-9]{6,}/g, '[num]');
      const methodRaw = t.method ?? t.metodo ?? t.payment_method ?? t.paymentMethod ?? t.tipo ?? '';
      const dir = normalizeDir(t.dir, amount, reason);
      const ts = new Date(t.ts || t.date || t.data);
      return {
        ts: isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString(),
        amount,
        dir,
        method: normalizeMethod(methodRaw, reason),
        reason
      };
    });

    // indicators
    function computeIndicatorsFromTxs(list) {
      const monthMap = new Map();
      for (const t of list) {
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        let rec = monthMap.get(key);
        if (!rec) { rec = { month: key, deposits: 0, withdrawals: 0 }; monthMap.set(key, rec); }
        if (t.dir === 'out') rec.withdrawals += Math.abs(t.amount || 0);
        else rec.deposits += Math.abs(t.amount || 0);
      }
      const net_flow_by_month = Array.from(monthMap.values()).sort((a,b)=>a.month.localeCompare(b.month));

      const hours = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
      for (const t of list) {
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const h = d.getHours();
        if (h>=0 && h<24) hours[h].count++;
      }
      const hourly_histogram = hours;

      // method breakdown (only payment categories)
      const counts = {};
      const allowed = new Set(['card','bank','ewallet','crypto','voucher']);
      for (const t of list) {
        const m = t.method;
        if (allowed.has(m)) counts[m] = (counts[m]||0)+1;
      }
      const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
      const method_breakdown = Object.entries(counts).map(([method, c])=>({ method, pct: +(100*c/total).toFixed(2) }));

      return { net_flow_by_month, hourly_histogram, method_breakdown };
    }

    const indicators = computeIndicatorsFromTxs(sanitized);
    const totals = sanitized.reduce((acc, t) => {
      if (t.dir === 'out') acc.withdrawals += Math.abs(t.amount || 0);
      else acc.deposits += Math.abs(t.amount || 0);
      return acc;
    }, { deposits: 0, withdrawals: 0 });

    // Call OpenRouter (Gemini 2.5 Flash)
    const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
    const model = "google/gemini-2.5-flash";

    const systemPrompt = [
      "Sei un analista AML/Fraud esperto in iGaming.",
      "Riceverai una lista di transazioni anonimizzate (ts ISO, amount, dir in/out, method, reason).",
      "Devi restituire SOLO JSON valido con: {\"risk_score\": number 0-100, \"summary\": string}.",
      "Usa ESATTAMENTE i totali forniti in 'totals' per gli importi complessivi (non ricalcolarli).",
      "La summary deve descrivere: totali depositi/prelievi (EUR, 2 decimali), picchi e pattern temporali, metodi più usati, net flow, cicli deposito-prelievo/velocity, possibili indicatori di rischio e una chiusura sintetica. Nessun markdown."
    ].join("\n");

    const userPrompt = JSON.stringify({ txs: sanitized, indicators, totals });

    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_PUBLIC_URL || "https://example.com",
        "X-Title": "Toppery AML – Advanced Analysis"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0,300)}`);
    }

    const j = await res.json();
    let content = (j?.choices?.[0]?.message?.content ?? "").trim();

    // try to extract pure JSON
    function extractJson(s) {
      try { return JSON.parse(s); } catch {}
      // strip code fences
      const fence = s.replace(/```(?:json)?/g, '').trim();
      try { return JSON.parse(fence); } catch {}
      // lenient: find first { ... } block
      const start = s.indexOf('{');
      const end = s.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(s.slice(start, end+1)); } catch {}
      }
      return null;
    }

    const parsed = extractJson(content);
    let risk_score = 0;
    let summary = "";
    if (parsed && typeof parsed === 'object') {
      risk_score = Number(parsed.risk_score ?? 0);
      summary = String(parsed.summary ?? '');
    } else {
      // fallback minimal summary (still valid)
      const dep = indicators.net_flow_by_month.reduce((a,b)=>a+b.deposits,0);
      const wit = indicators.net_flow_by_month.reduce((a,b)=>a+b.withdrawals,0);
      summary = `Attività analizzata: Depositi totali EUR ${dep.toFixed(2)}, Prelievi totali EUR ${wit.toFixed(2)}.`;
      risk_score = 35;
    }

    const out = { risk_score, summary, indicators };
    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'errore' }) };
  }
};
