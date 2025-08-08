/** Netlify Function: amlAdvancedAnalysis
 * POST body: { txs: [{ ts, amount, dir, reason }] }
 * Returns: AdvancedAnalysis JSON (see schema)
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

    const schema = {
      name: "AmlAdvancedAnalysis",
      schema: {
        type: "object",
        required: ["risk_score","flags","indicators","recommendations"],
        properties: {
          risk_score: { type: "number", minimum: 0, maximum: 100 },
          flags: {
            type: "array",
            items: {
              type: "object",
              required: ["code","severity","reason"],
              properties: {
                code: { type: "string" },
                severity: { enum: ["low","medium","high"] },
                reason: { type: "string" }
              }
            }
          },
          indicators: {
            type: "object",
            properties: {
              net_flow_by_month: {
                type: "array",
                items: {
                  type: "object",
                  required: ["month","deposits","withdrawals"],
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
                  required: ["hour","count"],
                  properties: { hour: { type: "integer", minimum:0, maximum:23 }, count:{ type: "integer", minimum:0 } }
                }
              },
              method_breakdown: {
                type: "array",
                items: {
                  type: "object",
                  required: ["method","pct"],
                  properties: { method: { type:"string" }, pct: { type:"number", minimum:0, maximum:100 } }
                }
              },
              velocity: {
                type: "object",
                properties: {
                  avg_txs_per_hour: { type: "number" },
                  spikes: {
                    type: "array",
                    items: { type: "object", properties: { ts: { type:"string" }, z: { type:"number" } } }
                  }
                }
              }
            }
          },
          recommendations: { type: "array", items: { type: "string" } }
        }
      },
      strict: true
    };

    const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
    const MODELS = [
      "zhipu/glm-4.5-air:free",
      "deepseek/deepseek-r1-0528:free",
    ];

    async function callModel(model) {
      const body = {
        model,
        messages: [
          { role: "system", content: "Sei un Senior Analyst AML in un'azienda di iGaming operante nel mercato italiano, esperto in transaction monitoring. Rispondi SOLO con JSON valido aderente allo schema." },
          { role: "user", content: "Analizza le transazioni anonimizzate. Valuta rischio, eventuali pattern di riciclaggio, velocity, net flow mensile, fasce orarie, metodi di pagamento, picchi mensili di deposito e se il cliente deposita e usa un metodo di pagamento diverso nel prelievo. Mostra percentuali e tutti i dati necessari all'analisi." },
          { role: "user", content: JSON.stringify({ txs }) }
        ],
        temperature: 0.2,
        // structured JSON output
        structured_outputs: true,
        response_format: { type: "json_schema", json_schema: schema }
      };

      const res = await fetch(OPENROUTER_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_PUBLIC_URL || "https://example.com",
          "X-Title": "Toppery AML"
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`openrouter ${res.status}`);
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      return parsed;
    }

    let out = null;
    let error = null;
    for (const m of MODELS) {
      try {
        out = await callModel(m);
        if (out) break;
      } catch (e) {
        error = e;
      }
    }
    if (!out) {
      throw error || new Error("tutti i modelli hanno fallito");
    }

    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'errore' }) };
  }
};
