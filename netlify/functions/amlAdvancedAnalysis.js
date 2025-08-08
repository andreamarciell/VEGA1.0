/**
 * Netlify Function: amlAdvancedAnalysis
 * Input: { username?: string, transactions: Array<{ ts: string|number, amount: number, direction: 'deposit'|'withdrawal', method?: string, cause?: string }> }
 * Output:
 * {
 *   flags: string[],
 *   recommendations: string[],
 *   summary: string,
 *   indicators: { monthNetFlow: { deposits: number, withdrawals: number }, hourlyHistogram: number[], methodBreakdown: Record<string, number>, dailyTrend: Array<{ day: string, deposits: number, withdrawals: number }>, dailyCounts: Array<{ day: string, count: number }> },
 *   ai?: { used: boolean, model?: string, duration_ms?: number }
 * }
 */
exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'method_not_allowed' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'payload mancante' }),
      };
    }

    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'json_invalid', details: String(e && e.message || e) }),
      };
    }

    const txsRaw = Array.isArray(payload.transactions) ? payload.transactions : [];

    if (!txsRaw.length) {
      return {
        statusCode: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'payload mancante', details: 'transactions vuoto' }),
      };
    }

    // Normalize transactions
    const txs = txsRaw.map(t => {
      const ts = t.ts ?? t.timestamp ?? t.date ?? t.created_at ?? null;
      const amount = Number(t.amount ?? t.importo ?? t.value ?? 0);
      const directionRaw = (t.direction ?? t.dir ?? t.type ?? t.movimento ?? '').toString().toLowerCase();
      const direction = directionRaw.includes('with') || directionRaw.includes('prel') ? 'withdrawal' : 'deposit';
      const method = (t.method ?? t.payment_method ?? t.metodo ?? 'other').toString().toLowerCase();
      const cause = (t.cause ?? t.causale ?? t.category ?? 'other').toString().toLowerCase();
      const d = ts ? new Date(ts) : null;
      const hour = d ? d.getHours() : null;
      const dayKey = d ? d.toISOString().slice(0,10) : 'unknown';
      return { ts: d ? d.toISOString() : null, amount, direction, method, cause, hour, dayKey };
    }).filter(x => x.ts && isFinite(x.amount));

    // Indicators
    const now = new Date();
    const nowMonth = now.toISOString().slice(0,7);
    const monthTxs = txs.filter(t => t.ts.slice(0,7) === nowMonth);
    const deposits = monthTxs.filter(t => t.direction === 'deposit').reduce((s,t)=>s+t.amount,0);
    const withdrawals = monthTxs.filter(t => t.direction === 'withdrawal').reduce((s,t)=>s+t.amount,0);

    const hourlyHistogram = Array.from({length:24}, ()=>0);
    txs.forEach(t => { if (t.hour != null) hourlyHistogram[t.hour] += Math.abs(t.amount); });

    const methodBreakdown = {};
    txs.forEach(t => { methodBreakdown[t.method] = (methodBreakdown[t.method]||0) + Math.abs(t.amount); });

    const byDay = {};
    const dailyCountsMap = {};
    txs.forEach(t => {
      if (!byDay[t.dayKey]) byDay[t.dayKey] = { deposits:0, withdrawals:0 };
      if (t.direction === 'deposit') byDay[t.dayKey].deposits += t.amount;
      else byDay[t.dayKey].withdrawals += t.amount;
      dailyCountsMap[t.dayKey] = (dailyCountsMap[t.dayKey] || 0) + 1;
    });
    const dailyTrend = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([day, v]) => ({ day, deposits: v.deposits, withdrawals: v.withdrawals }));
    const dailyCounts = Object.entries(dailyCountsMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));

    // Derive flags (conservative)
    const flags = [];
    if (withdrawals > deposits * 0.9 && withdrawals > 0) flags.push('Prelievi ~ pari o superiori ai depositi nel mese corrente');
    if (methodBreakdown['voucher'] && methodBreakdown['voucher'] / (deposits + withdrawals + 1) > 0.2) flags.push('Uso significativo di voucher');
    const nightActivity = hourlyHistogram.slice(0,6).reduce((s,v)=>s+v,0) + hourlyHistogram.slice(22,24).reduce((s,v)=>s+v,0);
    const dayActivity = hourlyHistogram.slice(6,22).reduce((s,v)=>s+v,0);
    if (nightActivity > dayActivity * 0.5) flags.push('Attività notturna rilevante (22–06)');
    const bigTx = txs.filter(t => Math.abs(t.amount) >= 10000).length;
    if (bigTx) flags.push(`Transazioni di importo elevato (>= 10k): ${bigTx}`);
    if (!flags.length) flags.push('Nessuna anomalia evidente dai soli metadati');

    // Recommendations (8–12 items)
    const recommendations = [
      'Verifica la coerenza tra fonti di fondi e volumi recenti',
      'Controlla i prelievi ripetuti con voucher su brevi finestre temporali',
      'Analizza i cicli deposito-prelievo vicini nel tempo (mirror transactions)',
      'Monitora la concentrazione oraria (picchi notturni)',
      'Riesamina i metodi con maggior peso (top-2) per KYC addizionale',
      'Confronta net flow mese su mese per trend improvvisi',
      'Verifica incongruenze su causali/verticali di gioco',
      'Indaga eventuali annullamenti prelievo ripetuti',
      'Applica regole di velocity su importi e frequenza',
      'Effettua controllo su strumenti di pagamento di terze parti',
      'Campiona movimenti > 10k per evidenze documentali',
      'Rivaluta il profilo rischio alla prossima ricarica importante',
    ];

    // Summary
    const topMethod = Object.entries(methodBreakdown).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'other';
    const peakHour = hourlyHistogram.reduce((p,v,i)=> v>hourlyHistogram[p] ? i : p, 0);
    const netFlow = deposits - withdrawals;
    const summary = `Nel mese ${nowMonth} i depositi sono pari a ${deposits.toFixed(2)} e i prelievi a ${withdrawals.toFixed(2)} (net flow ${netFlow.toFixed(2)}). Il metodo prevalente è ${topMethod}. Il picco orario di volume è alle ${String(peakHour).padStart(2,'0')}:00. Attività giornaliera distribuita su ${dailyCounts.length} giorni.`;

    const result = {
      flags,
      recommendations,
      summary,
      indicators: {
        monthNetFlow: { deposits, withdrawals },
        hourlyHistogram,
        methodBreakdown,
        dailyTrend,
        dailyCounts,
      },
      ai: { used: false },
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'internal_error', details: String(err && err.message || err) }),
    };
  }
};
