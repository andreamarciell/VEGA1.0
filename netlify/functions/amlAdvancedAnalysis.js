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
        required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: {
          risk_score: { type: "number", minimum: 0, maximum: 100 },
          flags: {
            type: "array",
            items: {
              type: "object",
              required: ["code","severity","reason"],
              required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: {
                code: { type: "string" },
                severity: { enum: ["low","medium","high"] },
                reason: { type: "string" }
              }
            }
          },
          indicators: {
            type: "object",
            required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: {
              net_flow_by_month: {
                type: "array",
                items: {
                  type: "object",
                  required: ["month","deposits","withdrawals"],
                  required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
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
                  required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: { hour: { type: "integer", minimum:0, maximum:23 }, count:{ type: "integer", minimum:0 } }
                }
              },
              method_breakdown: {
                type: "array",
                items: {
                  type: "object",
                  required: ["method","pct"],
                  required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: { method: { type:"string" }, pct: { type:"number", minimum:0, maximum:100 } }
                }
              },
              velocity: {
                type: "object",
                required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: {
                  avg_txs_per_hour: { type: "number" },
                  spikes: {
                    type: "array",
                    items: { type: "object", required: ["net_flow_by_month","hourly_histogram","method_breakdown"],
            properties: { ts: { type:"string" }, z: { type:"number" } } }
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
    
    function classifyMethod(reason='') {
      const s = String(reason).toLowerCase();
      if (/visa|mastercard|amex|maestro|carta|card/.test(s)) return 'card';
      if (/sepa|bonifico|bank|iban/.test(s)) return 'bank';
      if (/skrill|neteller|paypal|ewallet|wallet/.test(s)) return 'ewallet';
      if (/crypto|btc|eth|usdt|usdc/.test(s)) return 'crypto';
      if (/paysafecard|voucher|coupon/.test(s)) return 'voucher';
      if (/bonus|promo/.test(s)) return 'bonus';
      return 'other';
    }

    function computeIndicatorsFromTxs(txs) {
      const monthMap = new Map();
      for (const t of txs) {
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const month = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        const rec = monthMap.get(month) || { month, deposits: 0, withdrawals: 0 };
        if (t.dir === 'out') rec.withdrawals += Math.abs(Number(t.amount)||0);
        else rec.deposits += Math.abs(Number(t.amount)||0);
        monthMap.set(month, rec);
      }
      const net_flow_by_month = Array.from(monthMap.values()).sort((a,b)=>a.month.localeCompare(b.month));

      const hours = Array.from({length:24}, (_,h)=>({hour:h, count:0}));
      for (const t of txs) {
        const d = new Date(t.ts);
        if (!isFinite(d)) continue;
        const h = d.getHours();
        if (h>=0 && h<24) hours[h].count++;
      }
      const hourly_histogram = hours;

      const counts = {};
      for (const t of txs) {
        const m = t.method || classifyMethod(t.reason);
        counts[m] = (counts[m]||0)+1;
      }
      const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
      const method_breakdown = Object.entries(counts).map(([method, c])=>({ method, pct: +(100*c/total).toFixed(2) }));

      return { net_flow_by_month, hourly_histogram, method_breakdown };
    }


    const MODELS = [
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-r1:free",
      "zhipu/glm-4.5-air:free"
    ];

    async function callModel(model) {
      const body = {
        model,
        messages: [
          { role: "system", content: "Sei un analista AML/Fraud per iGaming. Rispondi SOLO con JSON valido aderente allo schema." },
          { role: "user", content: "Analizza le transazioni anonimizzate. Valuta rischio, pattern, velocity, net flow mensile, fasce orarie, metodi." },
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
    // --- post-process: ensure flags, richer recommendations, and final summary ---
    const arr = (v) => Array.isArray(v) ? v : [];
    out.flags = arr(out.flags);
    out.recommendations = arr(out.recommendations);

    // compute indicators snapshot for heuristics
    const snap = computeIndicatorsFromTxs(txs);

    // Heuristic flags if missing/empty
    if (out.flags.length === 0) {
      try {
        const totalTx = txs.length;
        const nocturnal = txs.filter(t => {
          const h = new Date(t.ts).getHours();
          return h >= 0 && h < 6;
        }).length;
        if (nocturnal / Math.max(totalTx,1) > 0.35) {
          out.flags.push({ code: 'nocturnal_activity', severity: 'medium', reason: 'quota significativa di attività tra 00:00 e 06:00' });
        }
        const bigAmounts = txs.filter(t => Math.abs(Number(t.amount)||0) >= 5000).length;
        if (bigAmounts >= 3) {
          out.flags.push({ code: 'high_amounts', severity: 'high', reason: 'più transazioni di importo elevato (≥ 5k)' });
        }
        const vouchers = txs.filter(t => /voucher|paysafecard/i.test(String(t.reason))).length;
        if (vouchers >= 2) {
          out.flags.push({ code: 'voucher_usage', severity: 'medium', reason: 'uso ricorrente di voucher/prepagate' });
        }
      } catch {}
    }

    // Expand recommendations: target 8–12 items
    const addRec = (s) => {
      if (!s) return;
      const t = String(s).trim();
      if (!t) return;
      if (!out.recommendations.some(r => String(r).toLowerCase() === t.toLowerCase())) {
        out.recommendations.push(t);
      }
    };

    try {
      const topMethod = (snap.method_breakdown || []).slice().sort((a,b)=>b.pct-a.pct)[0]?.method;
      if (topMethod) addRec(`monitorare i movimenti effettuati con metodo di pagamento principale (“${topMethod}”), confrontando volumi e frequenza con periodi precedenti`);
      const peakHour = (snap.hourly_histogram||[]).slice().sort((a,b)=>b.count-a.count)[0]?.hour;
      if (peakHour != null) addRec(`verificare attività nelle ore di picco (h ${String(peakHour).padStart(2,'0')}) per anomalie di velocità o importi`);
      addRec('analizzare scostamento net flow mese su mese e possibili spikes in entrata/uscita');
      addRec('riconciliare depositi con fonti lecite dichiarate e matching KYC');
      addRec('valutare prelievi ravvicinati ai depositi (rapporto deposit-prelievi e intervallo temporale)');
      addRec('controllare ripetizioni di importi “non tondi” o pattern frazionati');
      addRec('ispezionare ricariche via voucher/prepagate per rischio terze parti');
      addRec('verificare multi‑accounting tramite IP/ISP/Device fingerprint');
      addRec('confrontare comportamento con coorti simili (profilazione rischio)');
      addRec('riesaminare chargeback/refund e storico annullamenti prelievo');
    } catch {}

    // Compose descriptive summary
    try {
      const last = (snap.net_flow_by_month||[]).slice(-1)[0] || { deposits:0, withdrawals:0, month:'n/d' };
      const net = Number(last.deposits||0) - Number(last.withdrawals||0);
      const top = (snap.method_breakdown||[]).slice().sort((a,b)=>b.pct-a.pct)[0];
      const peak = (snap.hourly_histogram||[]).slice().sort((a,b)=>b.count-a.count)[0];
      const parts = [];
      parts.push(`net flow ${last.month}: ${net >= 0 ? '+' : ''}${Math.round(net)}`);
      if (top) parts.push(`metodo prevalente: ${top.method} (${top.pct}% transazioni)`);
      if (peak) parts.push(`ore più attive: ${String(peak.hour).padStart(2,'0')}:00`);
      out.summary = parts.join(' · ');
    } catch {}
    // --- end post-process ---

    }
    if (!out) {
      throw error || new Error("tutti i modelli hanno fallito");
    }


    const indicators = out && out.indicators ? out.indicators : {};
    if (!indicators.net_flow_by_month || indicators.net_flow_by_month.length === 0 ||
        !indicators.hourly_histogram || indicators.hourly_histogram.length === 0 ||
        !indicators.method_breakdown || indicators.method_breakdown.length === 0) {
      const fb = computeIndicatorsFromTxs(txs);
      out.indicators = {
        net_flow_by_month: fb.net_flow_by_month,
        hourly_histogram: fb.hourly_histogram,
        method_breakdown: fb.method_breakdown,
        ...(indicators || {})
      };
    }

    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'errore' }) };
  }
};
