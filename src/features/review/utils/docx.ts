
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import { FormState } from '../context/FormContext';
import adverseTpl from '@/assets/templates/Adverse.docx?url';
import fullTpl from '@/assets/templates/FullReview.docx?url';
import { postprocessDocxRich } from './postprocessDocxRich';

function decodeHTMLEntities(input?: string): string {
  if (!input) return '';
  const div = document.createElement('div');
  div.innerHTML = input;
  return div.textContent || div.innerText || '';
}

function formatDate(raw?: string): string {
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y,m,d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return raw;
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yy = String(dt.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function formatCurrency(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00A0€';
}

function safeArray<T>(arr?: T[] | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

function b64FromUtf8(s: string): string {
  // encodeURIComponent -> UTF-8 percent bytes -> btoa-safe Latin1 string
  return btoa(unescape(encodeURIComponent(s)));
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAdverseData(state: FormState) {
  const src: any = (state as any).adverseData || {};
  const profile: any = src.customerProfile || {};
  const sources: Array<{author?: string; url?: string}> = Array.isArray(src.reputationalSources) ? src.reputationalSources : [];

  // Split each indicator line (may contain HTML pasted from editor)
  const raw = (src.reputationalIndicators || '').toString();
  const lines = raw.split(/\n+/).filter((s: string) => s.trim() !== '');

  // Build markers + payloads
  const tokens = lines.map((line: string, idx: number) => {
    let text = decodeHTMLEntities(line);

    // author hyperlink in "Secondo l'articolo di ..."
    const prefix = "Secondo l'articolo di ";
    const s = sources[idx] || {};
    const author = (s.author || '').trim();
    const url = (s.url || '').trim();
    if (author && url && text.startsWith(prefix)) {
      const rest = text.slice(prefix.length);
      if (rest.startsWith(author)) {
        const afterAuthor = rest.slice(author.length);
        text = `${prefix}<a href="${htmlEscape(url)}">${htmlEscape(author)}</a>${afterAuthor}`;
      }
    }

    // Store Base64 of HTML fragment in DATA i
    const b64 = b64FromUtf8(text);
    return `[[RUN:${idx}]] [[DATA:${idx}:${b64}]]`;
  });

  return {
    agent: src.agentName || src.reviewPerformedBy || '',
    reviewDate: formatDate(src.reviewDate),
    registrationDate: formatDate(profile.registrationDate),
    documentsSent: safeArray(profile.documentsSent).map((d: any) => ({
      document: d.document,
      status: d.status,
      info: d.info && String(d.info).trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit: (profile.firstDeposit || ''),
    totalDeposited: formatCurrency(profile.totalDeposited),
    latestLogin: formatDate(profile.latestLogin),
    latestLoginIP: profile.latestLoginIP || '',
    latestLoginNationality: profile.latestLoginNationality || '',
    birthplace: [profile.nationality, profile.birthplace].filter(Boolean).join(' - '),
    age: profile.age || '',
    reputationalIndicators: tokens,
    conclusions: src.conclusion || src.conclusions || ''
  };
}

function buildFullData(state: FormState) {
  const src: any = (state as any).fullData || {};
  const profile: any = src.customerProfile || {};
  const sources: Array<{author?: string; url?: string}> = Array.isArray(src.reputationalSources) ? src.reputationalSources : [];

  const raw = (src.reputationalIndicators || '').toString();
  const lines = raw.split(/\n+/).filter((s: string) => s.trim() !== '');
  const prefix = "Secondo l'articolo di ";
  const rich = lines.map((line: string, idx: number) => {
    const s = sources[idx] || {};
    const author = (s.author || '').trim();
    const link = (s.url || '').trim();
    let suffix = line;
    let prefixText = '';
    if (line.startsWith(prefix)) {
      prefixText = prefix;
      const after = line.slice(prefix.length);
      suffix = author && after.startsWith(author) ? after.slice(author.length) : after;
    }
    return {
      prefix: prefixText,
      authorLabel: author || (link || ''),
      link: link ? { text: author || link, url: link } : null,
      suffix
    };
  });

  return {
    reasonForReview: src.reasonForReview || '',
    agent: src.reviewPerformedBy || src.agentName || '',
    reviewDate: formatDate(src.reviewDate),
    customerProfile: profile,
    registrationDate: formatDate(profile.registrationDate),
    firstDeposit: (profile.firstDeposit || ''),
    totalDeposited: formatCurrency(profile.totalDeposited),
    birthplace: [profile.nationality, profile.birthplace].filter(Boolean).join(' - '),
    reputationalIndicatorsRich: rich,
    conclusions: src.conclusionAndRiskLevel || src.conclusions || ''
  };
}

export async function exportToDocx(state: FormState): Promise<Blob> {
  const tplUrl = (state as any).reviewType === 'adverse' ? adverseTpl : fullTpl;
  const res = await fetch(tplUrl);
  const arrayBuffer = await res.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  const imageOpts = {
    centered: false,
    getImage: function(_el: any) { return ''; },
    getSize: function(_img: any) { return [100, 100] as [number, number]; }
  };
  const doc = new Docxtemplater(zip, {
    modules: [new (ImageModule as any)(imageOpts)],
    nullGetter() { return ''; }
  });

  const data = (state as any).reviewType === 'adverse' ? buildAdverseData(state) : buildFullData(state);
  doc.setData(data);

  try {
    doc.render();
  } catch (err) {
    console.error('Docxtemplater error', err);
    throw err;
  }

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  // Postprocess to inject styled runs and hyperlinks
  const finalBlob = await postprocessDocxRich(blob);
  return finalBlob;
}

export async function downloadDocx(state: FormState) {
  const blob = await exportToDocx(state);
  const date = new Date().toISOString().slice(0, 10);
  const prefix = (state as any).reviewType === 'adverse' ? 'AdverseReview' : 'FullReview';
  saveAs(blob, `${prefix}_${date}.docx`);
}
