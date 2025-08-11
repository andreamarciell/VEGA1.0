// Netlify Function: amlAdvancedAnalysis
// Input: { txs: [{ ts, amount, dir, reason? }] }
// Output: { model, risk_score, summary, indicators }

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const REFERER = process.env.APP_PUBLIC_URL || "https://toppery.work";
const X_TITLE = process.env.APP_TITLE || "Toppery AML";

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

    // Build CSV compact table for the AI
    const csv = txsToTable(txs);

    // Base outcome (AI-only; no fallback)
    const outcome = { model: "openai/gpt-4o-mini", risk_score: 0, summary: "", indicators };

    if (OPENROUTER_API_KEY && csv.trim().length) {
      const sys = `Sei un analista AML per iGaming. Rispondi SOLO in JSON valido con i campi:
{ "summary": "testo in italiano", "risk_score": 0 }
- NESSUN markdown, nessun code fence.
- Usa questo schema per la "summary", riempi le cifre dai dati e aggiungi osservazioni utili (picchi, cambi metodo, percentuali, prodotti). Mantieni l’anonimato:
"l’utente ha depositato XXXX ed effettuato prelievi pari a XXXX. In termini di deposito, l’utente ha utilizzato “XXXXX” mentre per quanto riguarda i prelievi e’ stato utilizzato “XXXXX”.
Vanno sottolineate la presenza di frazionate durante i seguenti periodi:
XXXXX per un importo di €XXXXX
XXXXX per un importo di €XXXXXX
Nel mese in esame l’utente ha utilizzato prevalentemente sessioni di XXXX su tavoli differenti e con alti importi e sul prodotto XXXXX, scommettendo su XXXXX, dove tuttavia per entrambi i prodotti non/sono state riscontrate anomalie.
In questa fase non/e’ osservabile un riciclo delle vincite."`;

      const user = [
        "Queste sono le transazioni (anonime) in CSV:",
        "ts,amount,dir,method",
        csv
      ].join("\n");

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
          max_tokens: 1000
        })
      });

      const text = await resp.text();
      if (resp.ok) {
        try {
          const data = JSON.parse(text);
          const content = String(data?.choices?.[0]?.message?.content || "").trim();
          const parsed = safeParseAiJson(content);
          if (parsed && typeof parsed.summary === "string") {
            outcome.summary = String(parsed.summary).trim();
            if (typeof parsed.risk_score === "number") outcome.risk_score = parsed.risk_score;
          } else {
            outcome.error = "invalid_ai_output";
          }
        } catch (e) {
          outcome.error = "invalid_json_ai";
        }
      } else {
        outcome.error = `openrouter_http_${resp.status}`;
        outcome.raw = text.slice(0, 300);
      }
    } else if (!OPENROUTER_API_KEY) {
      outcome.error = "missing_openrouter_key";
    }

    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(outcome) };
  } catch (err) {
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-4o-mini", risk_score: 0, summary: "", indicators: null, error: String(err && err.message || err) }) };
  }
};

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
  const header = "ts,amount,dir,method\n";
  const rows = (txs || []).map((t) => {
    let ts = t.ts || t.date || t.data || "";
    try { ts = new Date(ts).toISOString(); } catch {}
    let dir = (t.dir === "out" || /preliev/i.test(t?.reason || "")) ? "out" : "in";
    let amtNum = safeNumber(t.amount);
    if (isFinite(amtNum) && amtNum < 0) { dir = "out"; amtNum = Math.abs(amtNum); }
    const method = classifyMethod(t.reason || "");
    return [ts, (isFinite(amtNum) ? amtNum.toFixed(2) : "0.00"), dir, method].join(",");
  });
  return header + rows.join("\n");
}

function safeParseAiJson(input = "") {
  const clean = String(input).replace(/```json|```/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  try { return JSON.parse(clean); } catch {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// Charts helpers
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
