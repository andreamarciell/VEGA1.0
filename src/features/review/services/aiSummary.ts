
/**
 * AI summarization via OpenRouter (client-side with serverless fallback).
 * Priority:
 * 1) If localStorage('OPENROUTER_API_KEY') exists, call OpenRouter directly (like v35).
 * 2) Otherwise call Netlify Function '/.netlify/functions/aiSummary' which uses env OPENROUTER_API_KEY.
 */
export type SummarizeOptions = {
  apiKey?: string;
  model?: string;            // e.g., 'openai/gpt-4o-mini' or 'openrouter/auto'
  maxTokens?: number;        // hard cap
  temperature?: number;
  language?: 'it' | 'en';
  urlHint?: string;          // optional source url to keep in mind
};

function stripHtml(html: string): string {
  const el = (globalThis as any).document?.createElement?.('div');
  if (el) {
    el.innerHTML = html;
    return (el.textContent || (el as any).innerText || '').replace(/\s+/g, ' ').trim();
  }
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateSummaryAI(inputHtml: string, opts: SummarizeOptions = {}): Promise<string> {
  const text = stripHtml(inputHtml);
  const lang = opts.language || 'it';
  const urlHint = opts.urlHint || '';
  const model = opts.model || 'openai/gpt-4o-mini';
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.2;
  const max_tokens = opts.maxTokens || 400;

  // 1) direct call if key is available (v35-style)
  const directKey =
    opts.apiKey ||
    ((typeof localStorage !== 'undefined' && localStorage.getItem('OPENROUTER_API_KEY')) || undefined) ||
    // try non-VITE envs just in case they were exposed at build-time
    ((typeof import.meta !== 'undefined' ? (import.meta as any).env?.OPENROUTER_API_KEY : undefined));

  if (directKey) {
    const body = {
      model,
      temperature,
      max_tokens,
      messages: [
        { role: 'system', content: lang === 'it'
          ? 'Sei un assistente AML. Riassumi il testo in modo neutrale e professionale, preservando nomi e fatti chiave. Output SOLO il riassunto.'
          : 'You are an AML assistant. Summarize the text neutrally and professionally, preserving names and key facts. Output ONLY the summary.' },
        { role: 'user', content: (urlHint ? `Fonte: ${urlHint}\n` : '') + (lang === 'it' ? 'Testo da riassumere:' : 'Text to summarize:') + '\n\n' + text }
      ]
    };
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${directKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'Toppery AML'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI summary HTTP ${resp.status}: ${t.slice(0, 500)}`);
    }
    const data = await resp.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ?? '';
    if (!content) throw new Error('AI summary empty response');
    return String(content).trim();
  }

  // 2) fallback: serverless function (uses env OPENROUTER_API_KEY)
  const resp = await fetch('/.netlify/functions/aiSummary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, urlHint, language: lang, model, temperature, max_tokens })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI function HTTP ${resp.status}: ${t.slice(0, 500)}`);
  }
  const data = await resp.json();
  const summary = (data?.summary || '').toString().trim();
  if (!summary) throw new Error('AI function empty response');
  return summary;
}
