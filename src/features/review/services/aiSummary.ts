
/**
 * AI Summary service — v35 logic + TipTap flow:
 * Textbox → AI → editor appears with the result.
 * Prefix enforced EXACTLY as v35: "Secondo l'articolo di <testata> datato <data> <corrispondenza> ..."
 * Key handling unchanged: localStorage.OPENROUTER_API_KEY (direct) else /api/v1/ai/summary.
 */

export type AiCtx = { author?: string; articleDate?: string; matchLabel?: string };

function formatDateIT(s?: string): string {
  if (!s) return '';
  // accept DD/MM/YYYY or YYYY-MM-DD; otherwise return as-is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('it-IT');
}

export async function generateSummaryAI(text: string, ctx: AiCtx = {}, model = "openrouter/auto"): Promise<string> {
  const payload = (text || "").trim();
  if (!payload) return "";

  const author = (ctx.author || "").trim() || "N/A";
  const datePart = formatDateIT((ctx.articleDate || "").trim()) || "N/A";
  const match = (ctx.matchLabel || "").trim();

  const prefix = `Secondo l'articolo di ${author} datato ${datePart}${match ? " " + match : ""} `;

  const localKey = typeof window !== "undefined" ? localStorage.getItem("OPENROUTER_API_KEY") : null;

  const body = {
    model,
    temperature: 0.2,
    max_tokens: 800,
    messages: [
      { role: "system", content: "Riassumi in italiano un articolo di cronaca: mantieni nomi, date, luoghi e presunti reati. Tono neutro, 6-8 frasi. Non inventare." },
      { role: "user", content: payload },
    ],
  };

  async function callDirect(key: string): Promise<string> {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof location !== "undefined" ? location.origin : "https://toppery.work",
        "X-Title": "Vega",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => r.statusText);
      throw new Error(`OpenRouter HTTP ${r.status}: ${t}`);
    }
    const j = await r.json();
    return j?.choices?.[0]?.message?.content ?? "";
  }

  async function callFn(): Promise<string> {
    const r = await fetch("/api/v1/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: payload, model }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => r.statusText);
      throw new Error(`AI function HTTP ${r.status}: ${t}`);
    }
    const j = await r.json();
    return j?.summary ?? "";
  }

  const content = localKey ? await callDirect(localKey) : await callFn();
  return `${prefix}${(content || "").trim()}`.trim();
}
