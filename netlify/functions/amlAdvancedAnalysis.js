/** Netlify Function: amlAdvancedAnalysis
 * POST body: { txs: [{ ts, amount, dir, reason }] }
 * Returns: AdvancedAnalysis JSON
 */
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  try {
    const { txs } = JSON.parse(event.body || '{}');
    if (!Array.isArray(txs) || txs.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'payload mancante' }) };
    }

    // Always compute indicators locally so we can fall back if AI is unavailable
    const indicators = computeIndicatorsFromTxs(txs);

    // Heuristic flags (used both standalone and to enrich AI output)
    const heurFlags = computeHeuristicFlags(txs, indicators);

    // Baseline deterministic recommendations (8–12 items)
    const baseRecs = buildDeterministicRecommendations(indicators, heurFlags);

    // Compose a single descriptive summary
    const baseSummary = buildDeterministicSummary(indicators);

    // Try AI (optional). If unavailable or fails, respond with deterministic result.
    let riskScore = heurFlags.reduce((acc, f) => acc + (f.severity === 'high' ? 15 : f.severity === 'medium' ? 8 : 4), 10);
    if (riskScore > 95) riskScore = 95;
    let out = {
      riskScore: Math.round(riskScore),
      flags: heurFlags,
      recommendations: baseRecs,
      summary: baseSummary,
      indicators,
      ai: { used: false }
    };

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

    if (OPENROUTER_API_KEY) {
      try {
        const prompt = buildAIPrompt(txs, indicators, heurFlags);
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: 'You are an AML analyst. Return STRICT JSON matching the schema.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        });
        if (aiRes.ok) {
          const data = await aiRes.json();
          const txt = data?.choices?.[0]?.message?.content || '';
          const parsed = safeParseJSON(txt);
          if (parsed) {
            // Merge with our deterministic fields to guarantee presence & shape
            out = {
              riskScore: coerceNumber(parsed.riskScore, out.riskScore),
              flags: Array.isArray(parsed.flags) ? normalizeFlags(parsed.flags, heurFlags) : heurFlags,
              recommendations: normalizeStringArray(parsed.recommendations, baseRecs),
              summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : baseSummary,
              indicators: { ...indicators, ...(parsed.indicators || {}) },
              ai: { used: true, model: MODEL }
            };
          } else {
            out.ai = { used: false, error: 'invalid ai json' };
          }
        } else {
          out.ai = { used: false, error: `ai http ${aiRes.status}` };
        }
      } catch (e) {
        out.ai = { used: false, error: String(e && e.message || e) };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e?.message || 'errore' }) };
  }
};

function safeParseJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
function coerceNumber(n, fallback=0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}
function normalizeStringArray(a, fallback=[]) {
  if (!Array.isArray(a)) return fallback;
  return a.map(x => String(x || '').trim()).filter(Boolean);
}
function normalizeFlags(a, fallback=[]) {
  if (!Array.isArray(a)) return fallback;
  return a.map(f => ({
    code: String(f.code || '').trim() || 'generic',
    label: String(f.label || f.code || 'Flag').trim(),
    severity: ['low','medium','high'].includes(String(f.severity)) ? String(f.severity) : 'low',
    details: String(f.details || '').trim()
  }));
}

function computeIndicatorsFromTxs(txs) {
  const monthMap = new Map(); // YYYY-MM -> {month,deposits,withdrawals}
  const hourMap = new Map();  // hour -> {hour,count,volume}
  const methodMap = new Map();// method -> {method,count,volume}

  for (const t of txs) {
    const d = new Date(t.ts || t.timestamp || t.date);
    if (isNaN(d.getTime())) continue;
    const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const hour = d.getHours();
    const amount = Math.abs(Number(t.amount) || 0);
    const dir = (t.dir || t.direction || '').toString().toLowerCase() === 'out' ? 'out' : 'in';
    // method / reason normalization
    let method = (t.method || t.paymentMethod || t.reason || '').toString().toLowerCase();
    if (!method) method = 'other';
    if (method.includes('voucher') || method.includes('pvr')) method = 'voucher';
    else if (method.includes('card') || method.includes('visa') || method.includes('mastercard')) method = 'card';
    else if (method.includes('bank') || method.includes('wire') || method.includes('transfer')) method = 'bank';
    else if (!method.trim()) method = 'other';

    const mRec = monthMap.get(month) || { month, deposits: 0, withdrawals: 0 };
    if (dir === 'out') mRec.withdrawals += amount; else mRec.deposits += amount;
    monthMap.set(month, mRec);

    const hRec = hourMap.get(hour) || { hour, count: 0, volume: 0 };
    hRec.count += 1; hRec.volume += amount;
    hourMap.set(hour, hRec);

    const meRec = methodMap.get(method) || { method, count: 0, volume: 0 };
    meRec.count += 1; meRec.volume += amount;
    methodMap.set(method, meRec);
  }

  const netFlowByMonth = Array.from(monthMap.values()).sort((a,b)=>a.month.localeCompare(b.month));
  const hourlyHistogram = Array.from(hourMap.values()).sort((a,b)=>a.hour-b.hour);
  const methodBreakdown = Array.from(methodMap.values()).sort((a,b)=>b.volume-a.volume);
  const totalVol = methodBreakdown.reduce((s,m)=>s+m.volume,0) || 1;
  methodBreakdown.forEach(m => m.pct = +(m.volume/totalVol*100).toFixed(1));

  return { netFlowByMonth, hourlyHistogram, methodBreakdown };
}

function computeHeuristicFlags(txs, ind) {
  const flags = [];
  const totalCount = txs.length;
  const totalAmt = txs.reduce((s,t)=>s+Math.abs(Number(t.amount)||0),0);

  // Night activity
  const nightCount = ind.hourlyHistogram.filter(h => h.hour >= 22 || h.hour < 6).reduce((s,h)=>s+h.count,0);
  if (nightCount/Math.max(1,totalCount) > 0.25) {
    flags.push({ code:'night_activity', label:'Attività notturna elevata', severity:'medium', details:`${nightCount}/${totalCount} operazioni tra 22–6` });
  }

  // Voucher usage
  const voucher = ind.methodBreakdown.find(m => m.method === 'voucher');
  if (voucher && voucher.pct >= 20) {
    flags.push({ code:'voucher_usage', label:'Uso significativo di voucher', severity:'medium', details:`${voucher.pct}% del volume` });
  }

  // High single amount
  const high = txs.some(t => Math.abs(Number(t.amount)||0) >= 10000);
  if (high) flags.push({ code:'high_amount', label:'Transazioni ad alto importo', severity:'high', details:'>= 10k' });

  // Burst prelievi post-deposito (simplified)
  let burst = 0;
  const byTime = [...txs].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  for (let i=1;i<byTime.length;i++) {
    const prev = byTime[i-1], cur = byTime[i];
    const dt = (new Date(cur.ts)-new Date(prev.ts))/36e5; // hours
    if (dt <= 3 && ((prev.dir==='in'&&cur.dir==='out') || (prev.dir==='out'&&cur.dir==='in'))) burst++;
  }
  if (burst >= 3) flags.push({ code:'rapid_in_out', label:'Ciclo rapido deposito-prelievo', severity:'high', details:`${burst} switch entro 3h` });

  return flags;
}

function buildDeterministicRecommendations(ind, flags) {
  const recs = [];
  if (flags.some(f=>f.code==='high_amount')) {
    recs.push('Verifica depositi/prelievi con importi singoli >= 10k e origine dei fondi.');
  }
  if (flags.some(f=>f.code==='voucher_usage')) {
    recs.push('Analizza l’uso dei voucher/PVR, verifica possibili ricariche di terzi.');
  }
  if (flags.some(f=>f.code==='rapid_in_out')) {
    recs.push('Indaga schemi di mirror transactions e cash-out rapido post accredito.');
  }
  if (flags.some(f=>f.code==='night_activity')) {
    recs.push('Monitora pattern di gioco notturno e verifica velocity anomala.');
  }

  const topMethod = ind.methodBreakdown[0]?.method;
  if (topMethod) recs.push(`Controlla i metodi prevalenti (${topMethod}) per chargeback/frode.`); 
  const maxHour = ind.hourlyHistogram.sort((a,b)=>b.count-a.count)[0]?.hour;
  if (typeof maxHour === 'number') recs.push(`Concentra i controlli nella fascia oraria di picco (h ${String(maxHour).padStart(2,'0')}).`);
  if (ind.netFlowByMonth.length >= 1) recs.push('Verifica la coerenza del net flow mensile con il profilo economico dichiarato.');
  recs.push('Controlla annullamenti prelievo ripetuti e incongruenze di flusso.');
  recs.push('Esegui KYC refresh se gli indicatori restano elevati.');
  recs.push('Valuta limiti/hold temporanei sui prelievi sospetti.');
  // Ensure 8–12 recs
  while (recs.length < 8) recs.push('Esegui controlli aggiuntivi su conti/metodi collegati e IP condivisi.');
  return recs.slice(0, 12);
}

function buildDeterministicSummary(ind) {
  const last = ind.netFlowByMonth[ind.netFlowByMonth.length-1];
  const topMethod = ind.methodBreakdown[0];
  const maxHour = ind.hourlyHistogram.slice().sort((a,b)=>b.count-a.count)[0];
  const dep = last?.deposits || 0, w = last?.withdrawals || 0;
  const net = dep - w;
  return `Ultimo mese: depositi ${formatCurrency(dep)}, prelievi ${formatCurrency(w)}, net flow ${formatCurrency(net)}. Metodo prevalente: ${topMethod?.method || 'n/d'} (${topMethod ? topMethod.pct + '%': 'n/d'}). Fascia oraria più attiva: ${typeof maxHour?.hour==='number' ? String(maxHour.hour).padStart(2,'0') : 'n/d'}.`;
}

function formatCurrency(n) {
  return Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n||0));
}

function buildAIPrompt(txs, ind, flags) {
  return JSON.stringify({
    instruction: 'Restituisci un JSON con {riskScore:number 0-100, flags:[{code,label,severity,details}], recommendations:string[], summary:string, indicators:{}}. Usa italiano. Le raccomandazioni devono essere 8-12 voci sintetiche. Fornisci un solo riepilogo descrittivo (summary).',
    indicators: ind,
    flags,
    sample: txs.slice(0, 20).map(t => ({ ts: t.ts, amount: t.amount, dir: t.dir, method: t.method || t.reason || 'other' }))
  });
}
