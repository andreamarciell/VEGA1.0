
import PizZip from 'pizzip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

type HtmlToken = { kind: 'text'|'br'|'link'; text?: string; url?: string; b?: boolean; i?: boolean; u?: boolean };

function decodeHTMLEntities(input: string): string {
  const map: Record<string, string> = {
    '&amp;quot;': '"',
    '&amp;apos;': "'",
    '&amp;amp;': '&',
    '&amp;lt;': '<',
    '&amp;gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&'
  };
  return input.replace(/&(amp;)?(quot|apos|lt|gt|amp)|&#39;;/g, (m) => (map[m] ?? m));
}

function htmlToTokens(html: string): HtmlToken[] {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const out: HtmlToken[] = [];
  const walk = (node: Node, ctx: {b:boolean;i:boolean;u:boolean}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '');
      if (t) out.push({ kind: 'text', text: t, b: ctx.b, i: ctx.i, u: ctx.u });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...ctx };
    if (tag === 'b' || tag === 'strong') next.b = true;
    if (tag === 'i' || tag === 'em') next.i = true;
    if (tag === 'u') next.u = true;
    if (tag === 'br') { out.push({ kind: 'br' }); return; }
    if (tag === 'a') {
      const url = (node as HTMLAnchorElement).getAttribute('href') || '';
      const tmp: HtmlToken[] = [];
      (node.childNodes ? Array.from(node.childNodes) : []).forEach((c) => walk(c, { ...next, u: true }));
      const label = tmp.length ? tmp.map(t => t.text || '').join('') : (node.textContent || '');
      out.push({ kind: 'link', text: label, url, b: next.b, i: next.i, u: true });
      return;
    }
    (node.childNodes ? Array.from(node.childNodes) : []).forEach((c) => walk(c, next));
  };
  (wrap.childNodes ? Array.from(wrap.childNodes) : []).forEach((n) => walk(n, {b:false,i:false,u:false}));
  return out;
}

function createRun(doc: XMLDocument, text: string, fmt?: {b?:boolean;i?:boolean;u?:boolean}) {
  const r = doc.createElementNS(W_NS, 'w:r');
  if (fmt && (fmt.b || fmt.i || fmt.u)) {
    const rPr = doc.createElementNS(W_NS, 'w:rPr');
    if (fmt.b) rPr.appendChild(doc.createElementNS(W_NS, 'w:b'));
    if (fmt.i) rPr.appendChild(doc.createElementNS(W_NS, 'w:i'));
    if (fmt.u) {
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

function createHyperlink(doc: XMLDocument, rels: XMLDocument, text: string, url: string, fmt?: {b?:boolean;i?:boolean;u?:boolean}) {
  const rel = rels.createElement('Relationship');
  // compute next id
  const ids = Array.from(rels.getElementsByTagName('Relationship'))
    .map(r => r.getAttribute('Id') || '')
    .map(id => parseInt((id.match(/\d+/) || ['0'])[0],10));
  const next = Math.max(0, ...ids) + 1;
  const rId = 'rId' + next;
  rel.setAttribute('Id', rId);
  rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink');
  rel.setAttribute('Target', url);
  rel.setAttribute('TargetMode', 'External');
  rels.documentElement.appendChild(rel);

  const hl = doc.createElementNS(W_NS, 'w:hyperlink');
  hl.setAttributeNS(R_NS, 'r:id', rId);
  hl.appendChild(createRun(doc, text, { ...fmt, u: true }));
  return hl;
}

function paragraphText(doc: XMLDocument, p: Element): string {
  const ts = Array.from(p.getElementsByTagNameNS(W_NS, 't'));
  return ts.map(t => t.textContent || '').join('');
}

function clearParagraphRuns(doc: XMLDocument, p: Element) {
  const children = Array.from(p.childNodes);
  for (const ch of children) {
    if (ch.nodeName === 'w:r' || ch.nodeName === 'w:hyperlink') {
      p.removeChild(ch);
    }
  }
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

  // decode entities globally
  Array.from(doc.getElementsByTagNameNS(W_NS, 't')).forEach((t) => {
    const raw = t.textContent || '';
    const dec = decodeHTMLEntities(raw);
    if (dec !== raw) t.textContent = dec;
  });

  const paras = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
  const tokenRe = /\[\[RUN:(\d+)\]\]\s*\[\[DATA:\1:([A-Za-z0-9+/=]+)\]\]/g;
  const htmlMarkerRe = /\{\{(\w+)_HTML_START\}\}([A-Za-z0-9+/=]+)\{\{\1_HTML_END\}\}/g;

  paras.forEach((p) => {
    const text = paragraphText(doc, p);
    let idx = 0;
    let last = 0;
    let changed = false;
    const pieces: Array<{kind:'plain', text:string} | {kind:'html', html:string}> = [];

    // Process RUN/DATA tokens
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(text)) !== null) {
      changed = true;
      const start = m.index;
      const end = start + m[0].length;
      const before = text.slice(last, start);
      if (before) pieces.push({ kind: 'plain', text: before });
      let html = '';
      try {
        html = decodeURIComponent(escape(atob(m[2])));
      } catch {
        try { html = atob(m[2]); } catch { html = ''; }
      }
      pieces.push({ kind: 'html', html });
      last = end;
      idx++;
    }
    
    // Process HTML markers
    htmlMarkerRe.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = htmlMarkerRe.exec(text)) !== null) {
      changed = true;
      const start = hm.index;
      const end = start + hm[0].length;
      const before = text.slice(last, start);
      if (before) pieces.push({ kind: 'plain', text: before });
      let html = '';
      try {
        html = decodeURIComponent(escape(atob(hm[2])));
      } catch {
        try { html = atob(hm[2]); } catch { html = ''; }
      }
      pieces.push({ kind: 'html', html });
      last = end;
    }
    
    const tail = text.slice(last);
    if (tail) pieces.push({ kind: 'plain', text: tail });

    if (!changed) {
      // fallback: transform escaped anchors &lt;a href="...">label&lt;/a>
      const anchorEsc = /&lt;a\s+href="([^"]+)"[^&]*&gt;([^]*?)&lt;\/a&gt;/gi;
      if (!anchorEsc.test(text)) return;
      // reset lastIndex and rebuild pieces
      anchorEsc.lastIndex = 0;
      let l = 0; let mm: RegExpExecArray | null;
      const p2: typeof pieces = [];
      while ((mm = anchorEsc.exec(text)) !== null) {
        const st = mm.index; const en = st + mm[0].length;
        if (st > l) p2.push({ kind:'plain', text: text.slice(l, st) });
        const url = mm[1]; const label = mm[2].replace(/&amp;lt;|&amp;gt;|&amp;amp;|&lt;|&gt;|&amp;|&#39;|&quot;/g, (s) => decodeHTMLEntities(s));
        p2.push({ kind:'html', html: `<a href="${url}">${label}</a>` });
        l = en;
      }
      if (l < text.length) p2.push({ kind:'plain', text: text.slice(l) });
      // replace pieces
      if (p2.length === 0) return;
      pieces.length = 0;
      pieces.push(...p2);
      changed = true;
    }

    if (!changed) return;

    // rebuild paragraph runs
    clearParagraphRuns(doc, p);
    for (const piece of pieces) {
      if (piece.kind === 'plain') {
        const str = piece.text;
        const parts = str.split(/\n/);
        parts.forEach((seg, i) => {
          if (seg) p.appendChild(createRun(doc, seg));
          if (i < parts.length - 1) {
            const r = doc.createElementNS(W_NS, 'w:r');
            r.appendChild(doc.createElementNS(W_NS, 'w:br'));
            p.appendChild(r);
          }
        });
      } else {
        const tokens = htmlToTokens(piece.html);
        tokens.forEach((tk) => {
          if (tk.kind === 'br') {
            const r = doc.createElementNS(W_NS, 'w:r');
            r.appendChild(doc.createElementNS(W_NS, 'w:br'));
            p.appendChild(r);
          } else if (tk.kind === 'link') {
            p.appendChild(createHyperlink(doc, rels, tk.text || tk.url || '', tk.url || '', { b: tk.b, i: tk.i, u: true }));
          } else {
            p.appendChild(createRun(doc, tk.text || '', { b: tk.b, i: tk.i, u: tk.u }));
          }
        });
      }
    }
  });

  zip.file(docXmlPath, serializer.serializeToString(doc));
  zip.file(relsPath, serializer.serializeToString(rels));
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
