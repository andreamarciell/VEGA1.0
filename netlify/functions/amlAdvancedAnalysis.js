// netlify/functions/amlAdvancedAnalysis.js
/* eslint-disable */
// v7: robust EU date parsing (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, with time),
// ensures summary is never empty (LLM tools + JSON fallback + server-crafted summary),
// gpt-5-mini primary with fallback to gpt-4.1-nano, indicators computed server-side.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function parseEUDateToISO(s) {
  if (!s) return null;
  s = String(s).trim();
  // 1) YYYY-MM-DD[ HH:MM[:SS]]
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    const [_, Y, M, D, h='0', m1='0', s1='0'] = m;
    const dt = new Date(Date.UTC(+Y, +M-1, +D, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  // 2) DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY [HH:MM[:SS]]
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (m) {
    let [_, d, M, Y, h='0', m1='0', s1='0'] = m;
    if (Y.length === 2) Y = String(2000 + +Y);
    const dt = new Date(Date.UTC(+Y, +M-1, +d, +h, +m1, +s1));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  // 3) ISO already?
  const maybe = Date.parse(s);
  if (!isNaN(maybe)) {
    const dt = new Date(maybe);
    return isNaN(dt.getTime()) ? null : new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds())).toISOString();
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

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const bodyIn = JSON.parse(event.body || '{}');
    const txs = Array.isArray(bodyIn.txs) ? bodyIn.txs : [];

    // Normalize + CSV
    const header = 'ts,amount,dir,reason';
    const lines = [header];
    const norm = [];
    for (const t of txs) {
      const tsIso = parseEUDateToISO(t.ts || t.timestamp || t.date || t.datetime || t.created_at);
      if (!tsIso) continue; // skip rows without valid timestamp rather than corrupt aggregation
      const amount = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
      const dir = inferDir(t, amount);
      const reason = sanitizeReason(t.reason || t.causale || t.description || '');
      lines.push(`${tsIso},${amount},${dir},${reason}`);
      norm.push({ ts: tsIso, amount, dir, reason });
    }
    const csv = lines.join('\n');

    // Indicators (FUNGE shapes)
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

    // Build prompt and call models using tools
    const userPrompt = `Sei un analista AML per una piattaforma iGaming italiana.
Riceverai SOLO transazioni anonimizzate in CSV: ts,amount,dir,reason (UTC).
Compito: scrivi una SINTESI GENERALE molto dettagliata (in italiano) che includa:
- Totale DEPOSITATO (circa: €${Math.round(totalIn)}) e PRELEVATO (circa: €${Math.round(totalOut)}).
- Prodotti principali (slot, casino live, poker, sportsbook, lotterie, altro) se deducibili.
- Anomalie/pattern (structuring, round-tripping, bonus abuse, mirror transactions, escalation/decrescita, un-rounding, tempi ristretti, orari notturni).
- Picchi con giorni e fasce orarie.
- Eventuali cambi di metodo di pagamento.
- Indicatori di rischio AML osservati.
Assegna un punteggio RISK_SCORE 0–100.
Rispondi SOLO usando la funzione emit(summary, risk_score).

DATI (CSV):
${csv}`;

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://example.com',
      'X-Title': process.env.APP_TITLE || 'Toppery AML'
    };

    const toolSchema = {
      name: 'emit',
      description: 'Restituisce il risultato finale dell’analisi',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          risk_score: { type: 'number' }
        },
        required: ['summary', 'risk_score'],
        additionalProperties: false
      }
    };

    const callOpenRouter = async (model, timeoutMs) => {
      const payload = {
        model,
        tools: [{ type: 'function', function: toolSchema }],
        tool_choice: { type: 'function', function: { name: 'emit' } },
        max_tokens: 700,
        messages: [
          { role: 'system', content: 'Sei un analista AML senior. Usa SEMPRE la funzione "emit" per rispondere.' },
          { role: 'user', content: userPrompt }
        ]
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(OPENROUTER_URL, { method: 'POST', headers: baseHeaders, body: JSON.stringify(payload), signal: controller.signal });
        const text = await resp.text();
        if (!resp.ok) throw new Error(`upstream_${resp.status}: ${text.slice(0,500)}`);
        return JSON.parse(text);
      } finally { clearTimeout(timer); }
    };

    let data, lastErr;
    for (const [model, ms] of [['openai/gpt-5-mini', 28000], ['openai/gpt-4.1-nano', 18000]]) {
      try { data = await callOpenRouter(model, ms); lastErr = null; break; }
      catch(e){ lastErr = e; }
    }

    let summary = '', riskScore = 0;
    if (data) {
      const msg = data?.choices?.[0]?.message;
      const tool = msg?.tool_calls?.[0];
      const args = tool?.function?.arguments;
      try {
        const parsed = typeof args === 'string' ? JSON.parse(args) : (args || {});
        summary = String(parsed.summary || '');
        riskScore = Number(parsed.risk_score ?? 0);
      } catch(e) { /* will fallback below */ }
    }

    // Fallback if model failed to provide structured output
    if (!summary) {
      // lightweight server-crafted narrative
      const first = daily_sorted[0]?.day || '';
      const last = daily_sorted[daily_sorted.length-1]?.day || first;
      const peakDay = daily_sorted.reduce((a,b)=> (b?.count||0)>(a?.count||0)?b:a, {day:first, count:0});
      summary = `Nel periodo ${first} – ${last}, il giocatore ha depositato circa €${Math.round(totalIn)} e prelevato circa €${Math.round(totalOut)}. ` +
        `L'attività mostra picchi nel giorno ${peakDay.day} con ${peakDay.count} transazioni. ` +
        `Distribuzione oraria concentrata tra le ${hourly_histogram.reduce((m,o)=>o.count>m.count?o:m,{hour:0,count:0}).hour}:00 e le ore adiacenti. ` +
        `Metodi: ${method_breakdown.map(m=>`${m.method} ${m.pct}%`).join(', ')}.`;
      riskScore =  Math.min(100, Math.max(0, Math.round((totalOut>0? (totalOut/(totalIn+1))*40 : 0) + (method_breakdown.find(m=>m.method==='bonus')?.pct||0)/2 ));
    }

    const out = {
      summary,
      risk_score: Number.isFinite(riskScore) ? riskScore : 0,
      indicators: { net_flow_by_month, hourly_histogram, method_breakdown, daily_flow, daily_count }
    };
    return { statusCode: 200, body: JSON.stringify(out) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
