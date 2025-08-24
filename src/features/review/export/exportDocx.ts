/* Export DOCX (single download, v35 field mapping preserved & undefined-safe). */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

let EXPORT_LOCK = false;

type AnyMap = Record<string, any>;

function ensureString(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try { return String(v); } catch { return ""; }
}

function deepCoalesce(obj: AnyMap): AnyMap {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepCoalesce);
  const out: AnyMap = {};
  for (const k of Object.keys(obj)) {
    const val = (obj as any)[k];
    if (val && typeof val === "object") out[k] = deepCoalesce(val);
    else out[k] = ensureString(val);
  }
  return out;
}

// Provide all legacy keys used in v35 to avoid "undefined" in the template
function buildTemplateData(d: AnyMap): AnyMap {
  const safe = deepCoalesce(d || {});

  const conclusion = ensureString(
    safe.conclusion ||
    safe.conclusions ||
    safe.conclusione ||
    safe.conclusioni ||
    safe.conclusionText
  );

  return {
    ...safe,
    // v35 aliases (do not remove)
    conclusion,
    conclusions: conclusion,
    conclusione: conclusion,
    conclusioni: conclusion,
  };
}

async function loadTemplateUrl(): Promise<string> {
  // Vite-friendly asset resolution (first try src path with glob, then public assets as fallback)
  const candidates: string[] = [];
  try {
    const glob: Record<string, string> = (import.meta as any).glob("/src/assets/templates/*", { eager: true, as: "url" });
    for (const k in glob) candidates.push(glob[k]);
  } catch {}

  candidates.push("/assets/Adverse.docx", "/assets/adverse.docx", "/assets/review_template.docx");

  for (const u of candidates) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) return u;
    } catch {}
  }
  // last resort
  return "/assets/Adverse.docx";
}

export async function exportToDocx(rawData: AnyMap, filename = "Review.docx") {
  if (EXPORT_LOCK) return;
  EXPORT_LOCK = true;
  try {
    const url = await loadTemplateUrl();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Template not found: ${url}`);
    const arrayBuffer = await res.arrayBuffer();

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const data = buildTemplateData(rawData);
    doc.render(data);

    const blob: Blob = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Single download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "Review.docx";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);

    return blob;
  } finally {
    setTimeout(() => { EXPORT_LOCK = false; }, 800);
  }
}
