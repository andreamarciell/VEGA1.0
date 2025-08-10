// netlify/functions/amlAdvancedAnalysis.js
/* eslint-disable */
// Advanced AML analysis via OpenRouter using gpt-5-mini.
// - Sends anonymized CSV (ts,amount,dir,reason).
// - Returns: { summary, risk_score, indicators: { net_flow_by_month, hourly_histogram, method_breakdown, daily_flow, daily_count } }

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
      } else if (lastComma > -1) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        s = s.replace(/[^0-9.-]/g, '');
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };

    // Normalize txs and build CSV
    const header = 'ts,amount,dir,reason';
    const lines = [header];
    const norm = txs.map((t) => {
      const tsRaw = t.ts || t.timestamp || t.date || t.datetime || t.created_at;
      const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
      const amount = toNum(t.amount ?? t.importo ?? t.value ?? t.sum ?? 0);
      // infer dir consistently
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

    // ---- Compute indicators server-side (as in FUNGE shapes) ----
    // 1) net_flow_by_month
    const byMonth = new Map();
    for (const t of norm) {
      const ym = t.ts.slice(0, 7);
      const rec = byMonth.get(ym) || { month: ym, deposits: 0, withdrawals: 0 };
      if (t.dir === 'out') rec.withdrawals += Math.abs(t.amount);
      else rec.deposits += Math.abs(t.amount);
      byMonth.set(ym, rec);
    }
    const net_flow_by_month = Array.from(byMonth.values()).sort((a,b)=>a.month.localeCompare(b.month));

    // 2) hourly_histogram
    const hourly_histogram = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const t of norm) {
      const h = new Date(t.ts).getUTCHours();
      if (Number.isFinite(h)) hourly_histogram[h].count += 1;
    }

    // 3) method_breakdown (percentage like FUNGE)
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
      for (const [k, re] of rules) {
        if (re.test(r)) { buckets[k] += 1; matched = true; break; }
      }
      if (!matched) buckets.other += 1;
    }
    const totalBuckets = Object.values(buckets).reduce((a,b)=>a+b,0) || 1;
    const method_breakdown = Object.entries(buckets).map(([method, count]) => ({
      method, pct: Math.round((count * 1000) / totalBuckets) / 10
    }));

    // 4) daily_flow & daily_count (for line/bar daily charts)
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

    // ---- LLM call (gpt-5-mini) ----
    const userPrompt = `sei un analista aml per una piattaforma igaming italiana.
riceverai **SOLO** transazioni anonimizzate in CSV: ts,amount,dir,reason (UTC).

compito: scrivi una **SINTESI GENERALE molto dettagliata** (in italiano) che includa *obbligatoriamente*:
- totali complessivi **DEPOSITATO** e **PRELEVATO** (calcolali dal CSV);
- prodotti su cui è focalizzata l’attività (slot, casino live, poker, sportsbook, lotterie, altro) se deducibili;
- anomalie/pattern (structuring, round-tripping, bonus abuse, mirror transactions, escalation/decrescita, un-rounding, tempi ristretti, orari notturni);
- picchi con **giorni e fasce orarie** (es. "2025-06-14 tra 21:00–23:00 UTC");
- eventuali **cambi di metodo di pagamento** (es. deposito cash vs prelievo su carta);
- indicatori di rischio AML osservati.
assegna anche un punteggio **RISK_SCORE** 0–100 (0 basso, 100 massimo).

rispondi **SOLO** con **JSON valido** (nessun testo fuori dal JSON) con **esattamente** queste chiavi:
{ "summary": string, "risk_score": number }

DATI (CSV):
${csv}
`;

    const payload = {
      model: 'openai/gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Sei un analista AML senior. Rispondi solo con JSON valido.' },
        { role: 'user', content: userPrompt }
      ]
    };

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://example.com',
        'X-Title': process.env.APP_TITLE || 'Toppery AML'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, body: rawText };
    }

    let llm;
    try {
      const data = JSON.parse(rawText);
      const content = data?.choices?.[0]?.message?.content ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      const jsonText = match ? match[0] : content;
      llm = JSON.parse(jsonText);
      if (typeof llm.risk_score !== 'number') {
        const n = Number(llm.risk_score);
        llm.risk_score = Number.isFinite(n) ? n : 0;
      }
      if (typeof llm.summary !== 'string') llm.summary = String(llm.summary || '');
    } catch (e) {
      return {
        statusCode: 422,
        body: JSON.stringify({ code: 'invalid_json_from_model', detail: e.message, upstream: rawText })
      };
    }

    const out = {
      summary: llm.summary,
      risk_score: llm.risk_score,
      indicators: {
        net_flow_by_month,
        hourly_histogram,
        method_breakdown,
        daily_flow,
        daily_count
      }
    };

    return { statusCode: 200, body: JSON.stringify(out) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
