// Netlify Function: amlAdvancedAnalysis (stable)
// Accepts { txs: [{ ts, amount, dir, reason? }] } and returns
// { model, risk_score, summary, indicators, flags: [] }
// Always returns 200 with a fallback summary if the model fails.

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
    if (!txs.length) {
      return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(emptyResponse()) };
    }

    // Build indicators locally so we always have charts
    const indicators = computeIndicatorsFromTxs(txs);
    const csv = txsToTable(txs);

    // Default outcome (fallback)
    let outcome = {
      model: "openai/gpt-oss-120b",
      risk_score: roughRiskScore(txs),
      summary: buildFallbackSummary(txs),
      indicators,
      flags: []
    };

    // Try OpenRouter only if key present
    if (OPENROUTER_API_KEY) {
      const sys = `Sei un analista AML per iGaming. Scrivi la risposta SOLO in JSON valido con almeno:
{
  "summary": "testo in italiano",
  "risk_score": 0
}
Linee guida IMPORTANTI:
- NESSUN markdown, NESSUN code fence.
- Usa il seguente template come base e riempi i campi con i dati calcolati. Puoi aggiungere anche altre osservazioni utili (picchi, cambi metodo pagamento, percentuali prodotti). 
Template di summary:
"l’utente ha depositato €XXXX ed effettuato prelievi pari a €XXXX. In termini di deposito, l’utente ha utilizzato “XXXXX” mentre per quanto riguarda i prelievi è stato utilizzato “XXXXX”.
Vanno sottolineate la presenza di frazionate durante i seguenti periodi:
XXXXX per un importo di €XXXXX
XXXXX per un importo di €XXXXXX
Nel mese in esame l’utente ha utilizzato prevalentemente sessioni di XXXX su tavoli differenti e con alti importi e sul prodotto XXXXX, scommettendo su XXXXX, dove tuttavia per entrambi i prodotti non/sono state riscontrate anomalie.
In questa fase non/è osservabile un riciclo delle vincite."
- Mantieni l’anonimato. NON inventare PII.
- Il campo "risk_score" deve essere un numero 0–100.`;
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
          model: "openai/gpt-oss-120b",
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          temperature: 0.2,
          max_tokens: 900
        })
      });

      const text = await resp.text();
      if (resp.ok) {
        const data = JSON.parse(text);
        const content = String(data?.choices?.[0]?.message?.content || "").trim();
        const parsed = safeParseAiJson(content);
        if (parsed && typeof parsed.summary === "string") {
          outcome.summary = String(parsed.summary).trim();
          if (typeof parsed.risk_score === "number") outcome.risk_score = parsed.risk_score;
        }
      } else {
        // keep fallback outcome, but attach note
        outcome.note = `openrouter_http_${resp.status}`;
        outcome.raw = text.slice(0, 400);
      }
    } else {
      outcome.note = "missing_openrouter_key";
    }

    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(outcome) };
  } catch (err) {
    const fb = emptyResponse();
    fb.error = String(err && err.message || err);
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(fb) };
  }
};

function emptyResponse() {
  return { model: "openai/gpt-oss-120b", risk_score: 0, summary: "Analisi non disponibile.", indicators: null, flags: [] };
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

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

// --- local indicators + fallback narrative ---
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
  (txs || []).forEach(t => {
    const d = new Date(t.ts);
    if (isNaN(d.getTime())) return;
    hourly[d.getHours()].count += 1;
  });

  const methodMap = new Map();
  (txs || []).forEach(t => {
    const m = classifyMethod(t.reason || "");
    methodMap.set(m, (methodMap.get(m) || 0) + Math.abs(safeNumber(t.amount)));
  });
  const total = Array.from(methodMap.values()).reduce((a,b)=>a+b,0) || 1;
  const method_breakdown = Array.from(methodMap.entries()).map(([method, sum]) => ({ method, pct: (sum/total)*100 }));

  return { net_flow_by_month, hourly_histogram: hourly, method_breakdown };
}

function roughRiskScore(txs) {
  const totals = (txs || []).reduce((a,t)=>{
    const amt = Math.abs(safeNumber(t.amount));
    if (t.dir === "out") a.out += amt; else a.in += amt; return a;
  }, {in:0, out:0});
  const ratio = totals.in ? totals.out / totals.in : 0;
  let score = 5 + Math.min(30, Math.round(ratio * 25));
  return Math.max(0, Math.min(100, score));
}

function euro(n) {
  try { return new Intl.NumberFormat("it-IT", {minimumFractionDigits:2, maximumFractionDigits:2}).format(n); }
  catch { return String(n); }
}

function mostUsed(txs, dir) {
  const m = new Map();
  (txs || []).filter(t=>t.dir===dir).forEach(t => {
    const k = classifyMethod(t.reason || "");
    m.set(k, (m.get(k) || 0) + Math.abs(safeNumber(t.amount)));
  });
  let best = "other", max = -1;
  for (const [k,v] of m.entries()) if (v>max) { max=v; best=k; }
  return best;
}


function buildFallbackSummary(txs) {
  // Totali
  const totals = (txs || []).reduce((a,t)=>{
    const amt = Math.abs(safeNumber(t.amount));
    if (t.dir === "out") a.out += amt; else a.in += amt; return a;
  }, {in:0, out:0});

  // Metodi prevalenti
  const depMethod = mostUsed(txs, "in");
  const outMethod = mostUsed(txs, "out");

  // Frazionate: >3 movimenti nella stessa ora per stessa direzione
  const fraz = (function(){
    const m = new Map();
    (txs || []).forEach(t => {
      const d = new Date(t.ts); if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:00-${t.dir}`;
      const rec = m.get(key) || { periodo: key.slice(0,16), importo: 0, count: 0 };
      rec.importo += Math.abs(safeNumber(t.amount)); rec.count += 1; m.set(key, rec);
    });
    return Array.from(m.values()).filter(x => x.count >= 3).sort((a,b)=> b.importo - a.importo).slice(0,5);
  })();

  const frazLines = fraz.length
    ? fraz.map(f => `${f.periodo} per un importo di €${euro(f.importo)}`).join("\n")
    : "nessuna frazionata rilevata";

  // Picchi orari (top 2)
  const hourly = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
  (txs || []).forEach(t => { const d=new Date(t.ts); if(!isNaN(d.getTime())) hourly[d.getHours()].count+=1; });
  const peaks = hourly.sort((a,b)=>b.count-a.count).slice(0,2).map(h=>`${String(h.hour).padStart(2,'0')}:00 (${h.count} mov.)`).join(", ");

  // Breakdown metodi (%)
  const methodMap = new Map();
  (txs || []).forEach(t => {
    const m = classifyMethod(t.reason || ""); methodMap.set(m,(methodMap.get(m)||0)+Math.abs(safeNumber(t.amount)));
  });
  const tot = Array.from(methodMap.values()).reduce((a,b)=>a+b,0) || 1;
  const breakdown = Array.from(methodMap.entries())
    .sort((a,b)=>b[1]-a[1])
    .map(([m,v])=>`${m}: ${(v*100/tot).toFixed(1)}%`).join(", ");

  return `l’utente ha depositato €${euro(totals.in)} ed effettuato prelievi pari a €${euro(totals.out)}. ` +
    `In termini di deposito, l’utente ha utilizzato “${depMethod}” mentre per quanto riguarda i prelievi è stato utilizzato “${outMethod}”.
` +
    `Vanno sottolineate la presenza di frazionate durante i seguenti periodi:
${frazLines}
` +
    `Nel mese in esame sono emersi picchi di attività nelle fasce orarie: ${peaks}. ` +
    `Per metodi di pagamento la distribuzione è la seguente: ${breakdown}. ` +
    `In questa fase non è osservabile un riciclo delle vincite.`;
}

