
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
/** Netlify Function: amlAdvancedAnalysis
 * POST body: { txs: [{ ts, amount, dir, reason }
function classifyMove(reason='') {
  const s = String(reason || '').toLowerCase();
  // Depositi: SOLO causali contenenti 'deposito' oppure 'ricarica'
  if (/(^|)(deposito|ricarica)(|$)/.test(s)) return 'deposit';
  // Prelievi: SOLO causali contenenti 'prelievo', escludendo 'annullamento'
  if (/(^|)prelievo(|$)/.test(s) && !/(^|)annullamento(|$)/.test(s)) return 'withdraw';
  if (/(^|)bonus(|$)/.test(s)) return 'bonus';
  if (/(refund|chargeback|rimborso|storno)/.test(s)) return 'refund';
  return 'other';
}] }
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

    // Sanitize/normalize txs for the model
    const sanitized = txs.map(t => ({
      ts: new Date(t.ts).toISOString(),
      amount: Number(t.amount) || 0,
      dir: (t.dir === 'out' ? 'out' : 'in'),
      method: String(t.method || ''),
      reason: (String(t.reason || '')
        .toLowerCase()
        .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
        .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
        .replace(/[0-9]{6,}/g, '[num]'))
    }));

    function classifyMethod(reason='') {
      const s = String(reason).toLowerCase();
      if (/visa|mastercard|amex|maestro|carta|card/.test(s)) return 'card';
      if (/sepa|bonifico|bank|iban/.test(s)) return 'bank';
      if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) return 'ewallet';
      if (/crypto|btc|eth|usdt|usdc/.test(s)) return 'crypto';
      if (/paysafecard|voucher|coupon/.test(s)) return 'voucher';
      if (/bonus|promo/.test(s)) return 'bonus';
      return 'other';
    }

    // Fallback indicators we always compute locally (used by UI charts)
    function computeIndicatorsFromTxs(txs) {
      const monthMap = new Map();
      for (const t of txs) {
        if (t.type !== 'deposit' && t.type !== 'withdraw') continue;
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        let rec = monthMap.get(key);
        if (!rec) { rec = { month: key, deposits: 0, withdrawals: 0 }; monthMap.set(key, rec); }
        if (t.type === 'withdraw') rec.withdrawals += Math.abs(t.amount || 0);
        else rec.deposits += Math.abs(t.amount || 0);
      }
      const net_flow_by_month = Array.from(monthMap.values()).sort((a,b)=>a.month.localeCompare(b.month));

      const hours = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
      for (const t of txs) {
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const h = d.getHours();
        if (h>=0 && h<24) hours[h].count++;
      }
      const hourly_histogram = hours;

      const counts = {};
      for (const t of txs) {
        const m = t.method || classifyMethod(t.reason);
        counts[m] = (counts[m]||0)+1;
      }
      const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
      const method_breakdown = Object.entries(counts).map(([method, c])=>({ method, pct: +(100*c/total).toFixed(2) }));

      return { net_flow_by_month, hourly_histogram, method_breakdown };
    }

    const indicators = computeIndicatorsFromTxs(sanitized);
    const totals = sanitized.reduce((acc, t) => {
  if (t.type === 'withdraw') acc.withdrawals += Math.abs(t.amount || 0);
  else if (t.type === 'deposit') acc.deposits += Math.abs(t.amount || 0);
  return acc;
}, { deposits: 0, withdrawals: 0 });
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
    const model = "google/gemini-2.5-flash";

    const systemPrompt = [
      "Sei un analista AML/Fraud esperto in iGaming.",
      "Riceverai una lista di transazioni anonimizzate (ts ISO, amount, dir in/out, method, reason snippata).",
      "Devi restituire **SOLO** JSON valido, senza testo extra, con questo schema minimo:",
      "{\"risk_score\": number 0-100, \"summary\": string }",
      "Usa ESATTAMENTE i totali forniti in 'totals' (solo depositi+prelievi) per gli importi complessivi (non ricalcolarli). Usa ESATTAMENTE i totali in 'totals' (solo depositi+prelievi) senza ricalcolarli. La `summary` deve essere una descrizione *dettagliata* dell'attività:",
      "- totali depositi e prelievi complessivi (in EUR, arrotonda a 2 decimali),",
      "- andamento/volatilità, picchi e pattern temporali (fasce orarie/giorni),",
      "- metodi più usati, segni di possibile layering/churning, cicli deposito-prelievo, velocity, net flow,",
      "- dinamiche di gioco plausibili deducibili (es. sessioni notturne/brevi/lunghe),",
      "- indicatori di rischio pertinenti (senza etichettarli come 'flags'),",
      "- un closing sintetico con valutazione del profilo.",
      "NON includere campi diversi da risk_score e summary. Nessun markdown."
    ].join("\n");

    const userPrompt = JSON.stringify({ txs: sanitized, indicators, totals });

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2
    };

    let risk_score = 0;
    let summary = "";
    try {
      const res = await fetch(OPENROUTER_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_PUBLIC_URL || "https://example.com",
                  },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(()=>String(res.status));
        throw new Error(`openrouter ${res.status}: ${errText.slice(0,200)}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      let parsed = null;
      if (typeof content === "string") {
        try { parsed = JSON.parse(content); } catch {}
      } else if (content && typeof content === "object") {
        parsed = content;
      }
      if (parsed && typeof parsed.risk_score === 'number' && typeof parsed.summary === 'string') {
        risk_score = parsed.risk_score;
        summary = parsed.summary;
      } else {
        // Fallback minimal summary if the model failed to comply
        const dep = indicators.net_flow_by_month.reduce((a,b)=>a+b.deposits,0);
        const wit = indicators.net_flow_by_month.reduce((a,b)=>a+b.withdrawals,0);
        summary = `Analisi automatica: depositi totali €${dep.toFixed(2)}, prelievi totali €${wit.toFixed(2)}. ` +
                  `Metodo prevalente: ${(indicators.method_breakdown.sort((a,b)=>b.pct-a.pct)[0]||{}).method || 'n/d'}. ` +
                  `Attività distribuita nelle ${indicators.hourly_histogram.filter(h=>h.count>0).map(h=>h.hour).length} ore su 24.`;
        risk_score = 35;
      }
    } catch (err) {
      // Non forziamo 200: spieghiamo l'errore
      return { statusCode: 500, body: JSON.stringify({ error: (err && err.message) || String(err) }) };
    }

    const out = {
      risk_score,
      summary,
      indicators
    };

    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'errore' }) };
  }
};