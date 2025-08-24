
/**
 * AI summarization via OpenRouter (client-side).
 * Reads API key from VITE_OPENROUTER_API_KEY or localStorage('OPENROUTER_API_KEY').
 * Falls back to a deterministic local summarizer if key is missing.
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
  const el = globalThis.document?.createElement?.('div');
  if (el) {
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateSummaryAI(inputHtml: string, opts: SummarizeOptions = {}): Promise<string> {
  const text = stripHtml(inputHtml);
  const lang = opts.language || 'it';
  const urlHint = opts.urlHint || '';
  const key =
    opts.apiKey ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_OPENROUTER_API_KEY : undefined) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('OPENROUTER_API_KEY') || undefined : undefined);

  // If no API key, raise an explicit error to avoid silent copy/paste behavior
  if (!key) {
    throw new Error('Manca la chiave OpenRouter: imposta VITE_OPENROUTER_API_KEY oppure localStorage.OPENROUTER_API_KEY');
  }

  const body = {
    model: opts.model || 'openai/gpt-4o-mini',
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2,
    max_tokens: opts.maxTokens || 400,
    messages: [
      {
        role: 'system',
        content:
          lang === 'it'
            ? 'Sei un assistente AML. Riassumi il testo in modo neutrale e professionale, in italiano, mantenendo nomi propri e fatti chiave. Output SOLO il riassunto, senza preamboli.'
            : 'You are an AML assistant. Summarize the text in a neutral, professional tone, preserving names and key facts. Output ONLY the summary text.',
      },
      {
        role: 'user',
        content:
          (urlHint ? `Fonte: ${urlHint}\n` : '') +
          (lang === 'it' ? 'Testo da riassumere:' : 'Text to summarize:') +
          '\n\n' +
          text,
      },
    ],
  };

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': typeof location !== 'undefined' ? location.origin : '',
      'X-Title': 'Toppery AML - Review Summarizer',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI summary HTTP ${resp.status}: ${t.slice(0, 500)}`);
  }
  const data = await resp.json();
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.delta?.content ??
    '';
  if (!content) {
    throw new Error('AI summary empty response');
  }
  return String(content).trim();
}
