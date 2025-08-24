/* 
 * Robust DOCX exporter
 * - Fixes build error: no unterminated string literals or regexes
 * - Safe splitting of bullet strings by line breaks
 * - Tolerant to missing/optional fields
 * - Keeps backward compatibility with existing data shape
 * - Works with a .docx template located in /assets (configurable)
 */
// Do not add top-level imports for heavy libs to avoid build-time issues on platforms lacking them.
// We will dynamically import 'pizzip' and 'docxtemplater' inside the function.

export type AnyRecord = Record<string, any>;

/** Resolve a DOCX template URL in Vite (handles hashed asset URLs in /src/assets/templates) */
function resolveTemplateUrl(desired?: string): string {
  const guess = desired || '';
  try {
    // Eager import of all templates as URLs; Vite replaces with final asset URLs at build time.
    const templates = import.meta && (import.meta as any).glob
      ? (import.meta as any).glob('/src/assets/templates/*', { eager: true, as: 'url' }) as Record<string, string>
      : {};
    const entries = Object.entries(templates);
    if (entries.length) {
      // try exact filename match if provided
      if (guess) {
        const hit = entries.find(([k]) => k.toLowerCase().includes(guess.toLowerCase()));
        if (hit) return hit[1];
      }
      // otherwise prefer Adverse.docx, then any docx
      const adverse = entries.find(([k]) => /adverse\.docx$/i.test(k)) || entries.find(([k]) => /adverse/i.test(k));
      if (adverse) return adverse[1];
      // fallback to first .docx
      const first = entries.find(([k]) => /\.docx$/i.test(k)) || entries[0];
      if (first) return first[1];
    }
  } catch {}
  // fallback to public path
  return guess || '/assets/review_template.docx';
}

type ExportOptions = {
  /** Path to the .docx template under public/assets (or absolute URL). Defaults to '/assets/review_template.docx'. */
  templatePath?: string;
  /** File name used for the downloaded document. Defaults to 'review.docx'. */
  fileName?: string;
};

/** Utility: normalized array of strings from string/array/null input */
function toStringArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x ?? '')).filter(Boolean);
  return String(input)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Utility: shallow clone with default empty string for undefined/null scalars */
function withSafeScalars<T extends AnyRecord>(obj: T, defaults: AnyRecord = {}): T {
  const out: AnyRecord = { ...defaults };
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined || v === null) out[k] = '';
    else out[k] = v;
  }
  return out as T;
}

/** Fetch a template as ArrayBuffer with clear errors */
async function fetchTemplateArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Template fetch failed (${res.status} ${res.statusText}) at ${url}`);
  }
  return await res.arrayBuffer();
}

/** Trigger a browser download for a Blob */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build payload for the DOCX template from review data */
function buildTemplateData(review: AnyRecord): AnyRecord {
  const d = review?.adverseMedia ?? review ?? {};
  const cp = review?.customerProfile ?? review?.customer ?? {};

  // Scalars with safe defaults
  const customer = withSafeScalars({
    name: cp.name,
    surname: cp.surname,
    username: cp.username,
    email: cp.email,
    birthDate: cp.birthDate,
    nationality: cp.nationality,
    latestLoginNationality: cp.latestLoginNationality,
  });

  // Example arrays with shape normalization
  const documentsSent = Array.isArray(cp?.documentsSent)
    ? cp.documentsSent.map((x: AnyRecord) => ({
        document: String(x?.document ?? ''),
        status: String(x?.status ?? ''),
        info: String(x?.info ?? ''),
      }))
    : [];

  // Keep backward compat: text bullets AND richer HTML entries
  const reputationalIndicatorsBullets = toStringArray(d?.reputationalIndicators);
  const reputationalIndicatorsRich = Array.isArray(d?.reputationalIndicatorsRich)
    ? d.reputationalIndicatorsRich
    : [];

  // Other fields pass-through
  const others: AnyRecord = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === 'reputationalIndicators' || k === 'reputationalIndicatorsRich') continue;
    others[k] = v;
  }

  return {
    ...others,
    ...customer,
    documentsSent,
    reputationalIndicators: reputationalIndicatorsBullets.map((text) => ({ text })),
    reputationalIndicatorsRich, // if your template supports it
  };
}

/**
 * Export to DOCX using a .docx template (Docxtemplater + PizZip).
 * This function dynamically imports heavy libs to avoid build errors if they are not used elsewhere.
 */
export async function exportToDocx(reviewData: AnyRecord, options: ExportOptions = {}) {
  const templatePath = resolveTemplateUrl(options.templatePath || 'Adverse.docx');
  const fileName = options.fileName || 'review.docx';

  const payload = buildTemplateData(reviewData);

  try {
    const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
      // @ts-ignore - dynamic import to prevent bundling issues when not used
      import('pizzip'),
      // @ts-ignore - dynamic import to prevent bundling issues when not used
      import('docxtemplater'),
    ]);

    const arrayBuffer = await fetchTemplateArrayBuffer(templatePath);
    const zip = new PizZip(arrayBuffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.setData(payload);
    doc.render();

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    });

    downloadBlob(out, fileName);
  } catch (err: any) {
    // Provide a clear error and a JSON fallback to not block the user
    console.error('DOCX export failed:', err);
    const message = String(err?.message || err);
    // Fallback: offer the payload as JSON so the user can inspect data
    const blob = new Blob([JSON.stringify({ error: message, payload }, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, fileName.replace(/\.docx$/i, '.json'));
  }
}

export default exportToDocx;
