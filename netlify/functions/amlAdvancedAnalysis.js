// netlify/functions/amlAdvancedAnalysis.js
// Definitive fix: send correct, normalized data to the AI and return indicators derived from the *same* normalized set.
// No fake 200s; strict validation and meaningful error messages.

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_ID = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o-mini";
const REFERER = process.env.SITE_URL || "https://toppery.work";
const TITLE = "Toppery AML – Analisi avanzata";

// ---------- utils
function stripCodeFences(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/```json/gi, "```")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .trim();
}

function tryParseJSON(s) {
  if (!s) return null;
  let raw = stripCodeFences(s);
  // recover JSON object boundaries if model added prose around it
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    raw = raw.slice(start, end + 1);
  }
  try { return JSON.parse(raw); } catch (_) { return null; }
}

// normalize numbers written with it-IT formatting (e.g., "26.798,00" or "26,798.00")
function toNumber(any) {
  if (typeof any === "number") return any;
  if (any === null || any === undefined) return 0;
  let s = String(any).trim();
  if (!s) return 0;
  // remove spaces
  s = s.replace(/\s+/g, "");
  // if both comma and dot exist, assume dot=thousands, comma=decimal
  if (s.includes(",") && s.includes(".")) {
    // decide by last separator position
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // likely 12.345,67 -> remove dots, replace comma with dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // likely 12,345.67 -> remove commas
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // no dot, only comma -> decimal comma
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // only dot or none: remove thousands dots if present like "12.345"
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join(""); // "12.345.678" -> "12345678"
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseTs(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (_) { return null; }
}

function normalizeTx(raw) {
  // expected fields (flexible): ts | timestamp | date, amount | importo, dir | direction, method | payment_method | metodo, source
  const ts = parseTs(raw.ts ?? raw.timestamp ?? raw.date);
  let amount = toNumber(raw.amount ?? raw.importo ?? 0);
  let dir = String(raw.dir ?? raw.direction ?? raw.tipo ?? raw.type ?? "").toLowerCase();
  const method = String(raw.method ?? raw.payment_method ?? raw.metodo ?? raw.causale ?? "other").toLowerCase();
  const source = String(raw.source ?? raw.sorgente ?? raw.src ?? "").toLowerCase(); // 'card' etc.

  // derive direction from sign if missing or ambiguous
  if (!dir || (dir !== "in" && dir !== "out" && dir !== "deposit" && dir !== "prelievo")) {
    if (amount < 0) dir = "out";
    else dir = "in";
  }
  // normalize sign: store positive amounts, keep direction separately
  if (amount < 0) amount = Math.abs(amount);

  // map localized labels
  if (dir === "deposito" || dir === "deposit") dir = "in";
  if (dir === "prelievo" || dir === "withdraw" || dir === "withdrawal") dir = "out";

  return { ts, amount, dir, method, source };
}

function dedupeTxs(list) {
  const seen = new Set();
  const out = [];
  for (const t of list) {
    // key: minute granularity to avoid duplicate rows from double import
    const minute = t.ts ? t.ts.slice(0, 16) : "";
    const key = `${minute}|${t.amount.toFixed(2)}|${t.dir}|${t.method}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function aggregateIndicators(txs) {
  const byMonth = {}; // { 'YYYY-MM': { in: sum, out: sum } }
  const byHour = Array.from({ length: 24 }, () => 0);
  const byMethod = {}; // volumes by method

  let totalIn = 0, totalOut = 0;
  for (const t of txs) {
    const d = new Date(t.ts);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
    const hour = d.getUTCHours();

    if (!byMonth[ym]) byMonth[ym] = { in: 0, out: 0 };
    if (t.dir === "in") {
      byMonth[ym].in += t.amount;
      totalIn += t.amount;
    } else {
      byMonth[ym].out += t.amount;
      totalOut += t.amount;
    }
    byHour[hour] += 1; // count transactions per hour
    byMethod[t.method] = (byMethod[t.method] || 0) + t.amount;
  }
  const net = totalIn - totalOut;
  return {
    totals: { deposits: round2(totalIn), withdrawals: round2(totalOut), net: round2(net) },
    monthly: Object.entries(byMonth).map(([month, v]) => ({ month, deposits: round2(v.in), withdrawals: round2(v.out) })),
    hourlyCounts: byHour, // simple histogram
    methodVolumes: Object.entries(byMethod).map(([method, volume]) => ({ method, volume: round2(volume) })),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

function toCsv(txs) {
  if (!txs || !txs.length) return "";
  const header = "ts,amount,dir,method\n";
  const rows = txs.map(t => `${t.ts},${t.amount.toFixed(2)},${t.dir},${t.method}`).join("\n");
  return header + rows;
}

// ---------- handler
exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: cors(),
      };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "method_not_allowed" }) };
    }
    if (!OPENROUTER_API_KEY) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "missing_openrouter_key" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const includeCards = !!body.includeCards;
    let txs = Array.isArray(body.txs) ? body.txs : [];

    if (!txs.length) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "no_transactions" }) };
    }

    // normalize + filter + dedupe
    txs = txs.map(normalizeTx).filter(t => t.ts && t.amount > 0 && (includeCards || t.source !== "card"));
    txs = dedupeTxs(txs);

    if (!txs.length) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "empty_after_filtering" }) };
    }

    // indicators computed from the *same* dataset we send to the model
    const indicators = aggregateIndicators(txs);
    const csv = toCsv(txs);

    // construct the prompt with explicit facts (model must not invent totals)
    const system = `Sei un analista AML. Rispondi SOLO con JSON valido con le chiavi: summary (string), risk_score (number 0-100).
Devi basarti SOLO sulle transazioni CSV fornite.
Fatti calcolati (vincolanti): depositi=${indicators.totals.deposits.toFixed(2)}, prelievi=${indicators.totals.withdrawals.toFixed(2)}, net=${indicators.totals.net.toFixed(2)}.
Non inventare numeri: se devi citare importi totali, usa i Fatti calcolati.`;

    const user = `CSV (ts,amount,dir,method):\n${csv}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": REFERER,
        "X-Title": TITLE,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    const raw = await res.text();
    if (!res.ok) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: `openrouter_http_${res.status}`, raw }) };
    }
    let data;
    try { data = JSON.parse(raw); } catch (_) {}
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseJSON(content);
    if (!parsed || typeof parsed.summary !== "string") {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: "invalid_ai_output", raw: content }) };
    }

    const payload = {
      summary: parsed.summary,
      risk_score: typeof parsed.risk_score === "number" ? parsed.risk_score : null,
      indicators,
    };

    return { statusCode: 200, headers: cors(), body: JSON.stringify(payload) };

  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: "unhandled_exception", message: String(err && err.message || err) })
    };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
