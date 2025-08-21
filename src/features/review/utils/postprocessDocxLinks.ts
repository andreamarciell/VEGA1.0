
import PizZip from 'pizzip';

// Replace markers [[HYPER_S]]label[[HYPER_E]] [[HYPER_U:url]] with Word field-code hyperlinks.
// Also convert bare URLs into clickable hyperlinks using field codes.
export async function postprocessDocxHyperlinks(input: Blob): Promise<Blob> {
  const arrayBuffer = await input.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const fileNames = zip.file(/word\/(document|header\d+|footer\d+)\.xml/).map((f: any) => f.name);
  fileNames.forEach((name: string) => {
    const xml = zip.file(name)!.asText();
    const updated = transformXml(xml);
    zip.file(name, updated);
  });

  const out = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return out as Blob;
}

// Build field-code based hyperlink runs
function buildHyperlinkField(label: string, url: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const labelEsc = esc(label);
  const urlEsc = esc(url);
  return [
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
    `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${urlEsc}" </w:instrText></w:r>`,
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
    '<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>',
    labelEsc,
    '</w:t></w:r>',
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
  ].join('');
}

function transformXml(xml: string): string {
  // Work paragraph by paragraph for safer replacements
  return xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (p) => transformParagraph(p));
}

function transformParagraph(pXml: string): string {
  // Extract text content sequence
  const texts: string[] = [];
  const textNodes: { full: string, inner: string, start: number, end: number }[] = [];
  let idx = 0;
  const replaced = pXml.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (m, inner) => {
    const start = idx;
    const decoded = decodeXml(inner);
    texts.push(decoded);
    const end = start + decoded.length;
    textNodes.push({ full: m, inner, start, end });
    idx = end;
    return m;
  });

  const paragraphText = texts.join('');

  // 1) Marker-based replacement
  const markerRe = /\[\[HYPER_S\]\]([\s\S]*?)\[\[HYPER_E\]\]\s*(?:\[\[HYPER_U:([^\]]+)\]\])?/;
  let m = markerRe.exec(paragraphText);
  if (m && m.index !== undefined && m[2]) {
    const label = m[1];
    const url = m[2];
    return spliceParagraphWithField(pXml, textNodes, paragraphText, m.index, m.index + m[0].length, label, url, /*removeTailText*/ true);
  }

  // 2) Pattern: label (URL)
  const parenRe = /([^\(]{1,120})\s*\((https?:\/\/[^\s)]+)\)/;
  m = parenRe.exec(paragraphText);
  if (m && m.index !== undefined) {
    const label = m[1].trim();
    const url = m[2];
    return spliceParagraphWithField(pXml, textNodes, paragraphText, m.index, m.index + m[0].length, label, url, true);
  }

  // 3) Bare URL: make it clickable keeping the URL as label
  const urlRe = /(https?:\/\/[^\s<>"]+)/;
  m = urlRe.exec(paragraphText);
  if (m && m.index !== undefined) {
    const url = m[1];
    return spliceParagraphWithField(pXml, textNodes, paragraphText, m.index, m.index + url.length, url, url, false);
  }

  return pXml;
}

function spliceParagraphWithField(
  pXml: string,
  textNodes: { full: string, inner: string, start: number, end: number }[],
  paragraphText: string,
  start: number,
  end: number,
  label: string,
  url: string,
  removeTailText: boolean
): string {
  // Build new <w:t> sequence by slicing around [start,end]
  const before = paragraphText.slice(0, start);
  const after = paragraphText.slice(end);

  // If requested, try to drop residual markers/URLs from "after"
  const afterClean = removeTailText
    ? after.replace(/^\s*\[\[HYPER_U:[^\]]+\]\]/, '').replace(/^\s*(https?:\/\/[^\s<>"]+)/, '').replace(/^\s*\)?\.?\s*/, ' ')
    : after;

  // Recompose paragraph: stringify to a minimal run sequence
  const fieldXml = buildHyperlinkField(label, url);

  // To keep it simple and robust, replace the whole run sequence inside <w:p> between the first and last <w:t>
  // Build new runs payload
  const payload = [
    wrapAsRunText(before),
    fieldXml,
    wrapAsRunText(afterClean)
  ].join('');

  // Replace inner of <w:p> preserving <w:pPr> if present
  return pXml.replace(/(<w:p(?:\s[^>]*)?>)([\s\S]*?)(<\/w:p>)/, (mm, open, inside, close) => {
    // preserve pPr block if present
    const pPrMatch = inside.match(/^(\s*<w:pPr[\s\S]*?<\/w:pPr>)/);
    const pPr = pPrMatch ? pPrMatch[1] : '';
    const rest = pPrMatch ? inside.slice(pPrMatch[1].length) : inside;
    return open + pPr + payload + close;
  });
}

function wrapAsRunText(text: string): string {
  if (!text) return '';
  const enc = encodeXml(text);
  return `<w:r><w:t xml:space="preserve">${enc}</w:t></w:r>`;
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function encodeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
