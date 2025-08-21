
// postprocessDocxLinks.ts
import PizZip from 'pizzip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// Turn markers [[HYPER_S]] ... [[HYPER_E]] + [[HYPER_U:URL]] into real hyperlinks inside word/document.xml
export async function postprocessDocxHyperlinks(input: Blob): Promise<Blob> {
  try {
    const buf = await input.arrayBuffer();
    const zip = new PizZip(buf);
    const docXmlPath = 'word/document.xml';
    const relsPath = 'word/_rels/document.xml.rels';
    const docXml = zip.file(docXmlPath)?.asText();
    if (!docXml) return input;
    let relsXml = zip.file(relsPath)?.asText();
    if (!relsXml) {
      // minimal relationships file
      relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    }

    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const doc = parser.parseFromString(docXml, 'application/xml');
    const rels = parser.parseFromString(relsXml, 'application/xml');

    // Prepare Relationship id generator
    const relsRoot = rels.documentElement;
    const relEls = Array.from(relsRoot.getElementsByTagName('Relationship'));
    let maxId = 5;
    for (const rel of relEls) {
      const idAttr = rel.getAttribute('Id') || '';
      const m = idAttr.match(/rId(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n)) maxId = Math.max(maxId, n);
      }
    }
    const nextRelId = () => 'rId' + (++maxId);

    const getRuns = (p: Element) => Array.from(p.getElementsByTagNameNS(W_NS, 'r'));
    const getT = (r: Element) => {
      const t = r.getElementsByTagNameNS(W_NS, 't')[0];
      return t ? t.textContent || '' : '';
    };
    const setT = (r: Element, text: string) => {
      let t = r.getElementsByTagNameNS(W_NS, 't')[0];
      if (!t) {
        t = doc.createElementNS(W_NS, 'w:t');
        r.appendChild(t);
      }
      // preserve xml:space if leading/trailing spaces
      if (/^\s|\s$/.test(text)) t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      t.textContent = text;
    };

    const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
    const starts: Array<{p: Element, idx: number}> = [];
    // Collect all markers in order
    for (const p of paragraphs) {
      const runs = getRuns(p);
      for (let i = 0; i < runs.length; i++) {
        const txt = getT(runs[i]);
        if (txt === '[[HYPER_S]]') starts.push({ p, idx: i });
      }
    }

    // Helper: add relationship
    function addHyperlinkRel(url: string): string {
      const rel = rels.createElement('Relationship');
      const id = nextRelId();
      rel.setAttribute('Id', id);
      rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink');
      rel.setAttribute('Target', url);
      rel.setAttribute('TargetMode', 'External');
      relsRoot.appendChild(rel);
      return id;
    }

    // Process each start marker sequentially and pair with the nearest end+url marker after it
    for (const s of starts) {
      const p = s.p;
      const runs = getRuns(p);
      let i = s.idx;
      // find end in same paragraph
      let endIdx = -1;
      for (let j = i + 1; j < runs.length; j++) {
        if (getT(runs[j]) === '[[HYPER_E]]') { endIdx = j; break; }
      }
      if (endIdx === -1) continue;
      // find url marker AFTER endIdx (may be in same paragraph or later)
      let url: string | null = null;
      // first search same paragraph
      for (let j = endIdx + 1; j < runs.length; j++) {
        const m = getT(runs[j]).match(/^\[\[HYPER_U:(.+?)\]\]$/);
        if (m) { url = m[1]; runs.splice(j,1); j--; }
      }
      if (!url) {
        // search following paragraphs
        let foundPara: Element | null = null; let foundRunIndex = -1;
        outer: for (const p2 of paragraphs) {
          // traverse in doc order: we assume url marker follows the paragraph with start/end
          if (foundPara) break;
          const rs = getRuns(p2);
          for (let j = 0; j < rs.length; j++) {
            const m = getT(rs[j]).match(/^\[\[HYPER_U:(.+?)\]\]$/);
            if (m) { url = m[1]; foundPara = p2; foundRunIndex = j; break outer; }
          }
        }
        if (foundPara && foundRunIndex > -1) {
          const rs = getRuns(foundPara);
          rs.splice(foundRunIndex,1);
          foundPara.removeChild(rs[foundRunIndex]);
        }
      }
      if (!url) continue;

      // collect label runs between markers
      const labelRuns = runs.slice(i + 1, endIdx);
      // create hyperlink element
      const hyperlink = doc.createElementNS(W_NS, 'w:hyperlink');
      const rId = addHyperlinkRel(url);
      hyperlink.setAttributeNS(R_NS, 'r:id', rId);

      for (const r of labelRuns) {
        // ensure Hyperlink style
        let rPr = r.getElementsByTagNameNS(W_NS, 'rPr')[0];
        if (!rPr) { rPr = doc.createElementNS(W_NS, 'w:rPr'); r.insertBefore(rPr, r.firstChild); }
        const rStyle = doc.createElementNS(W_NS, 'w:rStyle');
        rStyle.setAttribute('w:val', 'Hyperlink');
        rPr.appendChild(rStyle);
        // move run into hyperlink
        hyperlink.appendChild(r.cloneNode(true));
      }
      // replace runs from start to end with single hyperlink node
      for (let j = endIdx; j >= i; j--) {
        p.removeChild(runs[j]);
      }
      // insert hyperlink at position i
      const refRun = runs[i] || null;
      if (refRun) {
        p.insertBefore(hyperlink, refRun);
      } else {
        p.appendChild(hyperlink);
      }
    }

    // Remove any leftover url markers in the entire doc
    for (const p of paragraphs) {
      const runs = getRuns(p);
      for (const r of runs) {
        const t = getT(r);
        if (/^\[\[HYPER_U:.+?\]\]$/.test(t) || t === '[[HYPER_S]]' || t === '[[HYPER_E]]') {
          p.removeChild(r);
        }
      }
    }

    // write back
    const newDocXml = serializer.serializeToString(doc);
    const newRelsXml = serializer.serializeToString(rels);
    zip.file(docXmlPath, newDocXml);
    zip.file(relsPath, newRelsXml);

    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  } catch (e) {
    console.error('postprocessDocxHyperlinks failed', e);
    return input;
  }
}
