
/**
 * AI summary service: v35 logic replicated (client-first, then serverless).
 */
type GenOpts = { model?: string; temperature?: number; maxTokens?: number };
const DEFAULT_MODEL = "openrouter/auto";

export async function generateSummaryAI(text: string, opts: GenOpts = {}): Promise<string> {
  const payloadText = (text || "").trim();
  if (!payloadText) return "";
  const model = opts.model || DEFAULT_MODEL;
  const localKey = typeof window !== "undefined" ? localStorage.getItem("OPENROUTER_API_KEY") : null;

  if (localKey) {
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
    if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}: ${await resp.text().catch(()=>resp.statusText)}`);
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  const res = await fetch("/.netlify/functions/ai-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: payloadText, model }),
  });
  if (!res.ok) throw new Error(`AI function HTTP ${res.status}: ${await res.text().catch(()=>res.statusText)}`);
  const json = await res.json();
  return json?.summary ?? "";
}
