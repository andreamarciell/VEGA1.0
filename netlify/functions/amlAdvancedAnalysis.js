
'use strict';

const https = require('https');

module.exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  try {
    const { txs, gameplay = [] } = JSON.parse(event.body || '{}');
    if (!Array.isArray(txs) || txs.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'payload mancante' }) };
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    // sanitizers
    function sanitizeReason(s='') {
      return String(s || '')
        .replace(/\b(utente|id|player|user|account)[-_ ]?\d+\b/gi, '[id]')
        .replace(/[0-9]{6,}/g, '[num]')
        .trim();
    }
    function parseAmount(x) {
      if (typeof x === 'number') return x;
      let s = String(x ?? '').trim();
      if (!s) return 0;
      const hasDot = s.includes('.');
      const hasComma = s.includes(',');
      if (hasDot && hasComma) {
        if (s.lastIndexOf('.') < s.lastIndexOf(',')) {
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
      return 'other';
    }
    function classifyMove(reason='') {
      const s = String(reason || '').toLowerCase();
      const hasPrelievo = /(^|\b)prelievo(\b|$)/.test(s);
      const isCancelled = /(\bannullamento\b|\bstorno\b|\brimborso\b)/.test(s);
      if (/(^|\b)(deposito|ricarica)(\b|$)/.test(s)) return 'deposit';
      if (hasPrelievo && isCancelled) return 'cancel_withdraw';
      if (hasPrelievo) return 'withdraw';
      return 'other';
    }

    // sanitize
    const sanitized = txs.map(t => {
      const rawAmount = (t.amount ?? t.importo ?? 0);
      const amountAbs = Math.abs(parseAmount(rawAmount));
      const rawReason = (t.reason ?? t.causale ?? t.desc ?? '');
      const reason = sanitizeReason(rawReason);
      const methodRaw = t.method ?? t.metodo ?? t.payment_method ?? t.paymentMethod ?? t.tipo ?? '';
      const type = classifyMove(rawReason);
      const tsObj = new Date(t.ts || t.date || t.data);
      const tsISO = isNaN(tsObj.getTime()) ? new Date().toISOString() : tsObj.toISOString();
      const amountSigned = (type === 'withdraw' ? -amountAbs : amountAbs); // cancel_withdraw positive
      const dir = type === 'withdraw' ? 'out' : 'in';
      return { ts: tsISO, amount: amountAbs, amountSigned, dir, type, method: normalizeMethod(methodRaw, rawReason), reason };
    });

    // indicators
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
    const indicators = computeIndicators(sanitized);

    const totals = sanitized.reduce((acc, t) => {
      if (t.type === 'deposit') acc.deposits += Math.abs(t.amount || 0);
      if (t.type === 'withdraw' || t.type === 'cancel_withdraw') acc._wSigned += (t.amountSigned || 0);
      return acc;
    }, { deposits: 0, _wSigned: 0 });
    totals.withdrawals = Math.abs(totals._wSigned);
    delete totals._wSigned;

    // AI call with https.request (no fetch dependency)
    if (!OPENROUTER_API_KEY) {
      // return meaningful 500 JSON, not 502
      return { statusCode: 500, body: JSON.stringify({ error: 'OPENROUTER_API_KEY mancante' }) };
    }

    const systemPrompt = "Sei un analista AML/Fraud esperto in iGaming. Rispondi SOLO con JSON valido: {\"risk_score\": number 0-100, \"summary\": string}. Scrivi la risposta in italiano. Nel campo \"summary\": 1) INIZIA sempre con \"Depositi EUR ${totals.deposits.toFixed(2)}, Prelievi EUR ${totals.withdrawals.toFixed(2)}.\" (usa ESATTAMENTE i valori di \"totals\"). 2) Riassumi l'attività. 3) Evidenzia indicatori AML (cash-out aggressivo, smurfing/structuring, concentrazione oraria/notturna, uso voucher, importi elevati/ravvicinati). 4) Indica eventuali picchi/cluster temporali utilizzando \"indicators\". 5) Analizza il gameplay usando \"gameplay\": identifica slot/scommesse/vincite e segnala trend (senza inventare numeri). 6) NON inventare dati: usa solo \"totals\", \"indicators\", \"gameplay\". 7) Niente markdown/code block; massimo 8-10 frasi, tono professionale."; massimo 8-10 frasi, chiare e professionali.";

    const body = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ txs: sanitized, indicators, totals, gameplay }) }
      ],
      temperature: 0.2,
      max_tokens: 800
    });

    const openrouterResponse = await new Promise((resolve) => {
      const req = https.request({
        method: 'POST',
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 10000
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', (err) => resolve({ status: 0, text: String(err?.message || err) }));
      req.write(body);
      req.end();
    });

    if (!openrouterResponse || !(openrouterResponse.status && openrouterResponse.status >= 200 && openrouterResponse.status < 300)) {
      return { statusCode: 500, body: JSON.stringify({ error: `openrouter ${openrouterResponse?.status || 0}: ${String(openrouterResponse?.text || '').slice(0,200)}` }) };
    }

    let parsed;
    try { parsed = JSON.parse(openrouterResponse.text); } catch { parsed = null; }
    if (!parsed) return { statusCode: 500, body: JSON.stringify({ error: 'openrouter returned non-JSON' }) };

    const content = String(parsed?.choices?.[0]?.message?.content ?? '').trim();
    let ai;
    try { ai = JSON.parse(content); } catch {
      const i = content.indexOf('{'), j = content.lastIndexOf('}');
      if (i>=0 && j>i) { try { ai = JSON.parse(content.slice(i, j+1)); } catch {} }
    }
    const risk_score = Number(ai?.risk_score ?? 35);
    const summary = String(ai?.summary ?? `Attività: Depositi EUR ${totals.deposits.toFixed(2)}, Prelievi EUR ${totals.withdrawals.toFixed(2)}.`);

    return { statusCode: 200, body: JSON.stringify({ risk_score, summary, indicators }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'errore' }) };
  }
};
