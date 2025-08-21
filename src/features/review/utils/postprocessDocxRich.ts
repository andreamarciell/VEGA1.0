// features/features/review/utils/postprocessDocxRich.ts
import PizZip from 'pizzip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/** Minimal token describing styled chunks extracted from simple HTML */
type HtmlToken =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean; underline?: boolean }
  | { kind: 'br' }
  | { kind: 'link'; text: string; url: string; bold?: boolean; italic?: boolean; underline?: boolean };

function decodeEntities(s: string): string {
  if (!s) return '';
  const map: Record<string, string> = {
    '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&amp;quot;': '"', '&amp;apos;': "'", '&amp;amp;': '&', '&amp;lt;': '<', '&amp;gt;': '>'
  };
  return s.replace(/&(amp;)?(quot|apos|amp|lt|gt);/g, m => (map[m] ?? m));
}

function htmlToTokens(html: string): HtmlToken[] {
  const root = document.createElement('div');
  root.innerHTML = html;
  const out: HtmlToken[] = [];

  const walk = (node: Node, b=false, i=false, u=false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = (node.textContent || '').replace(/\s+/g, ' ');
      if (raw) out.push({ kind: 'text', text: raw, bold: b, italic: i, underline: u });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    let nb=b, ni=i, nu=u;
    if (tag==='b' || tag==='strong') nb=true;
    if (tag==='i' || tag==='em') ni=true;
    if (tag==='u') nu=true;
    if (tag==='br') { out.push({ kind:'br' }); return; }
    if (tag==='a') {
      const url = (node as HTMLAnchorElement).getAttribute('href') || '';
      const label = (node.textContent || '').replace(/\s+/g, ' ');
      out.push({ kind: 'link', text: label, url, bold: nb, italic: ni, underline: true });
      return;
    }
    Array.from(node.childNodes).forEach(n => walk(n, nb, ni, nu));
  };

  Array.from(root.childNodes).forEach(n => walk(n));
  return out;
}

function createRun(doc: XMLDocument, text: string, opts?: {bold?:boolean; italic?:boolean; underline?:boolean}) {
  const r = doc.createElementNS(W_NS, 'w:r');
  if (opts && (opts.bold || opts.italic || opts.underline)) {
    const rPr = doc.createElementNS(W_NS, 'w:rPr');
    if (opts.bold) rPr.appendChild(doc.createElementNS(W_NS, 'w:b'));
    if (opts.italic) rPr.appendChild(doc.createElementNS(W_NS, 'w:i'));
    if (opts.underline) {
      const u = doc.createElementNS(W_NS, 'w:u');
      u.setAttribute('w:val', 'single');
      rPr.appendChild(u);
    }
    r.appendChild(rPr);
  }
  const t = doc.createElementNS(W_NS, 'w:t');
  if (/^\s|\s$/.test(text)) t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

export async function postprocessDocxRich(input: Blob): Promise<Blob> {
  // unzip
  const buf = await input.arrayBuffer();
  const zip = new PizZip(buf);
  const docPath = 'word/document.xml';
  const relsPath = 'word/_rels/document.xml.rels';
  const docXml = zip.file(docPath)?.asText();
  const relsXml = zip.file(relsPath)?.asText();
  if (!docXml || !relsXml) return input;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const rels = parser.parseFromString(relsXml, 'application/xml');

  // decode leftover entities globally
  Array.from(doc.getElementsByTagNameNS(W_NS, 't')).forEach(t => {
    const raw = t.textContent || '';
    const dec = decodeEntities(raw);
    if (dec !== raw) t.textContent = dec;
  });

  // find max rel id
  let maxNum = 1;
  Array.from(rels.getElementsByTagName('Relationship')).forEach(r => {
    const id = r.getAttribute('Id') || '';
    const m = id.match(/\d+/); if (m) maxNum = Math.max(maxNum, parseInt(m[0], 10));
  });
  const nextRel = () => 'rId' + (++maxNum);

  const pNodes = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
  for (const p of pNodes) {
    const runs = Array.from(p.getElementsByTagNameNS(W_NS, 'r'));
    for (let ri = 0; ri < runs.length; ri++) {
      const t = runs[ri].getElementsByTagNameNS(W_NS, 't')[0];
      if (!t) continue;
      const text = t.textContent || '';
      const m = text.match(/^\[\[RUN:(\d+)\]\]$/);
      if (!m) continue;
      const idx = m[1];

      // search subsequent runs (same paragraph or later in p) for DATA
      let dataRun: Element | null = null;
      let htmlB64 = '';
      for (let rj = ri+1; rj < runs.length; rj++) {
        const tj = runs[rj].getElementsByTagNameNS(W_NS, 't')[0];
        if (!tj) continue;
        const mm = tj.textContent?.match(new RegExp(`^\\[\\[DATA:${idx}:(.+)\\]\\]$`));
        if (mm) { dataRun = runs[rj]; htmlB64 = mm[1]; break; }
      }
      if (!htmlB64) {
        // not found: remove the marker and continue
        t.textContent = '';
        continue;
      }
      // decode and tokenise HTML
      let html = '';
      try { html = decodeURIComponent(escape(atob(htmlB64))); } catch { try { html = atob(htmlB64); } catch { html = ''; } }
      html = decodeEntities(html);
      const tokens = htmlToTokens(html);

      const insertBefore = runs[ri];
      // replace RUN with tokens
      tokens.forEach(tok => {
        if (tok.kind === 'br') {
          const r = doc.createElementNS(W_NS, 'w:r');
          r.appendChild(doc.createElementNS(W_NS, 'w:br'));
          p.insertBefore(r, insertBefore);
        } else if (tok.kind === 'link') {
          const rId = nextRel();
          const rel = rels.createElement('Relationship');
          rel.setAttribute('Id', rId);
          rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink');
          rel.setAttribute('Target', tok.url);
          rel.setAttribute('TargetMode', 'External');
          rels.documentElement.appendChild(rel);

          const hl = doc.createElementNS(W_NS, 'w:hyperlink');
          hl.setAttributeNS(R_NS, 'r:id', rId);
          // don't force Hyperlink style to avoid font changes; just underline
          const rr = createRun(doc, tok.text || tok.url, { bold: tok.bold, italic: tok.italic, underline: true });
          hl.appendChild(rr);
          p.insertBefore(hl, insertBefore);
        } else {
          p.insertBefore(createRun(doc, tok.text, { bold: tok.bold, italic: tok.italic, underline: tok.underline }), insertBefore);
        }
      });
      // remove the marker run and the DATA run
      p.removeChild(insertBefore);
      if (dataRun && dataRun.parentNode === p) p.removeChild(dataRun);
    }
  }

  // write back
  zip.file(docPath, serializer.serializeToString(doc));
  zip.file(relsPath, serializer.serializeToString(rels));
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
