/* Robust DOCX exporter: no deprecated setData, safe defaults, Blob output */
export type AnyRecord = Record<string, any>;

async function loadTemplateUrl(preferred?: string): Promise<string> {
  // Try Vite import map first (works in dev/build)
  try {
    const map = (import.meta as any).glob('/src/assets/templates/*', { eager: true, as: 'url' }) as Record<string, string>;
    const entries = Object.entries(map);
    if (entries.length) {
      if (preferred) {
        const hit = entries.find(([k]) => k.toLowerCase().includes(preferred.toLowerCase()));
        if (hit) return hit[1];
      }
      // Prefer files containing "adverse" or any .docx
      const adv = entries.find(([k]) => /adverse/i.test(k) && /\.docx$/i.test(k)) || entries.find(([k]) => /\.docx$/i.test(k));
      if (adv) return adv[1];
    }
  } catch {}
  // Fall back to /assets (after Vite build)
  const fallbacks = [
    '/assets/Adverse.docx',
    '/assets/adverse.docx',
    '/assets/review_template.docx',
  ];
  for (const url of fallbacks) {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (head.ok) return url;
    } catch {}
  }
  throw new Error('Template .docx non trovato. Metti Adverse.docx in src/assets/templates/');
}

function toArrayBuffer(buf: ArrayBuffer | Uint8Array) {
  return buf instanceof ArrayBuffer ? buf : buf.buffer;
}

function safeStr(x: any): string {
  if (x === null || x === undefined) return '';
  return String(x);
}

function normalizeData(raw: AnyRecord): AnyRecord {
  // Defensive copy + defaults to prevent "undefined" in docx
  const d = raw ?? {};
  const adverse = d.adverseData ?? {};
  const cp = d.customerProfile ?? {};
  const conclusion = adverse.conclusion ?? d.conclusion ?? '';

  // Reputational indicators (plain bullets)
  const bullets: string[] = [];
  if (Array.isArray(adverse.reputationalIndicatorsItems)) {
    for (const it of adverse.reputationalIndicatorsItems) {
      const t = (it?.summaryHtml || it?.summary || '').toString().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (t) bullets.push('• ' + t);
    }
  } else if (typeof adverse.reputationalIndicators === 'string') {
    const parts = adverse.reputationalIndicators.replace(/\r\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
    for (const p of parts) bullets.push('• ' + p);
  }

  const out: AnyRecord = {
    // map many synonyms to be safe with older templates
    conclusion: safeStr(conclusion),
    conclusions: safeStr(conclusion),
    conclusione: safeStr(conclusion),
    conclusionText: safeStr(conclusion),

    // keep some commonly used fields
    author: safeStr(adverse.articleAuthor || ''),
    sourceUrl: safeStr(adverse.articleUrl || ''),
    matchType: safeStr(adverse.matchType || ''),
    customerName: safeStr(cp?.name || d?.agentName || ''),

    reputationalIndicators: bullets, // array for loops
  };

  // also spread original objects but without undefined
  function flatten(src: any, prefix: string) {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      const key = `${prefix}${k}`;
      if (v === undefined || v === null) {
        out[key] = '';
      } else if (typeof v === 'object') {
        // ignore deep nesting to keep template simple
      } else {
        out[key] = v;
      }
    }
  }
  flatten(adverse, 'adverse_');
  flatten(cp, 'cp_');

  return out;
}

export async function exportToDocx(state: AnyRecord, opts: { fileName?: string; templateHint?: string } = {}): Promise<Blob> {
  // 1) load template
  const templateUrl = await loadTemplateUrl(opts.templateHint);
  const ab = await fetch(templateUrl).then(r => {
    if (!r.ok) throw new Error('Impossibile caricare il template DOCX');
    return r.arrayBuffer();
  });

  // 2) lazy-import libs (vite-friendly)
  const PizZip = (await import('pizzip')).default;
  const Docxtemplater = (await import('docxtemplater')).default;

  // 3) prepare doc
  const zip = new PizZip(ab);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // 4) set data and render (new API: doc.render(data))
  const data = normalizeData(state);
  doc.render(data);

  // 5) output as Blob (always a Blob to avoid createObjectURL errors)
  const blob: Blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // 6) trigger download
  const name = opts.fileName || 'review.docx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);

  return blob;
}
