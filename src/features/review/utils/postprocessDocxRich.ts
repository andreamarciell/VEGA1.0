
// postprocessDocxRich.ts
import PizZip from 'pizzip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

type HtmlToken = {
  type: 'text' | 'br' | 'link';
  text?: string;
  url?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function decodeHTMLEntities(input: string): string {
  // decode a few common entities &quot; &apos; &amp; &lt; &gt; (double-escaped too)
  const map: Record<string, string> = {
    '&amp;quot;': '"',
    '&amp;apos;': "'",
    '&amp;amp;': '&',
    '&amp;lt;': '<',
    '&amp;gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&'
  };
  return input.replace(/&(amp;)?(quot|apos|lt|gt|amp);/g, (m) => map[m] ?? m);
}

function htmlToTokens(html: string): HtmlToken[] {
  // Build a DOM fragment and traverse it to produce tokens with simple formatting
  const container = document.createElement('div');
  container.innerHTML = html;

  const tokens: HtmlToken[] = [];

  function walk(node: Node, ctx: {b:boolean;i:boolean;u:boolean}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').replace(/\s+/g, ' ');
      if (t) tokens.push({ type: 'text', text: t, bold: ctx.b, italic: ctx.i, underline: ctx.u });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...ctx };
    if (tag === 'b' || tag === 'strong') next.b = true;
    if (tag === 'i' || tag === 'em') next.i = true;
    if (tag === 'u') next.u = true;
    if (tag === 'br') { tokens.push({ type:'br' }); return; }
    if (tag === 'a') {
      const url = (node as HTMLAnchorElement).getAttribute('href') || '';
      const childTokens: HtmlToken[] = [];
      (node.childNodes ? Array.from(node.childNodes) : []).forEach((c) => {
        if (c.nodeType === Node.TEXT_NODE) {
          const t = (c.textContent || '').replace(/\s+/g, ' ');
          if (t) childTokens.push({ type: 'text', text: t, bold: next.b, italic: next.i, underline: true });
        } else {
          const before = tokens.length;
          walk(c, { ...next, u: true });
          const added = tokens.slice(before);
          childTokens.push(...added);
          tokens.splice(before, added.length); // move into childTokens
        }
      });
      const label = childTokens.map(t => t.text).join('');
      tokens.push({ type: 'link', url, text: label, bold: next.b, italic: next.i, underline: true });
      return;
    }
    (node.childNodes ? Array.from(node.childNodes) : []).forEach((c) => walk(c, next));
  }

  (container.childNodes ? Array.from(container.childNodes) : []).forEach((n) => walk(n, {b:false,i:false,u:false}));
  return tokens;
}

function createRun(doc: XMLDocument, text: string, opts?: {bold?:boolean; italic?:boolean; underline?:boolean}) {
  const r = doc.createElementNS(W_NS, 'w:r');
  const rPr = doc.createElementNS(W_NS, 'w:rPr');
  if (opts?.bold) rPr.appendChild(doc.createElementNS(W_NS, 'w:b'));
  if (opts?.italic) rPr.appendChild(doc.createElementNS(W_NS, 'w:i'));
  if (opts?.underline) {
    const u = doc.createElementNS(W_NS, 'w:u');
    u.setAttribute('w:val', 'single');
    rPr.appendChild(u);
  }
  if (rPr.childNodes.length) r.appendChild(rPr);
  const t = doc.createElementNS(W_NS, 'w:t');
  if (/^\s|\s$/.test(text)) t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

export async function postprocessDocxRich(input: Blob): Promise<Blob> {
  const buf = await input.arrayBuffer();
  const zip = new PizZip(buf);
  const docXmlPath = 'word/document.xml';
  const relsPath = 'word/_rels/document.xml.rels';

  const docXml = zip.file(docXmlPath)?.asText();
  const relsXml = zip.file(relsPath)?.asText();
  if (!docXml || !relsXml) return input;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const rels = parser.parseFromString(relsXml, 'application/xml');

  // Utility to get/set text of a run
  const getRuns = (p: Element) => Array.from(p.getElementsByTagNameNS(W_NS, 'r'));
  const getT = (r: Element) => {
    const t = r.getElementsByTagNameNS(W_NS, 't')[0];
    return t ? (t.textContent || '') : '';
  };
  const setT = (r: Element, text: string) => {
    let t = r.getElementsByTagNameNS(W_NS, 't')[0];
    if (!t) {
      t = doc.createElementNS(W_NS, 'w:t');
      r.appendChild(t);
    }
    if (/^\s|\s$/.test(text)) t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    t.textContent = text;
  };

  // build rel id generator
  let maxId = 1;
  Array.from(rels.getElementsByTagName('Relationship')).forEach((rel) => {
    const id = rel.getAttribute('Id') || '';
    const m = id.match(/\d+/);
    if (m) maxId = Math.max(maxId, parseInt(m[0], 10));
  });
  const nextRelId = () => 'rId' + (++maxId).toString();

  // 1) Global pass: decode visible &quot; &apos; etc that slipped through
  Array.from(doc.getElementsByTagNameNS(W_NS, 't')).forEach((t) => {
    const raw = t.textContent || '';
    const dec = decodeHTMLEntities(raw);
    if (dec !== raw) t.textContent = dec;
  });

  // 2) Replace [[RUN:i]] + [[DATA:i:...]] with styled runs/hyperlinks
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
  for (const p of paragraphs) {
    const runs = getRuns(p);
    for (let i = 0; i < runs.length; i++) {
      const label = getT(runs[i]);
      const m = label.match(/^\[\[RUN:(\d+)\]\]$/);
      if (!m) continue;
      const index = m[1];

      // find the corresponding DATA marker (same paragraph)
      let htmlB64: string | null = null;
      for (let j = i + 1; j < runs.length; j++) {
        const t = getT(runs[j]);
        const dm = t.match(new RegExp('^\\[\\[DATA:' + index + ':(.+)\\]\\]$'));
        if (dm) { htmlB64 = dm[1]; runs.splice(j,1); p.removeChild(p.childNodes[j]); break; }
      }
      // if not found in same paragraph, scan subsequent runs in document order
      if (!htmlB64) {
        outer: for (const p2 of paragraphs) {
          const rs2 = getRuns(p2);
          for (let j = 0; j < rs2.length; j++) {
            const t2 = getT(rs2[j]);
            const dm2 = t2.match(new RegExp('^\\[\\[DATA:' + index + ':(.+)\\]\\]$'));
            if (dm2) {
              htmlB64 = dm2[1];
              rs2.splice(j,1);
              p2.removeChild(p2.childNodes[j]);
              break outer;
            }
          }
        }
      }
      if (!htmlB64) {
        // Fallback: remove marker
        setT(runs[i], '');
        continue;
      }
      let html = '';
      try { html = atob(htmlB64); } catch { html = ''; }
      html = decodeHTMLEntities(html);
      const tokens = htmlToTokens(html);

      // Build replacement nodes
      const newNodes: Node[] = [];
      tokens.forEach((tk) => {
        if (tk.type === 'br') {
          const r = doc.createElementNS(W_NS, 'w:r');
          r.appendChild(doc.createElementNS(W_NS, 'w:br'));
          newNodes.push(r);
        } else if (tk.type === 'link') {
          const rId = nextRelId();
          const rel = rels.createElement('Relationship');
          rel.setAttribute('Id', rId);
          rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink');
          rel.setAttribute('Target', tk.url || '');
          rel.setAttribute('TargetMode', 'External');
          rels.documentElement.appendChild(rel);

          const hl = doc.createElementNS(W_NS, 'w:hyperlink');
          hl.setAttributeNS(R_NS, 'r:id', rId);
          // do NOT force Hyperlink style to avoid font changes; just underline
          const run = createRun(doc, tk.text || tk.url || '', { bold: tk.bold, italic: tk.italic, underline: true });
          hl.appendChild(run);
          newNodes.push(hl);
        } else {
          newNodes.push(createRun(doc, tk.text || '', { bold: tk.bold, italic: tk.italic, underline: tk.underline }));
        }
      });

      // replace [[RUN:i]] run with newNodes
      const toRemove = runs[i];
      newNodes.forEach(nd => p.insertBefore(nd, toRemove));
      p.removeChild(toRemove);
    }
  }

  // write back
  zip.file(docXmlPath, serializer.serializeToString(doc));
  zip.file(relsPath, serializer.serializeToString(rels));
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
