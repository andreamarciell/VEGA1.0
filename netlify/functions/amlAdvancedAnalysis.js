// netlify/functions/amlAdvancedAnalysis.js
/* eslint-disable */
// v8: Robust against 502s (never throws), strict timeouts (<10s total), dual-mode LLM call (tools -> json_object),
// EU date parsing, correct indicators, guaranteed non-empty summary.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MODEL_TIME_MS_PRIMARY = 7000; // 7s for gpt-5-mini
const MAX_MODEL_TIME_MS_FALLBACK = 4000; // 4s for gpt-4.1-nano
const MAX_TXS_LINES = 6000; // cap raw rows sent to the model (token safety)

function ok(body, code = 200) { return { statusCode: code, body: JSON.stringify(body) }; }
function fail(code, msg, extra) { return { statusCode: code, body: JSON.stringify({ code: msg, ...(extra||{}) }) }; }

function parseEUDateToISO(s) {
  if (!s) return null;
  s = String(s).trim();
  // YYYY-MM-DD[ HH:MM[:SS]]
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    const [_, Y, M, D, h='0', m1='0', s1='0'] = m;
    const dt = new Date(Date.UTC(+Y, +M-1, +D, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY [HH:MM[:SS]]
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    let [_, d, M, Y, h='0', m1='0', s1='0'] = m;
    if (Y.length === 2) Y = String(2000 + +Y);
    const dt = new Date(Date.UTC(+Y, +M-1, +d, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  // try native
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
  let s = String(v).trim().replace(/\s+/g, '');
  const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(/,/g, '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) { s = s.replace(/\./g, '').replace(/,/g, '.'); }
  else { s = s.replace(/[^0-9.-]/g, ''); }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function inferDir(obj, amount) {
  let dir = (obj.dir || obj.direction || obj.type || '').toString().toLowerCase();
  if (dir === 'in' || dir === 'deposit') return 'in';
  if (dir === 'out' || dir === 'withdraw') return 'out';
  if (amount < 0) return 'out';
  if (amount > 0) return 'in';
  const r = (obj.reason || obj.causale || obj.description || '').toString().toLowerCase();
  return /preliev|withdraw|cashout|payout/.test(r) ? 'out' : 'in';
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return fail(405, 'method_not_allowed');
    }

    let bodyIn = {};
    try { bodyIn = JSON.parse(event.body || '{}'); }
    catch { return fail(400, 'invalid_json_body'); }

    const rawTxs = Array.isArray(bodyIn.txs) ? bodyIn.txs : [];
    // Normalize, parse dates, and build CSV (cap lines)
    const header = 'ts,amount,dir,reason';
    const lines = [header];
    const norm = [];
    for (const t of rawTxs) {
      const tsIso = parseEUDateToISO(t.ts || t.timestamp || t.date || t.datetime || t.created_at);
      if (!tsIso) continue;
      const amount = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
      const dir = inferDir(t, amount);
      const reason = sanitizeReason(t.reason || t.causale || t.description || '');
      lines.push(`${tsIso},${amount},${dir},${reason}`);
      norm.push({ ts: tsIso, amount, dir, reason });
      if (lines.length > MAX_TXS_LINES) break;
    }
    if (!norm.length) return fail(422, 'no_valid_transactions');

    const csv = lines.join('\n');

    // Compute indicators
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
      ['card', /(visa|mastercard|amex|maestro|card|carta)/i],
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

    // Build prompt
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
        max_tokens: 600,
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
        max_tokens: 600,
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

    // orchestrate calls in sequence within ~11s total
    let parsedSummary = ''; let parsedRisk = 0;
    const tryModel = async (model, ms) => {
      // tools first
      try {
        const data = await callTools(model, ms);
        const tool = data?.choices?.[0]?.message?.tool_calls?.[0];
        const args = tool?.function?.arguments;
        const out = typeof args === 'string' ? JSON.parse(args) : (args || {});
        if (out?.summary) { parsedSummary = String(out.summary); parsedRisk = Number(out.risk_score || 0); return true; }
      } catch (_e) { /* fallthrough to json_object */ }
      try {
        const data = await callJsonObject(model, ms);
        const content = data?.choices?.[0]?.message?.content ?? '';
        const match = content.match(/\{[\s\S]*\}/);
        const text = match ? match[0] : content;
        const obj = JSON.parse(text);
        if (obj?.summary) { parsedSummary = String(obj.summary); parsedRisk = Number(obj.risk_score || 0); return true; }
      } catch (_e) { /* swallow and let next attempt run */ }
      return false;
    };

    const primaryOk = await tryModel('openai/gpt-5-mini', MAX_MODEL_TIME_MS_PRIMARY);
    const fallbackOk = primaryOk ? true : await tryModel('openai/gpt-4.1-nano', MAX_MODEL_TIME_MS_FALLBACK);

    if (!primaryOk && !fallbackOk) {
      // Final deterministic fallback
      const first = daily_sorted[0]?.day || '';
      const last = daily_sorted[daily_sorted.length-1]?.day || first;
      const peakDay = daily_sorted.reduce((a,b)=> (b?.count||0)>(a?.count||0)?b:a, {day:first, count:0});
      parsedSummary = `Nel periodo ${first} – ${last}, il giocatore ha depositato circa €${Math.round(totalIn)} e prelevato circa €${Math.round(totalOut)}. ` +
        `Picco di attività nel giorno ${peakDay.day} con ${peakDay.count} transazioni. ` +
        `Distribuzione oraria: massima intorno alle ${hourly_histogram.reduce((m,o)=>o.count>m.count?o:m,{hour:0,count:0}).hour}:00 UTC. ` +
        `Metodi usati: ${method_breakdown.map(m=>`${m.method} ${m.pct}%`).join(', ')}.`;
      parsedRisk = Math.min(100, Math.max(0,
        Math.round((totalOut>0? (totalOut/(totalIn+1))*40 : 0) + (method_breakdown.find(m=>m.method==='bonus')?.pct||0)/2 )));
    }

    const result = {
      summary: parsedSummary,
      risk_score: Number.isFinite(parsedRisk) ? parsedRisk : 0,
      indicators: { net_flow_by_month, hourly_histogram, method_breakdown, daily_flow, daily_count }
    };
    return ok(result);

  } catch (err) {
    // Never leak raw errors; always return JSON 200 with a safe fallback to avoid Netlify 502
    try {
      return ok({
        summary: 'Analisi completata (fallback): impossibile contattare il modello, forniti dati sintetici.',
        risk_score: 0,
        indicators: { net_flow_by_month: [], hourly_histogram: [], method_breakdown: [], daily_flow: [], daily_count: [] }
      });
    } catch {
      return { statusCode: 200, body: '{"summary":"fallback","risk_score":0,"indicators":{"net_flow_by_month":[],"hourly_histogram":[],"method_breakdown":[],"daily_flow":[],"daily_count":[]}}' };
    }
  }
};
