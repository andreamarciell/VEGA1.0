
/* utils/docx.ts
 * Robust post-processing to convert any plain URLs rendered by Docxtemplater into real Word hyperlinks,
 * without using docxtemplater-link-module (which is incompatible with v3).
 * It also joins split runs so URLs spanning multiple <w:t> nodes are handled.
 */
// @ts-nocheck
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { ImageModuleOptions } from "docxtemplater-image-module-free";
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

/**
 * Convert HTML produced by TipTap to plain text while keeping URLs visible.
 * - <a href="url">label</a> => "label (url)"  (so the URL survives docxtemplater v3 text rendering)
 * - <br>, <p> => new lines
 * - strip other tags
 */
export function htmlToPlainKeepUrls(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, label) => {
    const lbl = label.replace(/<[^>]+>/g, "").trim();
    return `${lbl} (${url})`;
  });
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, ""); // drop other tags
  // collapse multiple newlines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * After docxtemplater render, transform raw URLs in document.xml into real Word hyperlinks,
 * and add the needed relationships in word/_rels/document.xml.rels.
 */
export function postprocessMakeUrlsHyperlinks(zip: PizZip): PizZip {
  let xml = zip.file("word/document.xml")?.asText();
  let rels = zip.file("word/_rels/document.xml.rels")?.asText();
  if (!xml || !rels) return zip;

  // helper to get fresh rId
  const ids = Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map(m => Number(m[1]) || 0);
  let next = Math.max(1000, ...(ids.length ? ids : [0])) + 1;
  const nextRid = () => `rId${next++}`;

  // work paragraph by paragraph to avoid corrupting structure
  xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paraBlock) => {
    let block = paraBlock;

    // normalize contiguous runs: join ...</w:t></w:r><w:r><w:t>... so URLs don't get split
    // we do it repeatedly until stable
    let prev;
    do {
      prev = block;
      block = block.replace(
        /<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr>[\s\S]*?<\/w:rPr>\s*)?<w:t\b[^>]*>/g,
        ""
      );
    } while (block !== prev);

    // find a single combined <w:t> text (there may be multiple, we rewrite each in sequence)
    block = block.replace(/<w:r\b[\s\S]*?<w:t\b[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g, (runBlock, tText) => {
      const text = tText;
      const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g;
      let idx = 0;
      let out = "";
      let m: RegExpExecArray | null;

      while ((m = urlRe.exec(text))) {
        const pre = text.slice(idx, m.index);
        const url = m[1];
        if (pre) {
          out += `<w:r><w:t>${escapeXml(pre)}</w:t></w:r>`;
        }
        const rId = nextRid();
        // append relationship
        rels = rels.replace(
          /<\/Relationships>\s*$/,
          `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXmlAttr(
            url
          )}" TargetMode="External"/></Relationships>`
        );
        // hyperlink run
        out += `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${escapeXml(
          url
        )}</w:t></w:r></w:hyperlink>`;
        idx = m.index + url.length;
      }
      const tail = text.slice(idx);
      if (tail) {
        out += `<w:r><w:t>${escapeXml(tail)}</w:t></w:r>`;
      }
      return out || runBlock;
    });

    return block;
  });

  zip.file("word/document.xml", xml);
  zip.file("word/_rels/document.xml.rels", rels);
  return zip;
}

/**
 * Create and render a Docxtemplater instance with ImageModule, then postprocess for URLs.
 * - templateBinary: ArrayBuffer of the .docx template
 * - data: object used in doc.setData
 * - imageOpts: options for ImageModule (getImage, getSize, etc.)
 * Returns a Blob ready for download.
 */
export async function renderDocxWithHyperlinks(
  templateBinary: ArrayBuffer | Uint8Array,
  data: any,
  imageOpts: Partial<ImageModuleOptions> = {}
): Promise<Blob> {
  const zip = new PizZip(templateBinary as any);
  const imageModule = new ImageModule(imageOpts as any);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    replaceAll: true,
    modules: [imageModule],
  });

  // Mutate data: for any field ending with "Rich" that contains HTML from TipTap, convert to plain text, preserving URLs
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

  doc.setData(safeData);
  doc.render();

  // Postprocess: transform any visible URLs in the document into real Word hyperlinks
  const outZip = postprocessMakeUrlsHyperlinks(doc.getZip());
  const blob = outZip.generate({ type: "blob" }) as Blob;
  return blob;
}
