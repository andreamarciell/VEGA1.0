// netlify/functions/amlAdvancedAnalysis.js
/* eslint-disable */
// v6: Force structured output using function-calling "tools" to avoid 422 parsing issues.
// Still uses gpt-5-mini with timeout + fallback to gpt-4.1-nano. Includes indicators for charts.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const bodyIn = JSON.parse(event.body || '{}');
    const txs = Array.isArray(bodyIn.txs) ? bodyIn.txs : [];

    const sanitizeReason = (s) => {
      if (!s) return '';
      return String(s)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
        .replace(/\b\d{12,19}\b/g, '[card]')
        .replace(/\b[A-Z0-9]{14,}\b/gi, '[id]')
        .replace(/,/g, ';')
        .trim();
    };
    const toNum = (v) => {
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
    };

    // Normalize + CSV
    const header = 'ts,amount,dir,reason';
    const lines = [header];
    const norm = txs.map((t) => {
      const tsRaw = t.ts || t.timestamp || t.date || t.datetime || t.created_at;
      const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
      const amount = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
      let dir = (t.dir || t.direction || t.type || '').toString().toLowerCase();
      if (!(dir === 'in' || dir === 'out')) {
        if (amount < 0) dir = 'out';
        else if (amount > 0) dir = 'in';
        else {
          const r = (t.reason || t.causale || t.description || '').toString().toLowerCase();
          dir = /preliev|withdraw|cashout|payout/.test(r) ? 'out' : 'in';
        }
      }
      const reason = sanitizeReason(t.reason || t.causale || t.description || '');
      lines.push(`${ts},${amount},${dir},${reason}`);
      return { ts, amount, dir, reason };
    });
    const csv = lines.join('\n');

    // Indicators (FUNGE-compatible shapes)
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
    for (const t of norm) {
      const day = t.ts.slice(0, 10);
      const rec = byDay.get(day) || { day, deposits: 0, withdrawals: 0, count: 0 };
      if (t.dir === 'out') rec.withdrawals += Math.abs(t.amount);
      else rec.deposits += Math.abs(t.amount);
      rec.count += 1;
      byDay.set(day, rec);
    }
    const daily_sorted = Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));
    const daily_flow = daily_sorted.map(({ day, deposits, withdrawals }) => ({ day, deposits, withdrawals }));
    const daily_count = daily_sorted.map(({ day, count }) => ({ day, count }));

    // Prompt
    const userPrompt = `sei un analista aml per una piattaforma igaming italiana.
riceverai **SOLO** transazioni anonimizzate in CSV: ts,amount,dir,reason (UTC).

compito: scrivi una **SINTESI GENERALE molto dettagliata** (in italiano) che includa:
- totali complessivi **DEPOSITATO** e **PRELEVATO** (calcolali dal CSV);
- prodotti su cui è focalizzata l’attività (slot, casino live, poker, sportsbook, lotterie, altro) se deducibili;
- anomalie/pattern (structuring, round-tripping, bonus abuse, mirror transactions, escalation/decrescita, un-rounding, tempi ristretti, orari notturni);
- picchi con **giorni e fasce orarie**;
- cambi di metodo di pagamento (se deducibili);
- indicatori di rischio AML osservati.
assegna un punteggio **RISK_SCORE** 0–100.`;

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://example.com',
      'X-Title': process.env.APP_TITLE || 'Toppery AML'
    };

    const toolSchema = {
      name: 'emit',
      description: 'Restituisce l\'output finale strutturato dell\'analisi AML',
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
        // use tools to get a structured function call instead of free text
        tools: [{ type: 'function', function: toolSchema }],
        tool_choice: { type: 'function', function: { name: 'emit' } },
        max_tokens: 650,
        messages: [
          { role: 'system', content: 'Sei un analista AML senior. Usa SEMPRE la funzione "emit" per rispondere.' },
          { role: 'user', content: `${userPrompt}\n\nDATI (CSV):\n${csv}` }
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

    // Try models with timeouts
    let data, lastErr;
    for (const [model, ms] of [['openai/gpt-5-mini', 28000], ['openai/gpt-4.1-nano', 18000]]) {
      try {
        data = await callOpenRouter(model, ms);
        lastErr = null; break;
      } catch (e) { lastErr = e; }
    }
    if (!data) {
      return { statusCode: 504, body: JSON.stringify({ code: 'upstream_timeout_or_error', detail: String(lastErr) }) };
    }

    // Extract tool call arguments
    try {
      const msg = data?.choices?.[0]?.message;
      const tool = msg?.tool_calls?.[0];
      const args = tool?.function?.arguments;
      const parsed = typeof args === 'string' ? JSON.parse(args) : (args || {});
      const summary = String(parsed.summary || '');
      const riskScore = Number(parsed.risk_score ?? 0);
      const out = {
        summary,
        risk_score: Number.isFinite(riskScore) ? riskScore : 0,
        indicators: {
          net_flow_by_month,
          hourly_histogram,
          method_breakdown,
          daily_flow,
          daily_count
        }
      };
      return { statusCode: 200, body: JSON.stringify(out) };
    } catch (e) {
      return { statusCode: 422, body: JSON.stringify({ code: 'invalid_tool_output', detail: String(e) }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
