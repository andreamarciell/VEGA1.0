/**
 * Netlify Function: amlAdvancedAnalysis
 *
 * v2: Pass real anonymized stats to GPT-4.1 Nano (via OpenRouter)
 * - Accepts transactions payload (flexible keys), aggregates server-side
 * - Builds compact stats: monthly net flow, hourly histogram, method breakdown,
 *   plus totals and counts (including zeros)
 * - Sends stats in the user message with JSON Schema structured output
 * - Keeps endpoint/headers fixes from v1
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery-aml.example";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

// -------- JSON Schema for structured output --------
const schema = {
  name: "AmlAdvancedAnalysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["risk_score", "flags", "indicators", "recommendations", "summary"],
    properties: {
      risk_score: { type: "number", minimum: 0, maximum: 100 },
      flags: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "severity", "reason"],
          properties: {
            code: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            reason: { type: "string" }
          }
        }
      },
      indicators: {
        type: "object",
        additionalProperties: false,
        required: ["net_flow_by_month", "hourly_histogram", "method_breakdown"],
        properties: {
          net_flow_by_month: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["month", "deposits", "withdrawals"],
              properties: {
                month: { type: "string" },
                deposits: { type: "number" },
                withdrawals: { type: "number" }
              }
            }
          },
          hourly_histogram: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["hour", "count"],
              properties: {
                hour: { type: "integer", minimum: 0, maximum: 23 },
                count: { type: "integer", minimum: 0 }
              }
            }
          },
          method_breakdown: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["method", "count", "amount"],
              properties: {
                method: { type: "string" },
                count: { type: "integer", minimum: 0 },
                amount: { type: "number" }
              }
            }
          }
        }
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" }
    }
  },
  strict: true
};

// -------- Helpers: CORS --------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// -------- Helpers: data normalization & aggregation --------
function normalizeTx(tx) {
  const amtRaw = tx.amount ?? tx.value ?? tx.importo ?? tx.valore ?? 0;
  let amount = Number(amtRaw);
  if (Number.isNaN(amount)) {
    // try parse comma decimal
    const s = String(amtRaw).replace(/\./g, "").replace(",", ".");
    amount = Number(s);
    if (Number.isNaN(amount)) amount = 0;
  }

  const typeRaw = (tx.type ?? tx.direction ?? tx.mov_type ?? tx.kind ?? tx.movimento ?? "").toString().toLowerCase();
  let type;
  if (/with|prel|wd|cashout/.test(typeRaw)) type = "withdrawal";
  else if (/dep|vers|topup|ricar|load/.test(typeRaw)) type = "deposit";
  else type = amount < 0 ? "withdrawal" : "deposit";

  const dateRaw = tx.timestamp ?? tx.date ?? tx.datetime ?? tx.created_at ?? tx.time ?? null;
  const ts = dateRaw ? new Date(dateRaw) : null;
  const method = (tx.method ?? tx.payment_method ?? tx.channel ?? tx.provider ?? tx.instrument ?? "other").toString();

  // amounts should be absolute per bucket (direction captured by type)
  return {
    amount: Math.abs(amount) || 0,
    type,
    ts,
    method
  };
}

function aggregate(transactions) {
  const netByMonthMap = new Map();
  const hourly = new Array(24).fill(0);
  const methodMap = new Map();

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let zeroAmounts = 0;
  let txWithTime = 0;
  let nightCount = 0; // 22-06 window

  for (const raw of transactions) {
    const t = normalizeTx(raw);

    if (t.amount === 0) zeroAmounts++;
    if (t.ts instanceof Date && !isNaN(t.ts)) {
      txWithTime++;
      const h = t.ts.getHours();
      hourly[h]++;

      if (h >= 22 || h < 6) nightCount++;

      const monthKey = `${t.ts.getFullYear()}-${String(t.ts.getMonth() + 1).padStart(2, "0")}`;
      const m = netByMonthMap.get(monthKey) || { month: monthKey, deposits: 0, withdrawals: 0 };
      if (t.type === "deposit") m.deposits += t.amount;
      else m.withdrawals += t.amount;
      netByMonthMap.set(monthKey, m);
    }

    const methKey = t.method || "other";
    const m2 = methodMap.get(methKey) || { method: methKey, count: 0, amount: 0 };
    m2.count += 1;
    m2.amount += t.amount;
    methodMap.set(methKey, m2);

    if (t.type === "deposit") totalDeposits += t.amount;
    else totalWithdrawals += t.amount;
  }

  const net_flow_by_month = Array.from(netByMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  const hourly_histogram = hourly.map((count, hour) => ({ hour, count }));
  const method_breakdown = Array.from(methodMap.values()).sort((a, b) => b.amount - a.amount);

  const totals = {
    tx_count: transactions.length,
    tx_with_time: txWithTime,
    zero_amounts: zeroAmounts,
    total_deposits: Number(totalDeposits.toFixed(2)),
    total_withdrawals: Number(totalWithdrawals.toFixed(2)),
    net_position: Number((totalDeposits - totalWithdrawals).toFixed(2)),
    night_window_tx: nightCount,
  };

  return { net_flow_by_month, hourly_histogram, method_breakdown, totals };
}

// -------- Function handler --------
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "method not allowed" }) };
  }

  if (!OPENROUTER_API_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENROUTER_API_KEY missing" }) };
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "invalid JSON body" }) };
  }

  // Accept several shapes to be flexible with the frontend
  const tx =
    body.transactions ||
    body.tx ||
    body.rows ||
    (body.data && body.data.transactions) ||
    (body.payload && body.payload.transactions) ||
    [];

  let messagesFromClient = Array.isArray(body.messages) ? body.messages : null;

  // Build a compact stats object if transactions are provided
  let stats = null;
  if (Array.isArray(tx) && tx.length > 0) {
    stats = aggregate(tx);
  }

  const baseInstruction =
    "You are an AML analyst for an iGaming platform. Using ONLY the provided stats, assess risk and output STRICT JSON that matches the schema. Be conservative but not naive; highlight patterns like rapid deposit-withdraw cycles, method concentration, time-of-day anomalies, and net outflows.";

  let messages;
  if (messagesFromClient && messagesFromClient.length > 0) {
    // Respect client-provided messages but append a final instruction to enforce schema
    messages = [
      ...messagesFromClient,
      { role: "system", content: "Return JSON only per the provided json_schema. No prose." }
    ];
  } else if (stats) {
    messages = [
      { role: "system", content: baseInstruction },
      {
        role: "user",
        content:
          "DATA (anonymized stats):\n" +
          JSON.stringify(
            {
              totals: stats.totals,
              indicators: {
                net_flow_by_month: stats.net_flow_by_month,
                hourly_histogram: stats.hourly_histogram,
                method_breakdown: stats.method_breakdown
              }
            },
            null,
            0
          ) +
          "\nTASK: Evaluate the activity and produce risk_score (0-100), concrete flags (code/severity/reason), indicators echo (same shapes), recommendations, and a concise summary."
      }
    ];
  } else {
    // No stats and no messages -> keep explicit but minimal; tell model it has no data
    messages = [
      { role: "system", content: baseInstruction },
      { role: "user", content: "No transaction stats were provided. Return a summary noting missing data and set a cautious low risk." }
    ];
  }

  const payload = {
    model: body.model || "openai/gpt-4.1-nano",
    route: "fallback",
    messages,
    temperature: typeof body.temperature === "number" ? body.temperature : 0.2,
    max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 800,
    response_format: { type: "json_schema", json_schema: schema }
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
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "upstream_error", status: res.status, raw: data || text })
      };
    }

    const msg = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message : null;
    let parsed;
    try {
      parsed = msg && typeof msg.content === "string" ? JSON.parse(msg.content) : (msg ? msg.content : null);
    } catch (e) {
      console.error("[openrouter] invalid JSON content", { msg });
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "invalid_json_from_model", raw: msg && msg.content }) };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id,
        model: data.model || (body.model || "openai/gpt-4.1-nano"),
        usage: data.usage || null,
        input_stats: stats || null,
        output: parsed
      })
    };
  } catch (err) {
    console.error("[amlAdvancedAnalysis] function error", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "function_error", message: String(err && err.message || err) }) };
  }
};
