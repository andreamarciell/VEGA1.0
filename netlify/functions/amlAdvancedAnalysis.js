/**
 * Netlify Function: amlAdvancedAnalysis
 * Fixes for OpenRouter + gpt-4.1-nano:
 * - correct endpoint (/api/v1/chat/completions)
 * - valid response_format json_schema (no structured_outputs flag)
 * - robust parsing / error forwarding (avoid masking 4xx as 500)
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery-aml.example";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

// Minimal, valid JSON Schema for the response
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

// CORS headers (adjust origin if you want to lock it down)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

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

  const model = body.model || "openai/gpt-4.1-nano";
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;

  // Use provided messages if present, otherwise build a minimal prompt
  const messages = Array.isArray(body.messages) && body.messages.length
    ? body.messages
    : [
        { role: "system", content: "You are an AML analyst. Output strictly valid JSON that matches the provided schema." },
        { role: "user", content: body.prompt || "Analyze the provided user activity and return the structured assessment." }
      ];

  const payload = {
    model,
    route: "fallback",
    messages,
    temperature,
    // Correct endpoint expects response_format with json_schema, without non-standard flags
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
      // forward upstream status (avoid masking as 500)
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "upstream_error", status: res.status, raw: data || text })
      };
    }

    // extract and parse JSON content
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
        model: data.model || model,
        usage: data.usage || null,
        output: parsed
      })
    };
  } catch (err) {
    // genuine function error
    console.error("[amlAdvancedAnalysis] function error", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "function_error", message: String(err && err.message || err) }) };
  }
};
