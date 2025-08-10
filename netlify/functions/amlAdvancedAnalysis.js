// netlify/functions/amlAdvancedAnalysis.js
// Handles advanced AML analysis through OpenRouter (gpt-4.1-nano).
// Sends ONLY anonymized CSV (ts,amount,dir,reason).
// Returns: { summary: string, risk_score: number }
/* eslint-disable */

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const bodyIn = JSON.parse(event.body || '{}');
    const txs = Array.isArray(bodyIn.txs) ? bodyIn.txs : [];

    // Build CSV: ts,amount,dir,reason (anonymized)
    const header = 'ts,amount,dir,reason';
    const lines = [header];

    const sanitizeReason = (s) => {
      if (!s) return '';
      return String(s)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
        .replace(/\b\d{12,19}\b/g, '[card]')
        .replace(/\b[A-Z0-9]{14,}\b/gi, '[id]')
        .replace(/,/g, ';')
        .trim();
    };

    for (const t of txs) {
      // accept several possible field names, never drop amount=0
      const tsRaw = t.ts || t.timestamp || t.date || t.datetime || t.created_at;
      const ts = tsRaw ? new Date(tsRaw).toISOString() : new Date().toISOString();
      let amount = t.amount;
      if (amount === undefined) amount = t.importo ?? t.value ?? t.sum ?? 0;
      amount = Number(amount) || 0; // keep zero

      let dir = (t.dir || t.direction || t.type || '').toString().toLowerCase();
      // fallback: infer from sign or reason keywords
      if (!dir || (dir !== 'in' && dir !== 'out')) {
        if (Number(t.amount || t.importo || 0) < 0) dir = 'out';
        else if (Number(t.amount || t.importo || 0) > 0) dir = 'in';
        else {
          const r = (t.reason || t.causale || t.description || '').toString().toLowerCase();
          if (/preliev|withdraw|cashout|payout/.test(r)) dir = 'out';
          else dir = 'in';
        }
      }

      const reasonRaw = t.reason || t.causale || t.description || '';
      const reason = sanitizeReason(reasonRaw);

      lines.push(`${ts},${amount},${dir},${reason}`);
    }

    const csv = lines.join('\n');

    const userPrompt = `sei un analista aml per una piattaforma igaming italiana.
riceverai **SOLO** transazioni anonimizzate in formato CSV: ts,amount,dir,reason (UTC).

compito: analizza e scrivi una **SINTESI GENERALE dettagliata** (in italiano) che includa *obbligatoriamente*:
- i totali complessivi di quanto il giocatore ha **DEPOSITATO** e **PRELEVATO** nel periodo analizzato (calcolali dal CSV);
- i prodotti su cui è focalizzata l'attività (slot, casino live, poker, sportsbook, lotterie, altro) se deducibili dal "reason";
- anomalie/pattern (frazionamenti/structuring, round-tripping, escalation/decrescita, bonus abuse, mirror transactions, importi tondi o appena non tondi, tempi ristretti tra movimenti, orari notturni, ecc.);
- picchi di attività con **giorni e fasce orarie** precise (es. "2025-06-14 tra 21:00-23:00 UTC");
- eventuali **cambi di metodo di pagamento** (es. deposito cash e prelievo su carta) deducibili dal "reason";
- gli **indicatori di rischio AML** osservati.
assegna anche un punteggio **RISK_SCORE** da 0 a 100 (0 basso, 100 massimo).

rispondi **SOLO** con **JSON valido** (nessun testo fuori dal JSON) con **esattamente** queste chiavi:
{ "summary": string, "risk_score": number }

DATI (CSV):
${csv}
`;

    const payload = {
      model: 'openai/gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Sei un analista AML senior. Rispondi solo con JSON valido.' },
        { role: 'user', content: userPrompt }
      ]
    };

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://toppery.work,
        'X-Title': process.env.APP_TITLE || 'Toppery AML'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, body: rawText };
    }

    let result;
    try {
      const data = JSON.parse(rawText);
      const content = data?.choices?.[0]?.message?.content ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      const jsonText = match ? match[0] : content;
      result = JSON.parse(jsonText);
      if (typeof result.risk_score !== 'number') {
        const n = Number(result.risk_score);
        result.risk_score = Number.isFinite(n) ? n : 0;
      }
      if (typeof result.summary !== 'string') {
        result.summary = String(result.summary || '');
      }
    } catch (e) {
      return {
        statusCode: 422,
        body: JSON.stringify({ code: 'invalid_json_from_model', detail: e.message, upstream: rawText })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
