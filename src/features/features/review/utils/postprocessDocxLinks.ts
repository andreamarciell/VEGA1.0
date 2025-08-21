import PizZip from 'pizzip';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert markers [[HYPER_S]]label[[HYPER_E]] [[HYPER_U:url]]
 * into Word hyperlink field runs.
 */
export async function postprocessDocxHyperlinks(input: Blob): Promise<Blob> {
  const ab = await input.arrayBuffer();
  const zip = new PizZip(ab);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return input;
  let xml = docFile.asText();

  const runRegex = /<w:r\b[^>]*>.*?<w:t[^>]*>([\s\S]*?)<\/w:t>.*?<\/w:r>/g;
  let replaced = false;
  xml = xml.replace(runRegex, (full, tcontent) => {
    if (tcontent.indexOf('[[HYPER_S]]') === -1) return full;
    // There can be multiple links inside the same run -> process iteratively.
    let content = tcontent;
    let pieces: string[] = [];
    let cursor = 0;
    const pattern = /\[\[HYPER_S\]\]([\s\S]*?)\[\[HYPER_E\]\](?:\s*\[\[HYPER_U:([^\]]+)\]\])?/g;
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = pattern.exec(content)) !== null) {
      replaced = true;
      const pre = content.slice(lastIndex, m.index);
      const label = m[1] || '';
      const url = (m[2] || '').trim();
      const postStart = pattern.lastIndex;
      lastIndex = postStart;
      // push pre text
      if (pre) {
        pieces.push(`<w:r><w:t>${escapeXml(pre)}</w:t></w:r>`);
      }
      if (url) {
        pieces.push(
          `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
          `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${escapeXml(url)}" </w:instrText></w:r>` +
          `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
          `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r>` +
          `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
        );
      } else {
        // no url, just plain label without markers
        pieces.push(`<w:r><w:t>${escapeXml(label)}</w:t></w:r>`);
      }
    }
    const tail = content.slice(lastIndex);
    if (tail) pieces.push(`<w:r><w:t>${escapeXml(tail)}</w:t></w:r>`);
    // Replace the single run by multiple runs
    return pieces.join('');
  });

  if (!replaced) return input;
  zip.file('word/document.xml', xml);
  const out = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return out as Blob;
}