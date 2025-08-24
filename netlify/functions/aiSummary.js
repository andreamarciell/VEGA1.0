
'use strict';

// Netlify Function: aiSummary
// Reads process.env.OPENROUTER_API_KEY and calls OpenRouter chat/completions.
// Expects: POST { text: string, urlHint?: string, language?: 'it'|'en', model?: string, temperature?: number, max_tokens?: number }
// Returns: { summary: string }

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
  if (!OPENROUTER_API_KEY) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing OPENROUTER_API_KEY env' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  const text = (payload.text || '').toString().trim();
  const urlHint = (payload.urlHint || '').toString().trim();
  const lang = (payload.language || 'it').toString();
  const model = payload.model || 'openai/gpt-4o-mini';
  const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.2;
  const max_tokens = typeof payload.max_tokens === 'number' ? payload.max_tokens : 400;

  if (!text) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'empty text' }) };
  }

  const sys = lang === 'it'
    ? 'Sei un assistente AML. Riassumi il testo in modo neutrale e professionale, preservando nomi, date e fatti chiave. Restituisci SOLO il riassunto.'
    : 'You are an AML assistant. Summarize the text neutrally and professionally, preserving names, dates, and key facts. Return ONLY the summary.';

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: (urlHint ? `Fonte: ${urlHint}\n` : '') + (lang === 'it' ? 'Testo da riassumere:' : 'Text to summarize:') + '\n\n' + text }
  ];

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://toppery.work', // optional
        'X-Title': 'Toppery AML'
      },
      body: JSON.stringify({ model, temperature, max_tokens, messages })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'openrouter error', status: resp.status, detail: errTxt.slice(0, 800) }) };
    }
    const data = await resp.json();
    const content = data && data.choices && data.choices[0] && (data.choices[0].message && data.choices[0].message.content || data.choices[0].delta && data.choices[0].delta.content);
    const summary = (content || '').toString().trim();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'function failure', message: (e && e.message) || String(e) }) };
  }
};
