// Netlify Function: amlAdvancedAnalysis
// Input: { txs: [{ ts, amount, dir, reason? }] }
// Output: { model, risk_score, summary, indicators }

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery.work";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const txs = Array.isArray(body.txs) ? body.txs : [];

    // Build indicators locally (for charts) regardless of AI
    const indicators = computeIndicatorsFromTxs(txs);

    // If there are no transactions, skip the AI call entirely
    if (!txs.length) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ model: null, risk_score: 0, summary: "", indicators, error: "no_transactions" })
      };
    }

    // Build CSV compact table for the AI
    const csv = txsToTable(txs);
    if (!csv) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ model: null, risk_score: 0, summary: "", indicators, error: "empty_csv" })
      };
    }

    // Prepare prompt
    const sys = `Sei un analista AML per iGaming. Rispondi SOLO in JSON valido con i campi:
{ "summary": "testo in italiano", "risk_score": 0 }
- NESSUN markdown, nessun code fence.
- Nella summary usa cifre e percentuali ricavate dai dati (depositi, prelievi, net flow, metodi, cambi di metodo, picchi orari/giorni). Mantieni l’anonimato.
`;
    const user = [
      "Queste sono le transazioni (anonime) in CSV:",
      "ts,amount,dir,method",
      csv
    ].join("\\n");

    const outcome = { model: "openai/gpt-4o-mini", risk_score: 0, summary: "", indicators };

    if (!OPENROUTER_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...outcome, error: "missing_openrouter_key" })
      };
    }

    // Call OpenRouter
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    const text = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...outcome, error: `openrouter_http_${resp.status}`, raw: text.slice(0, 400) })
      };
    }

    // Parse OpenRouter JSON
    let data;
    try { data = JSON.parse(text); } catch (e) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...outcome, error: "invalid_openrouter_json", raw: text.slice(0, 400) })
      };
    }

    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    const parsed = safeParseAiJson(content);
    if (!parsed || typeof parsed.summary !== "string") {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...outcome, error: "invalid_ai_output", raw: content.slice(0, 400) })
      };
    }

    outcome.summary = String(parsed.summary).trim();
    if (typeof parsed.risk_score === "number") outcome.risk_score = parsed.risk_score;

    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(outcome) };
  } catch (err) {
    return { statusCode: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ model: null, risk_score: 0, summary: "", indicators: null, error: String(err && err.message || err) }) };
  }
};

// Helpers
function safeNumber(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function classifyMethod(reason = "") {
  const s = String(reason).toLowerCase();
  if (/visa|mastercard|amex|maestro|carta|card/.test(s)) return "card";
  if (/sepa|bonifico|bank|iban/.test(s)) return "bank";
  if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) return "ewallet";
  if (/crypto|btc|eth|usdt|usdc/.test(s)) return "crypto";
  if (/paysafecard|voucher|coupon/.test(s)) return "voucher";
  if (/bonus|promo/.test(s)) return "bonus";
  return "other";
}

function txsToTable(txs) {
  const rows = (txs || []).map((t) => {
    let ts = t.ts || t.date || t.data || "";
    const d = new Date(ts);
    if (!isNaN(d.getTime())) ts = d.toISOString();
    let dir = (t.dir === "out" || /preliev/i.test(t?.reason || "")) ? "out" : "in";
    let amtNum = safeNumber(t.amount);
    if (isFinite(amtNum) && amtNum < 0) { dir = "out"; amtNum = Math.abs(amtNum); }
    const method = classifyMethod(t.reason || "");
    return [ts, (isFinite(amtNum) ? amtNum.toFixed(2) : "0.00"), dir, method].join(",");
  });
  if (!rows.length) return "";
  const header = "ts,amount,dir,method";
  return header + "\\n" + rows.join("\\n");
}

function safeParseAiJson(input = "") {
  const clean = String(input).replace(/```json|```/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  try { return JSON.parse(clean); } catch {}
  const m = clean.match(/\\{[\\s\\S]*\\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function computeIndicatorsFromTxs(txs) {
  const monthMap = new Map();
  (txs || []).forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    const month = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    const rec = monthMap.get(month) || { month, deposits: 0, withdrawals: 0 };
    const amt = Math.abs(safeNumber(t.amount));
    if (t.dir === "out") rec.withdrawals += amt; else rec.deposits += amt;
    monthMap.set(month, rec);
  });
  const net_flow_by_month = Array.from(monthMap.values()).sort((a,b)=> a.month.localeCompare(b.month));

  const hourly = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
  (txs || []).forEach(t => { const d = new Date(t.ts); if (!isNaN(d.getTime())) hourly[d.getHours()].count += 1; });

  const methodMap = new Map();
  (txs || []).forEach(t => {
    const m = classifyMethod(t.reason || "");
    methodMap.set(m, (methodMap.get(m) || 0) + Math.abs(safeNumber(t.amount)));
  });
  const total = Array.from(methodMap.values()).reduce((a,b)=>a+b,0) || 1;
  const method_breakdown = Array.from(methodMap.entries()).map(([method, sum]) => ({ method, pct: (sum/total)*100 }));

  return { net_flow_by_month, hourly_histogram: hourly, method_breakdown };
}
