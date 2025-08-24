/** Netlify Function: AI summary proxy (prevents client key exposure, avoids CORS issues).
 *  Uses OPENROUTER_API_KEY from Netlify env. Falls back to VITE_OPENROUTER_API_KEY if present server-side.
 *  Runtime: Node 18+ (global fetch available).
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const text = (body && typeof body.text === "string" ? body.text : "").trim();
    const model = (body && typeof body.model === "string" ? body.model : "openrouter/auto");

    if (!text) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing 'text' to summarize" }),
      };
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing OPENROUTER_API_KEY on server" }),
      };
    }

    const reqBody = {
      model,
      max_tokens: 800,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente che riassume articoli di cronaca in italiano. Mantieni fatti verificabili, nomi, date, luoghi e presunti reati. Tono neutro, massimo 6-8 frasi. Non inventare. Rispondi solo con testo, senza markdown.",
        },
        { role: "user", content: text },
      ],
    };

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // facoltativi ma utili:
        "HTTP-Referer": "https://toppery.work",
        "X-Title": "Toppery AML",
      },
      body: JSON.stringify(reqBody),
    });

    const respText = await resp.text();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OpenRouter error", details: respText.slice(0, 1000) }),
      };
    }

    let data;
    try {
      data = JSON.parse(respText);
    } catch (e) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON from OpenRouter", raw: respText.slice(0, 1000) }),
      };
    }

    const summary = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Function crash", message: String(err && err.message || err) }),
    };
  }
};
