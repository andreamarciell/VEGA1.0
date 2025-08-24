/**
 * AI Summary service — v35 behavior restored:
 *  - Textbox → AI → ONLY THEN editor shows content.
 *  - The summary string ALWAYS starts with:
 *      "secondo l'articolo di <testata> datato <data> <corrispondenza> "
 *    (prefix is composed client-side so it is guaranteed even if the model omits it).
 *
 * Sources for the API key (same priority of v35 but without hardcoding):
 *  1) localStorage.OPENROUTER_API_KEY  → direct call to OpenRouter
 *  2) Netlify function '/.netlify/functions/ai-summary' → uses server env OPENROUTER_API_KEY
 */

export type AiCtx = {
  author?: string;          // testata
  articleDate?: string;     // data dell'articolo (DD/MM/YYYY), o data review se preferisci
  matchLabel?: string;      // es. "corrispondenza definitiva via nome + età + area + foto"
};

export function setAiContext(ctx: AiCtx) {
  if (typeof window !== "undefined") {
    (window as any).__TOPPERY_AI_CTX__ = ctx;
  }
}

function composePrefix(ctx?: AiCtx): string {
  const g: AiCtx = (typeof window !== "undefined" && (window as any).__TOPPERY_AI_CTX__) || {};
  const author = (ctx?.author ?? g.author ?? "").trim() || "N/A";
  const date = (ctx?.articleDate ?? g.articleDate ?? "").trim() || "N/A";
  const match = (ctx?.matchLabel ?? g.matchLabel ?? "").trim();
  // EXACT v35-style start (lowercase "secondo")
  return `secondo l'articolo di ${author} datato ${date}${match ? " " + match : ""} `;
}

type GenOpts = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  ctx?: AiCtx;
};

const DEFAULT_MODEL = "openrouter/auto";

export async function generateSummaryAI(text: string, opts: GenOpts = {}): Promise<string> {
  const payloadText = (text || "").trim();
  if (!payloadText) return "";

  const model = opts.model || DEFAULT_MODEL;
  const localKey = typeof window !== "undefined" ? localStorage.getItem("OPENROUTER_API_KEY") : null;

  let summary = "";
  if (localKey) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof location !== "undefined" ? location.origin : "https://toppery.work",
        "X-Title": "Toppery AML",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 800,
        messages: [
          { role: "system", content: "Riassumi in italiano un articolo di cronaca: mantieni nomi, date, luoghi e presunti reati. Tono neutro, max 6-8 frasi. Non inventare." },
          { role: "user", content: payloadText },
        ],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => resp.statusText);
      throw new Error(`OpenRouter HTTP ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    summary = data?.choices?.[0]?.message?.content ?? "";
  } else {
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
    summary = json?.summary ?? "";
  }

  // Compose exact prefix regardless of model output
  const pref = composePrefix(opts.ctx);
  const clean = (summary || "").trim().replace(/^\s*[-–:]\s*/, "");
  return `${pref}${clean}`.trim();
}
