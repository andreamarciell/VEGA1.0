
import PizZip from 'pizzip';

function encodeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function wrapTextAsRuns(text: string): string {
  if (text === '') return '';
  // preserve spaces using xml:space="preserve"
  return `<w:r><w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r>`;
}
function makeFieldCodeHyperlink(label: string, url: string): string {
  const l = encodeXml(label);
  const u = encodeXml(url);
  return [
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>`,
    `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${u}" </w:instrText></w:r>`,
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>`,
    `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>${l}</w:t></w:r>`,
    `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
  ].join('');
}

function paragraphToTextAndMap(pXml: string) {
  const runs = [];
  let text = '';
  const regex = /<w:r[\s\S]*?<\/w:r>/g;
  let m;
  let lastIndex = 0;
  while ((m = regex.exec(pXml)) !== null) {
    const runXml = m[0];
    const tMatch = /<w:t[^>]*>([\s\S]*?)<\/w:t>/.exec(runXml);
    const t = tMatch ? decodeXml(tMatch[1]) : '';
    const start = text.length;
    text += t;
    const end = text.length;
    runs.push({ xml: runXml, t, start, end });
    lastIndex = m.index + m[0].length;
  }
  return { text, runs };
}

function rebuildParagraph(pXml: string, prefixText: string, hyperlinkLabel: string, hyperlinkUrl: string, suffixText: string): string {
  // Keep paragraph props if any
  const openTagMatch = /^<w:p[^>]*>/.exec(pXml);
  const closeTag = '</w:p>';
  const pOpen = openTagMatch ? openTagMatch[0] : '<w:p>';
  const pPrMatch = /<w:pPr[\s\S]*?<\/w:pPr>/.exec(pXml);
  const pPr = pPrMatch ? pPrMatch[0] : '';
  const inner = wrapTextAsRuns(prefixText) + makeFieldCodeHyperlink(hyperlinkLabel, hyperlinkUrl) + wrapTextAsRuns(suffixText);
  return `${pOpen}${pPr}${inner}${closeTag}`;
}

function findFirstLinkCandidate(text: string) {
  // 1) marker pattern
  const markerRe = /\[\[HYPER_S\]\]([\s\S]*?)\[\[HYPER_E\]\]\s*(?:\[\[HYPER_U:([^\]]+)\]\])/;
  const m1 = markerRe.exec(text);
  if (m1) return { type: 'marker', start: m1.index, end: m1.index + m1[0].length, label: m1[1], url: m1[2] };

  // 2) encoded anchor pattern &lt;a href=&quot;...&quot; ...&gt;label&lt;/a&gt;
  const m2 = /&lt;a\s+[^>]*?href=&quot;([^&]*)&quot;[^&]*&gt;([\s\S]*?)&lt;\/a&gt;/.exec(text);
  if (m2) return { type: 'html', start: m2.index, end: m2.index + m2[0].length, label: decodeXml(m2[2]), url: m2[1] };

  // 3) label (URL)
  const m3 = /([^\(]{1,120})\s*\((https?:\/\/[^\s)]+)\)/.exec(text);
  if (m3) return { type: 'paren', start: m3.index, end: m3.index + m3[0].length, label: m3[1].trim(), url: m3[2] };

  // 4) bare URL - make it link using URL as label
  const m4 = /(https?:\/\/[^\s]+)/.exec(text);
  if (m4) return { type: 'bare', start: m4.index, end: m4.index + m4[0].length, label: m4[0], url: m4[0] };

  return null;
}

function transformParagraph(pXml: string): string {
  const map = paragraphToTextAndMap(pXml);
  if (!map.runs.length) return pXml;
  const candidate = findFirstLinkCandidate(map.text);
  if (!candidate) return pXml;

  const prefix = map.text.slice(0, candidate.start);
  const suffix = map.text.slice(candidate.end);
  return rebuildParagraph(pXml, prefix, candidate.label, candidate.url, suffix);
}

function transformXml(xml: string): string {
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (p) => transformParagraph(p));
}

export async function postprocessDocxHyperlinks(input: Blob): Promise<Blob> {
  const ab = await input.arrayBuffer();
  const zip = new PizZip(ab);
  const targets = zip.file(/word\/(document|header\d+|footer\d+)\.xml/).map((f:any)=>f.name);
  if (!targets.length) return input;
  targets.forEach(name => {
    const xml = zip.file(name)!.asText();
    const out = transformXml(xml);
    zip.file(name, out);
  });
  const outBlob = new Blob([zip.generate({ type: 'arraybuffer' })], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return outBlob;
}
