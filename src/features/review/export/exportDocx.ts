
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

type AnyMap = Record<string, any>;

let EXPORT_LOCK = false;

const toStr = (v: any): string => (v === undefined || v === null ? "" : String(v));

const deepStr = (x: any): any => {
  if (Array.isArray(x)) return x.map(deepStr);
  if (x && typeof x === "object") {
    const o: AnyMap = {};
    Object.keys(x).forEach(k => (o[k] = deepStr((x as any)[k])));
    return o;
  }
  return toStr(x);
};

// keep v35 aliases for conclusions to avoid 'undefined' in template
function mapV35(data: AnyMap): AnyMap {
  const safe = deepStr(data || {});
  const conclusion =
    safe.conclusion ||
    safe.conclusions ||
    safe.conclusione ||
    safe.conclusioni ||
    safe.conclusionText ||
    "";
  return {
    ...safe,
    conclusion,
    conclusions: conclusion,
    conclusione: conclusion,
    conclusioni: conclusion,
  };
}

async function resolveTemplateUrl(): Promise<string> {
  const cands: string[] = [];
  try {
    const g: Record<string, string> = (import.meta as any).glob("/src/assets/templates/*", {
      eager: true,
      as: "url",
    });
    for (const k in g) cands.push(g[k]);
  } catch {}
  cands.push("/assets/Adverse.docx", "/assets/adverse.docx", "/assets/review_template.docx");
  for (const u of cands) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) return u;
    } catch {}
  }
  return "/assets/Adverse.docx";
}

export async function exportToDocx(raw: AnyMap, filename = "Review.docx") {
  if (EXPORT_LOCK) return;
  EXPORT_LOCK = true;
  try {
    const url = await resolveTemplateUrl();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Template not found: ${url}`);
    const ab = await resp.arrayBuffer();

    const zip = new PizZip(ab);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const data = mapV35(raw);
    doc.render(data);

    const blob: Blob = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // single file download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);

    return blob;
  } finally {
    setTimeout(() => (EXPORT_LOCK = false), 500);
  }
}
