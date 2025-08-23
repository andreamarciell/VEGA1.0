
// src/features/review/utils/docx.ts
// @ts-nocheck

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeXmlAttr(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Keep URLs when stripping HTML (TipTap)
export function htmlToPlainKeepUrls(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, label) => {
    const lbl = label.replace(/<[^>]+>/g, "").trim() || url;
    return `${lbl} (${url})`;
  });
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Turn visible URLs into real Word hyperlinks (r:id + Relationships)
export function postprocessMakeUrlsHyperlinks(zip: PizZip): PizZip {
  let xml = zip.file("word/document.xml")?.asText();
  let rels = zip.file("word/_rels/document.xml.rels")?.asText();
  if (!xml || !rels) return zip;

  const ids = Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map(m => Number(m[1]) || 0);
  let next = Math.max(1000, ...(ids.length ? ids : [0])) + 1;
  const nextRid = () => `rId${next++}`;

  xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paraBlock) => {
    let block = paraBlock;
    // join split runs around texts
    let prev;
    do {
      prev = block;
      block = block.replace(
        /<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr>[\s\S]*?<\/w:rPr>\s*)?<w:t\b[^>]*>/g,
        ""
      );
    } while (block !== prev);

    block = block.replace(/<w:r\b[\s\S]*?<w:t\b[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g, (runBlock, tText) => {
      const text = tText;
      const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g;
      let idx = 0;
      let out = "";
      let m;

      while ((m = urlRe.exec(text))) {
        const pre = text.slice(idx, m.index);
        const url = m[1];
        if (pre) out += `<w:r><w:t>${escapeXml(pre)}</w:t></w:r>`;

        const rId = nextRid();
        rels = rels.replace(
          /<\/Relationships>\s*$/,
          `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXmlAttr(url)}" TargetMode="External"/></Relationships>`
        );
        out += `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${escapeXml(url)}</w:t></w:r></w:hyperlink>`;

        idx = m.index + url.length;
      }
      const tail = text.slice(idx);
      if (tail) out += `<w:r><w:t>${escapeXml(tail)}</w:t></w:r>`;
      return out || runBlock;
    });

    return block;
  });

  zip.file("word/document.xml", xml);
  zip.file("word/_rels/document.xml.rels", rels);
  return zip;
}

// Main renderer used by Export: renders and returns a Blob
export async function renderDocxWithHyperlinks(
  templateBinary: ArrayBuffer | Uint8Array,
  data: any,
  imageOpts: any = {}
): Promise<Blob> {
  const zip = new PizZip(templateBinary as any);
  const imageModule = new ImageModule(imageOpts as any);

  // Convert HTML fields so URLs remain visible in the text
  const safeData = JSON.parse(JSON.stringify(data));
  const convert = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && /<a\b[^>]*href=/i.test(v)) {
        obj[k] = htmlToPlainKeepUrls(v);
      } else if (Array.isArray(v)) {
        obj[k] = v.map((item) =>
          typeof item === "string" ? htmlToPlainKeepUrls(item) : (typeof item === "object" ? (convert(item), item) : item)
        );
      } else if (typeof v === "object") {
        convert(v);
      }
    }
  };
  convert(safeData);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    replaceAll: true,
    modules: [imageModule],
  });
  doc.setData(safeData);
  doc.render();

  const outZip = postprocessMakeUrlsHyperlinks(doc.getZip());
  const blob = outZip.generate({ type: "blob" }) as Blob;
  return blob;
}

// ---------- Backwards-compatible API ----------
// Many parts of the app import { exportToDocx } from utils/docx.
// Provide a thin alias that preserves the expected name/signature.
export async function exportToDocx(
  templateBinary: ArrayBuffer | Uint8Array,
  data: any,
  imageOpts: any = {}
): Promise<Blob> {
  return renderDocxWithHyperlinks(templateBinary, data, imageOpts);
}
