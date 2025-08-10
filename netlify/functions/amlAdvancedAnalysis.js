
/**
 * Netlify Function: amlAdvancedAnalysis
 * Purpose: Send anonymized transactions to OpenRouter (gpt-4.1-nano)
 * and return a flat JSON object with summary + risk_score etc.
 * Fix: Use response_format {type:"json_object"} instead of json_schema,
 *      and return the parsed object (not nested under "output").
 *      Be permissive when parsing JSON (strip code fences).
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery.work";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function toCSV(txs) {
  const header = "ts,amount,dir,reason";
  const rows = (Array.isArray(txs) ? txs : []).map(t => {
    const ts = t.ts || t.date || t.time || new Date().toISOString();
    const amount = Number.isFinite(+t.amount) ? +t.amount : 0;
    const dir = (t.dir === "out" || t.direction === "out") ? "out" : "in";
    // reason must be already anon on client; still strip emails/long nums
    const reason = String(t.reason || t.causale || "")
      .toLowerCase()
      .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, "[email]")
      .replace(/\b(?:id|player|user|account)[-_ ]?\d+\b/g, "[id]")
      .replace(/[0-9]{6,}/g, "[num]")
      .replace(/[\r\n]+/g, " ")
      .replace(/"/g, '"');
    return `${ts},${amount},${dir},"${reason}"`;
  });
  return [header, ...rows].join("\n");
}

function stripToJson(text) {
  if (typeof text !== "string") return null;
  // remove triple backticks if present
  let s = text.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // try to find first { ... } block
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  try { return JSON.parse(s); } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "method not allowed" }) };
  }
  if (!OPENROUTER_API_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENROUTER_API_KEY missing" }) };
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; }
  catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "invalid JSON body" }) }; }

  const txs = Array.isArray(body.txs) ? body.txs : [];
  if (!txs.length) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "no transactions" }) };
  }
  const csv = toCSV(txs);

  const system = [
    "Sei un analista AML per una piattaforma iGaming italiana.",
    "Ti forniremo SOLO transazioni anonimizzate nel formato CSV: ts,amount,dir,reason.",
    "Devi restituire ESCLUSIVAMENTE un JSON valido (nessun testo fuori dal JSON) con queste chiavi:",
    "{",
    "  \"summary\": string,",
    "  \"risk_score\": number (0-100),",
    "  \"games\": string[] | [],",
    "  \"time_focus\": { night?: number, day?: number, evening?: number },",
    "  \"peaks\": { date?: string, note: string }[],",
    "  \"risk_indicators\": string[]",
    "}",
    "Linee guida: descrivi attività, intensità, picchi, fasce orarie, depositi/prelievi, pattern sospetti;",
    "non inventare. Se non deducibile, usa null o liste vuote."
  ].join("\n");

  const user = [
    "DATI (CSV, UTC):",
    csv
  ].join("\n");

  const payload = {
    model: "openai/gpt-4.1-nano",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!res.ok) {
      return { statusCode: res.status, headers: corsHeaders, body: JSON.stringify({ error: "upstream_error", status: res.status, raw: data || text }) };
    }

    const msg = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message : null;
    const parsed = msg ? (typeof msg.content === "string" ? stripToJson(msg.content) : msg.content) : null;

    if (!parsed || typeof parsed !== "object") {
      // return a 422 to differentiate from upstream 5xx
      return { statusCode: 422, headers: corsHeaders, body: JSON.stringify({ error: "invalid_json_from_model", raw: msg && msg.content }) };
    }

    // Return the parsed object directly (flat), so the frontend can use it as-is.
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(parsed) };
  } catch (err) {
    console.error("[amlAdvancedAnalysis] function error", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "function_error", message: String(err && err.message || err) }) };
  }
};
