// src/features/review/utils/docx.ts
// STRICT: minimal touch. Keeps old API { exportToDocx } and ONLY improves hyperlink handling.
// @ts-nocheck

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";

function esc(text: string) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function escAttr(text: string) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Convert HTML to plain keeping visible URLs: <a href="url">label</a> -> "label (url)"
export function htmlToPlainKeepUrls(html: string): string {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, label) => {
    const lbl = String(label).replace(/<[^>]+>/g,"").trim() || url;
    return `${lbl} (${url})`;
  });
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Transform visible URLs into Word hyperlinks. Supports both "label (url)" and bare "https://..."
export function postprocessMakeUrlsHyperlinks(zip: PizZip): PizZip {
  let xml = zip.file("word/document.xml")?.asText();
  let rels = zip.file("word/_rels/document.xml.rels")?.asText();
  if (!xml || !rels) return zip;

  const ids = Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map(m => Number(m[1])||0);
  let next = Math.max(1000, ...(ids.length?ids:[0])) + 1;
  const nextRid = () => `rId${next++}`;

  const labelUrlRe = /([^\(\)\n\r]{1,200}?)\s*\((https?:\/\/[^\s<>"')\]]+)\)/g; // label (url)
  const urlOnlyRe = /(https?:\/\/[^\s<>"')\]]+)/g;

  xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    let block = para;
    // join split runs to avoid chopped URLs
    let prev;
    do {
      prev = block;
      block = block.replace(/<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr>[\s\S]*?<\/w:rPr>\s*)?<w:t\b[^>]*>/g,"");
    } while (block !== prev);

    block = block.replace(/<w:r\b[\s\S]*?<w:t\b[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g, (run, tText) => {
      const text = tText;
      let idx = 0;
      let out = "";
      // First, handle label (url) occurrences, left-to-right
      let m;
      while ((m = labelUrlRe.exec(text))) {
        const pre = text.slice(idx, m.index);
        const label = m[1].trim();
        const url = m[2];
        if (pre) out += `<w:r><w:t>${esc(pre)}</w:t></w:r>`;
        const rId = nextRid();
        rels = rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(url)}" TargetMode="External"/></Relationships>`);
        out += `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${esc(label||url)}</w:t></w:r></w:hyperlink>`;
        idx = m.index + m[0].length;
      }
      // Tail (may include bare URLs)
      const tail = text.slice(idx);
      if (tail) {
        let last = 0, part = "";
        let m2;
        while ((m2 = urlOnlyRe.exec(tail))) {
          const pre2 = tail.slice(last, m2.index);
          const url = m2[1];
          if (pre2) part += `<w:r><w:t>${esc(pre2)}</w:t></w:r>`;
          const rId = nextRid();
          rels = rels.replace(/<\/Relationships>\s*$/, `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(url)}" TargetMode="External"/></Relationships>`);
          part += `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${esc(url)}</w:t></w:r></w:hyperlink>`;
          last = m2.index + url.length;
        }
        const tailTail = tail.slice(last);
        if (tailTail) part += `<w:r><w:t>${esc(tailTail)}</w:t></w:r>`;
        out += part;
      }
      return out || run;
    });
    return block;
  });

  zip.file("word/document.xml", xml);
  zip.file("word/_rels/document.xml.rels", rels);
  return zip;
}

// Normalize template input to ArrayBuffer (supports ArrayBuffer/Uint8Array/Blob/File/Response/URL/dataURI and legacy object wrapper)
async function ensureArrayBuffer(input: any): Promise<ArrayBuffer> {
  if (input && typeof input === "object" && !("byteLength" in input) && !("arrayBuffer" in input)) {
    const { template, templateBinary, templateArrayBuffer, templateUrl, url } = input as any;
    const tpl = templateBinary ?? templateArrayBuffer ?? template ?? templateUrl ?? url;
    if (tpl) return ensureArrayBuffer(tpl);
  }
  if (input instanceof ArrayBuffer) return input;
  if (typeof Uint8Array !== "undefined" && input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  if (input && typeof input.arrayBuffer === "function") {
    return await input.arrayBuffer();
  }
  if (typeof input === "string") {
    if (/^data:/.test(input)) {
      const b64 = input.split(",")[1] || "";
      const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
      const bytes = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }
    if (typeof fetch === "function" && (/^https?:/.test(input) || input.startsWith("/") || input.startsWith("./") || input.startsWith("../"))) {
      const res = await fetch(input);
      return await res.arrayBuffer();
    }
  }
  throw new Error("Unsupported template input for PizZip(data). Expected ArrayBuffer/Uint8Array/Blob/File/URL/dataURI");
}

// Main renderer
export async function renderDocxWithHyperlinks(templateInput: any, data: any, imageOpts: any = {}): Promise<Blob> {
  const templateBinary = await ensureArrayBuffer(templateInput);
  const zip = new PizZip(templateBinary as any);
  const imageModule = new ImageModule(imageOpts as any);

  // pre-convert HTML strings
  const safe = JSON.parse(JSON.stringify(data));
  const walk = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        if (/<a\b[^>]*href=/i.test(v)) obj[k] = htmlToPlainKeepUrls(v);
      } else if (Array.isArray(v)) {
        obj[k] = v.map((it:any) => (typeof it === "string" ? htmlToPlainKeepUrls(it) : (typeof it === "object" ? (walk(it), it) : it)));
      } else if (typeof v === "object") {
        walk(v);
      }
    }
  };
  walk(safe);

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, replaceAll: true, modules: [imageModule] });
  doc.setData(safe);
  doc.render();

  const outZip = postprocessMakeUrlsHyperlinks(doc.getZip());
  return outZip.generate({ type: "blob" }) as Blob;
}

// Backward compatible API
export async function exportToDocx(a:any,b?:any,c?:any): Promise<Blob> {
  if (arguments.length===1 && a && typeof a==="object" && (a.template||a.templateBinary||a.templateArrayBuffer||a.templateUrl||a.url)) {
    const { template, templateBinary, templateArrayBuffer, templateUrl, url, data, imageOpts } = a as any;
    const tpl = templateBinary ?? templateArrayBuffer ?? template ?? templateUrl ?? url;
    return renderDocxWithHyperlinks(tpl, data, imageOpts);
  }
  return renderDocxWithHyperlinks(a,b,c);
}
