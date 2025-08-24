/**
 * AI summary service.
 * v35 logic replicated:
 * - If localStorage.OPENROUTER_API_KEY is set, call OpenRouter directly from the client (like your old flow).
 * - Otherwise use the Netlify Function '/.netlify/functions/ai-summary' which reads OPENROUTER_API_KEY server-side.
 */
type GenOpts = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const DEFAULT_MODEL = "openrouter/auto";

export async function generateSummaryAI(text: string, opts: GenOpts = {}): Promise<string> {
  const payloadText = (text || "").trim();
  if (!payloadText) return "";

  const model = opts.model || DEFAULT_MODEL;
  const localKey = typeof window !== "undefined" ? localStorage.getItem("OPENROUTER_API_KEY") : null;

  if (localKey) {
    // Direct client call (as in v35 when the key was available in the client)
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin,
        "X-Title": "Toppery AML",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 800,
        messages: [
          { role: "system", content: "Riassumi il testo seguente in italiano, tono neutro, mantieni nomi/date/reati, max 6-8 frasi. Solo testo." },
          { role: "user", content: payloadText },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      throw new Error(`OpenRouter HTTP ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  // Serverless (uses Netlify env OPENROUTER_API_KEY)
  const res = await fetch("/.netlify/functions/ai-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: payloadText, model }),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText);
    throw new Error(`AI function HTTP ${res.status}: ${raw}`);
  }
  const json = await res.json();
  const summary = json?.summary ?? "";
  return summary;
}
