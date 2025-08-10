/**
 * Netlify Function: amlAdvancedAnalysis
 * Purpose: Receive anonymized transactions and produce a descriptive AML summary
 * using OpenRouter with model openai/gpt-4.1-nano. Returns:
 *  - summary (IT)
 *  - risk_score (0-100)
 *  - indicators: { net_flow_by_month, hourly_histogram, method_breakdown } (optional)
 *
 * Notes:
 *  - We avoid brittle json_schema to prevent 500s on some providers; instead we
 *    request JSON via `response_format: { type: "json_object" }`.
 *  - We keep headers HTTP-Referer and X-Title so the app shows up on OpenRouter.
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery.work";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

function sanitizeReason(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, "[email]")
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, "[id]")
    .replace(/[0-9]{6,}/g, "[num]")
    .replace(/\b\w{28,}\b/g, "[token]")
    .slice(0, 300);
}

function toCsv(txs) {
  const header = "ts,amount,dir,reason";
  const lines = txs.map(t => {
    const ts = new Date(t.ts).toISOString().replace(".000Z","Z");
    const amount = Number(t.amount) || 0;
    const dir = (t.dir === "out" || t.dir === "in") ? t.dir : "in";
    const reason = sanitizeReason(t.reason || "");
    // escape quotes
    const r = '"' + reason.replace(/"/g, '""') + '"';
    return [ts, amount.toFixed(2), dir, r].join(",");
  });
  return [header, ...lines].join("\n");
}

/** Optional indicator helpers (server-side) in case client skips them */
function deriveIndicators(txs) {
  try {
    // monthly net flow
    const monthMap = {};
    for (const t of txs) {
      const m = new Date(t.ts);
      if (isNaN(m)) continue;
      const key = `${m.getUTCFullYear()}-${String(m.getUTCMonth()+1).padStart(2,"0")}`;
      const val = Number(t.amount) || 0;
      const dir = t.dir === "out" ? -1 : 1;
      monthMap[key] = (monthMap[key] || 0) + val * dir;
    }
    const net_flow_by_month = Object.entries(monthMap)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, net]) => ({ month, deposits: 0, withdrawals: 0, net }));

    // hourly histogram
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    txs.forEach(t => {
      const d = new Date(t.ts);
      if (isNaN(d)) return;
      hourly[d.getUTCHours()].count += 1;
    });

    // method breakdown (best-effort)
    const counts = {};
    txs.forEach(t => {
      const s = String(t.reason || "").toLowerCase();
      let m = "other";
      if (/visa|mastercard|amex|maestro|carta|card/.test(s)) m = "card";
      else if (/sepa|bonifico|bank|iban/.test(s)) m = "bank";
      else if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) m = "ewallet";
      else if (/crypto|btc|eth|usdt|usdc/.test(s)) m = "crypto";
      else if (/paysafecard|voucher|coupon/.test(s)) m = "voucher";
      else if (/bonus|promo/.test(s)) m = "bonus";
      counts[m] = (counts[m] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const method_breakdown = Object.entries(counts).map(([method, c]) => ({
      method,
      pct: Math.round((100 * (c as number)) / total * 100) / 100,
    }));

    return { net_flow_by_month, hourly_histogram: hourly, method_breakdown };
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "method_not_allowed" }) };
  }
  if (!OPENROUTER_API_KEY) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "missing_openrouter_key" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const txs = Array.isArray(body.txs || body.tx || body.transactions) ? (body.txs || body.tx || body.transactions) : [];
    if (!txs.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "no_transactions" }) };
    }

    const csv = toCsv(txs).slice(0, 900_000); // safety cap ~900k chars (~ tokens dependent)
    const indicators = deriveIndicators(txs);

    const system = [
      "Sei un analista AML per una piattaforma iGaming italiana.",
      "Riceverai SOLO transazioni anonimizzate nel formato CSV: ts,amount,dir,reason.",
      "Compito:",
      "- Fornisci un riassunto descrittivo e concreto dell'attività del giocatore (in italiano).",
      "- Evidenzia: cosa gioca (se deducibile), intensità e continuità, picchi/cluster temporali, comportamenti di deposito/prelievo (frequenza, importi, pattern), eventuali pattern sospetti (structuring, round‑tripping, bonus abuse, mirror transactions, ciclicità, escalation/decrescita).",
      "- Valuta il rischio AML assegnando un punteggio RISK_SCORE tra 0 e 100.",
      "- Se non deducibile, lascia il campo vuoto o 'null' senza inventare.",
      "Rispondi SOLO in JSON valido con le seguenti chiavi: { summary: string, risk_score: number (0-100), games: string[] | [], time_focus: { night?: number, day?: number, evening?: number }, peaks: { date?: string, note: string }[], risk_indicators: string[] }."
    ].join("\n");

    const user = [
      "DATI (CSV, UTC):",
      csv
    ].join("\n\n");

    const payload = {
      model: "openai/gpt-4.1-nano",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 900
    };

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[amlAdvancedAnalysis] OpenRouter error", resp.status, text);
      return { statusCode: resp.status, headers: corsHeaders, body: JSON.stringify({ error: "openrouter_error", status: resp.status, detail: text.slice(0, 2_000) }) };
    }

    const data = await resp.json();
    const content = (((data || {}).choices || [])[0] || {}).message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: String(content || "").slice(0, 2000) }; }

    const result = {
      summary: parsed.summary || "",
      risk_score: typeof parsed.risk_score === "number" ? parsed.risk_score : 0,
      games: Array.isArray(parsed.games) ? parsed.games : [],
      time_focus: parsed.time_focus || null,
      peaks: Array.isArray(parsed.peaks) ? parsed.peaks : [],
      risk_indicators: Array.isArray(parsed.risk_indicators) ? parsed.risk_indicators : [],
      indicators
    };

    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(result) };
  } catch (err) {
    console.error("[amlAdvancedAnalysis] function error", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "function_error", message: String(err && err.message || err) }) };
  }
};