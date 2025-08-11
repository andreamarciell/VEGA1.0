// netlify/functions/amlAdvancedAnalysis.js
/* eslint-disable */
// v11: trust incoming "dir" when provided; keep robust parsing & indicators; gpt-5-mini analysis.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MODEL_TIME_MS_PRIMARY = 9000;
const MAX_MODEL_TIME_MS_FALLBACK = 5000;
const MAX_TXS_LINES = 8000;

function ok(body, code = 200) { return { statusCode: code, body: JSON.stringify(body) }; }

function parseEUDateToISO(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    const [_, Y, M, D, h='0', m1='0', s1='0'] = m;
    const dt = new Date(Date.UTC(+Y, +M-1, +D, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    let [_, d, M, Y, h='0', m1='0', s1='0'] = m;
    if (Y.length === 2) Y = String(2000 + +Y);
    const dt = new Date(Date.UTC(+Y, +M-1, +d, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const maybe = Date.parse(s);
  if (!isNaN(maybe)) {
    const dt = new Date(maybe);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds())).toISOString();
  }
  return null;
}

function sanitizeReason(s) {
  if (!s) return '';
  return String(s)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
    .replace(/\b\d{12,19}\b/g, '[card]')
    .replace(/\b[A-Z0-9]{14,}\b/gi, '[id]')
    .replace(/,/g, ';')
    .trim();
}

function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[^\d.,+-]/g, '');
  s = s.replace(/^\+/, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && !hasDot) {
    if (/^\d{1,3}(?:,\d{3})+$/.test(s)) { s = s.replace(/,/g, ''); }
    else if (/^\d+,\d{1,2}$/.test(s)) { s = s.replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
  } else if (hasDot && !hasComma) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) { s = s.replace(/\./g, ''); }
  } else if (hasDot && hasComma) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) { s = s.replace(/\./g, '').replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
  }
  let n = parseFloat(s);
  if (!Number.isFinite(n)) n = 0;
  if (neg) n = -n;
  return n;
}

function getField(obj, names) {
  const entries = Object.entries(obj || {});
  const lower = new Map(entries.map(([k,v]) => [k.toLowerCase(), v]));
  for (const n of names) {
    const v = lower.get(n.toLowerCase());
    if (v !== undefined && v !== null && v !== '') return v;
  }
  for (const [k, v] of lower) {
    for (const n of names) {
      if (k.includes(n.toLowerCase())) {
        if (v !== undefined && v !== null && v !== '') return v;
      }
    }
  }
  return null;
}

function inferDir(obj, amount) {
  const lowMap = new Map(Object.entries(obj || {}).map(([k,v])=>[k.toLowerCase(), String(v||'').toLowerCase()]));
  for (const [k, v] of lowMap) {
    if (!v) continue;
    if (k.includes('withdraw') || k.includes('preliev') || k.includes('cashout') || k.includes('payout')) return 'out';
    if (k.includes('deposit') || k.includes('ricarica') || k.includes('topup') || k.includes('recharge')) return 'in';
    if (v.includes('withdraw') || v.includes('preliev') || v.includes('cashout') || v.includes('payout')) return 'out';
    if (v.includes('deposit') || v.includes('ricarica') || v.includes('topup') || v.includes('recharge')) return 'in';
  }
  if (amount < 0) return 'out';
  if (amount > 0) return 'in';
  const reason = String(getField(obj, ['reason','causale','description','note','memo','descrizione','Reason']) || '').toLowerCase();
  if (/preliev|withdraw|cashout|payout/.test(reason)) return 'out';
  return 'in';
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return ok({ error: 'method_not_allowed' }, 405);
    }

    let bodyIn = {};
    try { bodyIn = JSON.parse(event.body || '{}'); }
    catch { return ok({ error: 'invalid_json_body' }, 400); }

    const rawTxs = Array.isArray(bodyIn.txs) ? bodyIn.txs : [];

    // Normalize + CSV (trust dir if provided)
    const header = 'ts,amount,dir,reason';
    const lines = [header];
    const norm = [];
    for (const t of rawTxs) {
      const tsRaw = getField(t, ['ts','timestamp','date','datetime','created_at','Date','DATA']);
      const tsIso = parseEUDateToISO(tsRaw);
      if (!tsIso) continue;
      const amountRaw = getField(t, ['amount','importo','value','sum','Amount','Importo']);
      const amount = toNum(amountRaw);
      let dirIn = getField(t, ['dir','direction','type']);
      dirIn = typeof dirIn === 'string' ? dirIn.toLowerCase() : '';
      const dir = (dirIn === 'in' || dirIn === 'out') ? dirIn : inferDir(t, amount);
      const reasonRaw = getField(t, ['reason','causale','description','Reason','Descrizione','Motivo']) || '';
      const reason = sanitizeReason(reasonRaw);
      lines.push(`${tsIso},${amount},${dir},${reason}`);
      norm.push({ ts: tsIso, amount, dir, reason });
      if (lines.length > MAX_TXS_LINES) break;
    }

    if (!norm.length) {
      return ok({
        summary: 'Nessuna transazione valida trovata (verifica formati data/importi).',
        risk_score: 0,
        indicators: { net_flow_by_month: [], hourly_histogram: [], method_breakdown: [], daily_flow: [], daily_count: [] }
      });
    }

    const csv = lines.join('\n');

    // Indicators
    const byMonth = new Map();
    for (const t of norm) {
      const ym = t.ts.slice(0, 7);
      const rec = byMonth.get(ym) || { month: ym, deposits: 0, withdrawals: 0 };
      if (t.dir === 'out') rec.withdrawals += Math.abs(t.amount);
      else rec.deposits += Math.abs(t.amount);
      byMonth.set(ym, rec);
    }
    const net_flow_by_month = Array.from(byMonth.values()).sort((a,b)=>a.month.localeCompare(b.month));

    const hourly_histogram = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const t of norm) {
      const h = new Date(t.ts).getUTCHours();
      if (Number.isFinite(h)) hourly_histogram[h].count += 1;
    }

    const buckets = { ewallet: 0, card: 0, bank: 0, bonus: 0, other: 0 };
    const rules = [
      ['ewallet', /(skrill|neteller|paypal|ewallet|wise|revolut)/i],
      ['card', /(visa|mastercard|amex|maestro|card|carta|safecharge)/i],
      ['bank', /(bank|bonifico|iban|sepa|wire)/i],
      ['bonus', /(bonus|promo|freebet|voucher)/i],
    ];
    for (const t of norm) {
      const r = t.reason || '';
      let matched = false;
      for (const [k, re] of rules) { if (re.test(r)) { buckets[k] += 1; matched = true; break; } }
      if (!matched) buckets.other += 1;
    }
    const totalBuckets = Object.values(buckets).reduce((a,b)=>a+b,0) || 1;
    const method_breakdown = Object.entries(buckets).map(([method, count]) => ({ method, pct: Math.round((count * 1000) / totalBuckets) / 10 }));

    const byDay = new Map();
    let totalIn = 0, totalOut = 0;
    for (const t of norm) {
      const day = t.ts.slice(0, 10);
      const rec = byDay.get(day) || { day, deposits: 0, withdrawals: 0, count: 0 };
      if (t.dir === 'out') { rec.withdrawals += Math.abs(t.amount); totalOut += Math.abs(t.amount); }
      else { rec.deposits += Math.abs(t.amount); totalIn += Math.abs(t.amount); }
      rec.count += 1;
      byDay.set(day, rec);
    }
    const daily_sorted = Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));
    const daily_flow = daily_sorted.map(({ day, deposits, withdrawals }) => ({ day, deposits, withdrawals }));
    const daily_count = daily_sorted.map(({ day, count }) => ({ day, count }));

    // Prompt
    const prompt = `Sei un analista AML per una piattaforma iGaming italiana.
Riceverai SOLO transazioni anonimizzate in CSV: ts,amount,dir,reason (UTC).
Scrivi una SINTESI GENERALE molto dettagliata che includa:
- Totale DEPOSITATO ≈ €${Math.round(totalIn)} e PRELEVATO ≈ €${Math.round(totalOut)} (calcolati).
- Prodotti principali (slot, casino live, poker, sportsbook, lotterie, altro) se deducibili dal "reason".
- Anomalie/pattern (structuring, round-tripping, bonus abuse, mirror transactions, escalation/decrescita, importi tondi/non-tondi, tempi ristretti, notturni).
- Picchi con giorni e fasce orarie.
- Cambi di metodo di pagamento (se deducibili).
- Indicatori di rischio AML osservati.
Assegna un punteggio RISK_SCORE 0–100.
Rispondi usando SOLO JSON con { "summary": string, "risk_score": number }.

DATI (CSV):
${csv}`;

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://example.com',
      'X-Title': process.env.APP_TITLE || 'Toppery AML'
    };

    const callTools = async (model, timeoutMs) => {
      const toolSchema = {
        name: 'emit',
        description: 'Output finale strutturato dell’analisi AML',
        parameters: {
          type: 'object',
          properties: { summary: { type: 'string' }, risk_score: { type: 'number' } },
          required: ['summary', 'risk_score'],
          additionalProperties: false
        }
      };
      const payload = {
        model,
        tools: [{ type: 'function', function: toolSchema }],
        tool_choice: { type: 'function', function: { name: 'emit' } },
        max_tokens: 650,
        messages: [
          { role: 'system', content: 'Sei un analista AML senior. Usa SEMPRE la funzione "emit" per rispondere.' },
          { role: 'user', content: prompt }
        ]
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(OPENROUTER_URL, { method: 'POST', headers: baseHeaders, body: JSON.stringify(payload), signal: controller.signal });
        const text = await resp.text();
        if (!resp.ok) throw new Error(`upstream_${resp.status}: ${text.slice(0,400)}`);
        return JSON.parse(text);
      } finally { clearTimeout(timer); }
    };
    const callJsonObject = async (model, timeoutMs) => {
      const payload = {
        model,
        response_format: { type: 'json_object' },
        max_tokens: 650,
        messages: [
          { role: 'system', content: 'Sei un analista AML senior. Rispondi SOLO con JSON valido.' },
          { role: 'user', content: prompt }
        ]
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(OPENROUTER_URL, { method: 'POST', headers: baseHeaders, body: JSON.stringify(payload), signal: controller.signal });
        const text = await resp.text();
        if (!resp.ok) throw new Error(`upstream_${resp.status}: ${text.slice(0,400)}`);
        return JSON.parse(text);
      } finally { clearTimeout(timer); }
    };

    async function getLLM() {
      const models = [['openai/gpt-5-mini', MAX_MODEL_TIME_MS_PRIMARY], ['openai/gpt-4.1-nano', MAX_MODEL_TIME_MS_FALLBACK]];
      for (const [model, ms] of models) {
        try {
          const data = await callTools(model, ms);
          const tool = data?.choices?.[0]?.message?.tool_calls?.[0];
          const args = tool?.function?.arguments;
          if (args) {
            const out = typeof args === 'string' ? JSON.parse(args) : (args || {});
            if (out?.summary) return out;
          }
        } catch {}
        try {
          const data = await callJsonObject(model, ms);
          const content = data?.choices?.[0]?.message?.content ?? '';
          const match = content.match(/\{[\s\S]*\}/);
          const text = match ? match[0] : content;
          const obj = JSON.parse(text);
          if (obj?.summary) return obj;
        } catch {}
      }
      return null;
    }

    const llm = await getLLM();

    let summary, risk_score;
    if (llm && typeof llm.summary === 'string') {
      summary = llm.summary;
      const n = Number(llm.risk_score);
      risk_score = Number.isFinite(n) ? n : 0;
    } else {
      const first = daily_sorted[0]?.day || '';
      const last = daily_sorted[daily_sorted.length-1]?.day || first;
      const peakDay = daily_sorted.reduce((a,b)=> (b?.count||0)>(a?.count||0)?b:a, {day:first, count:0});
      const peakHour = hourly_histogram.reduce((m,o)=>o.count>m.count?o:m,{hour:0,count:0}).hour;
      summary = `Nel periodo ${first} – ${last}, il giocatore ha depositato circa €${Math.round(totalIn)} e prelevato circa €${Math.round(totalOut)}. ` +
        `Picco di attività nel giorno ${peakDay.day} e intorno alle ${peakHour}:00 UTC. ` +
        `Metodi usati: ${method_breakdown.map(m=>`${m.method} ${m.pct}%`).join(', ')}.`;
      risk_score = Math.min(100, Math.max(0,
        Math.round((totalOut>0? (totalOut/(totalIn+1))*40 : 0) + (method_breakdown.find(m=>m.method==='bonus')?.pct||0)/2 )));
    }

    const result = {
      summary,
      risk_score,
      indicators: { net_flow_by_month, hourly_histogram, method_breakdown, daily_flow, daily_count }
    };
    return ok(result);

  } catch (err) {
    return ok({
      summary: 'Analisi completata in fallback per errore interno.',
      risk_score: 0,
      indicators: { net_flow_by_month: [], hourly_histogram: [], method_breakdown: [], daily_flow: [], daily_count: [] }
    });
  }
};
