
/**
 * AI Summary service — v35 logic restored (textbox → AI → then editor).
 * Prefix is enforced client-side to guarantee:
 * "secondo l'articolo di <testata> datato <data> <corrispondenza> ..."
 *
 * Key source order (v35-compatible but without hardcoding):
 *  1) localStorage.OPENROUTER_API_KEY  → direct OpenRouter call
 *  2) Netlify function '/.netlify/functions/ai-summary'  → uses OPENROUTER_API_KEY on server
 */
export type AiCtx = { author?: string; articleDate?: string; matchLabel?: string };

export async function generateSummaryAI(text: string, ctx: AiCtx = {}, model = "openrouter/auto"): Promise<string> {
  const payload = (text || "").trim();
  if (!payload) return "";

  const author = (ctx.author || "").trim() || "N/A";
  const articleDate = (ctx.articleDate || "").trim() || "N/A";
  const matchLabel = (ctx.matchLabel || "").trim() || "";

  const prefix = `secondo l'articolo di ${author} datato ${articleDate}${matchLabel ? " " + matchLabel : ""} `;

  const localKey = typeof window !== "undefined" ? localStorage.getItem("OPENROUTER_API_KEY") : null;

  let body: any = {
    model,
    temperature: 0.2,
    max_tokens: 800,
    messages: [
      { role: "system", content: "Riassumi in italiano un articolo di cronaca usando tono neutro. Mantieni nomi, date, luoghi e presunti reati. Max 6-8 frasi. Non inventare." },
      { role: "user", content: payload },
    ],
  };

  if (localKey) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof location !== "undefined" ? location.origin : "https://toppery.work",
        "X-Title": "Toppery AML",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => r.statusText);
      throw new Error(`OpenRouter HTTP ${r.status}: ${t}`);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return `${prefix}${(content || "").trim()}`.trim();
  }

  // serverless
  const res = await fetch("/.netlify/functions/ai-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: payload, model }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`AI function HTTP ${res.status}: ${t}`);
  }
  const j = await res.json();
  const content = j?.summary ?? "";
  return `${prefix}${(content || "").trim()}`.trim();
}
