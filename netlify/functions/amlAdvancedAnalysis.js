
/**
 * Netlify Function: amlAdvancedAnalysis
 * Purpose:
 *  - Call OpenRouter with `openai/gpt-oss-120b`
 *  - Provide the model with a compact but complete list of transactions
 *  - Ask for a JSON response WITHOUT the `flags` section and WITH a narrative "summary"
 *  - Keep data anonymous (no emails/IDs should be present in payload coming from client)
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery.work";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

// Convert txs array to a compact CSV-like table so tokenization is predictable.
function txsToTable(txs) {
  const header = "ts,amount,dir,method\\n";
  const rows = (txs || []).map(t => {
    let ts = t.ts || t.date || t.data || "";
    try { ts = new Date(ts).toISOString(); } catch {}
    const amt = Number(t.amount);
    const dir = (t.dir === "out" || /preliev/i.test(t?.reason || "")) ? "out" : "in";
    const method = classifyMethod(t.reason || "");
    return [ts, isFinite(amt) ? amt.toFixed(2) : "0.00", dir, method].join(",");
  });
  return header + rows.join("\\n");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  try {
    if (!OPENROUTER_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "missing_openrouter_key" }) };
    }
    const body = JSON.parse(event.body || "{}");
    const txs = Array.isArray(body.txs) ? body.txs : [];
    if (!txs.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "no_transactions" }) };
    }

    // Build a concise transcript for the model
    const table = txsToTable(txs);
    const userPrompt = `
Sei un analista AML in un'azienda di iGaming. Ti fornisco una tabella di transazioni
anonimizzate con colonne: ts (ISO), amount (EUR), dir ("in" deposito, "out" prelievo), method.
Analizza il comportamento dell'utente sul periodo coperto.

RESTITUISCI ESCLUSIVAMENTE JSON VALIDO con forma:
{
  "summary": "stringa in italiano con un paragrafo narrativo seguendo il template richiesto",
  "risk_score": numero intero 0-100
}

**Importante**
- NON aggiungere la chiave "flags".
- In "summary" usa esattamente questo template come scheletro, riempiendo i valori e aggiungendo, se utili, osservazioni aggiuntive (picchi, percentuali, prodotti, livello di rischio):
"l’utente ha depositato XXXX ed effettuato prelievi pari a XXXX. In termini di deposito, l’utente ha utilizzato “XXXXX” mentre per quanto riguarda i prelievi e’ stato utilizzato “XXXXX”.
Vanno sottolineate la presenza di frazionate durante i seguenti periodi:
XXXXX per un importo di €XXXXX
XXXXX per un importo di €XXXXXX
Nel mese in esame l’utente ha utilizzato prevalentemente sessioni di XXXX su tavoli differenti e con alti importi e sul prodotto XXXXX, scommettendo su XXXXX, dove tuttavia per entrambi i prodotti non/sono state riscontrate anomalie.

In questa fase non/e’ osservabile un riciclo delle vincite."
- Se una parte non è applicabile (es. nessuna frazionata), scrivi la frase coerentemente in modo neutro.
- Evita i blocchi di codice nel risultato.
- Non includere dati personali: i campi ricevuti sono già anonimi.

Tabella (CSV):
${table}
    `.trim();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "Rispondi sempre e solo con JSON valido. Sei un esperto analista AML per iGaming italiano."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 900
      })
    });

    const text = await response.text();
    if (!response.ok) {
      return { statusCode: response.status, headers: corsHeaders, body: text || JSON.stringify({ error: "openrouter_error" }) };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "bad_gateway", raw: text?.slice?.(0, 500) }) };
    }

    const content = data.choices?.[0]?.message?.content || "";
    const raw = String(content || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback: wrap as summary string if model didn't follow JSON strictly
      parsed = { summary: raw || "Analisi non disponibile.", risk_score: 0 };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id || null,
        model: data.model || "openai/gpt-oss-120b",
        usage: data.usage || null,
        output: parsed
      })
    };
  } catch (err) {
    console.error("[amlAdvancedAnalysis] function error", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "function_error", message: String(err && err.message || err) }) };
  }
}
