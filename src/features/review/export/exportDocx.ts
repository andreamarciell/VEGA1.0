// Robust DOCX export using html-to-docx (browser ESM).
// This avoids esbuild pre-bundling issues and works purely client-side.
type AnyState = any;

// Lazy-load to ensure we pick the browser ESM build at runtime.
async function getHtmlToDocx() {
  // Prefer the package root default (browser ESM). If a bundler picks the wrong build,
  // we fall back to the explicit ESM path.
  try {
    const mod = await import('html-to-docx');
    return (mod as any).default || (mod as any);
  } catch (_) {
    const mod = await import('html-to-docx/dist/html-to-docx.esm.js');
    return (mod as any).default || (mod as any);
  }
}

/**
 * Given an HTML string, returns a Blob of .docx.
 */
export async function exportDocxFromHtml(html: string): Promise<Blob> {
  const HTMLtoDOCX = await getHtmlToDocx();
  if (!HTMLtoDOCX || typeof HTMLtoDOCX !== "function") {
    throw new Error("html-to-docx module did not load correctly");
  }
  const buffer = await HTMLtoDOCX(html, null, {
    // keep tables readable, prevent row split across pages
    table: { row: { cantSplit: true } },
    // preserve anchor tags (<a href="...">)
    // (library handles them; we don't need a custom post-process step)
    // default font & margins for better cross-compat
    margins: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5in
  });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Compose a minimal, resilient HTML from the current review state.
 * We keep this tolerant to unknown shapes to avoid runtime crashes.
 */
export function composeHtml(state: AnyState): string {
  const type = state?.reviewType || 'adverse';
  const title = type === 'adverse' ? 'Adverse Media Check' : 'Customer Review';
  const adverse = state?.adverseData || {};
  const full = state?.fullData || {};

  const section = (label: string, content?: any) => {
    const html = toHtml(content);
    if (!html) return '';
    return `<h2>${escapeHtml(label)}</h2>${html}`;
  };

  // Build body based on the selected review type. We only render what we have.
  let body = '';
  if (type === 'adverse') {
    body = [
      section('Indicatori Reputazionali', adverse.reputationalIndicators),
      section('Conclusione', adverse.conclusion),
      section('Allegati', arrayToList(adverse.attachments)),
    ].filter(Boolean).join('\n');
  } else {
    body = [
      section('Motivo della Review', full.reasonForReview),
      section('Review eseguita da', full.reviewPerformedBy),
      section('Data Review', full.reviewDate),
      section('Profilo Cliente', full.customerProfile),
      section('Metodi di Pagamento', full.paymentMethods),
      section('Metodi di Pagamento di Terzi', full.thirdPartyPaymentMethods),
      section('Attività Aggiuntive', full.additionalActivities),
      section('Fonte dei Fondi', full.sourceOfFunds),
      section('Indicatori Reputazionali', full.reputationalIndicators),
      section('Conclusione & Livello di Rischio', full.conclusionAndRiskLevel),
      section('Azioni di Follow-up', full.followUpActions),
      section('Background', full.backgroundInformation),
      section('Allegati', arrayToList(full.attachments)),
    ].filter(Boolean).join('\n');
  }

  // Wrap in a small base HTML with simple styling + links visibly underlined.
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.4; }
  h1 { font-size: 20pt; margin: 0 0 10px; }
  h2 { font-size: 14pt; margin: 12px 0 6px; }
  a { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 6px; vertical-align: top; }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body || '<p>(nessun contenuto)</p>'}
</body></html>`;
}

/**
 * Main entry used by the UI.
 */
export async function exportToDocx(state: AnyState): Promise<Blob> {
  const html = composeHtml(state);
  return exportDocxFromHtml(html);
}

// ---------- helpers ----------

function toHtml(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    // allow pre-sanitized rich HTML strings (from editors)
    if (looksLikeHtml(value)) return value;
    return `<p>${escapeHtml(value)}</p>`;
  }
  if (Array.isArray(value)) {
    return arrayToList(value);
  }
  if (typeof value === 'object') {
    // generic key-value rendering
    const rows = Object.entries(value).map(([k, v]) => {
      const cell = typeof v === 'string' && looksLikeHtml(v) ? v : escapeHtml(String(v ?? ''));
      return `<tr><th>${escapeHtml(k)}</th><td>${cell}</td></tr>`;
    }).join('');
    return `<table><tbody>${rows}</tbody></table>`;
  }
  return `<p>${escapeHtml(String(value))}</p>`;
}

function arrayToList(arr: any[]): string {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const items = arr.map((it) => {
    if (typeof it === 'string') {
      return `<li>${looksLikeHtml(it) ? it : escapeHtml(it)}</li>`;
    }
    if (typeof it === 'object' && it) {
      const label = it.label ?? it.name ?? it.title ?? '';
      const url = it.url ?? it.link ?? it.href ?? '';
      if (url) {
        // clickable hyperlink item
        const safeLabel = escapeHtml(String(label || url));
        const safeUrl = escapeAttribute(String(url));
        return `<li><a href="${safeUrl}">${safeLabel}</a></li>`;
      }
      return `<li>${escapeHtml(JSON.stringify(it))}</li>`;
    }
    return `<li>${escapeHtml(String(it))}</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
}

function looksLikeHtml(s: string): boolean {
  return /<\w+[\s\S]*?>[\s\S]*<\/\w+>/.test(s) || /<a\s+[^>]*href=/i.test(s);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
}

function escapeAttribute(s: string): string {
  // allow URL-safe characters, escape the rest.
  return escapeHtml(s);
}
