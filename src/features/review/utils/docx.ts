// features/features/review/utils/docx.ts
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import adverseTpl from '@/assets/templates/Adverse.docx?url';
import fullTpl from '@/assets/templates/FullReview.docx?url';
import { postprocessDocxRich } from './postprocessDocxRich';

// avoid tight coupling with types from context to keep this util isolated
type AnyState = any;

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
    const [y,m,d] = raw.split('-'); return `${d}/${m}/${y}`;
  }
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return raw;
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yy = String(dt.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function euro(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\\u00A0€';
}

function safeArr<T>(v: any): T[] { return Array.isArray(v) ? v : []; }

/** Build data for Adverse template. Adds [[RUN:i]]/[[DATA:i:...]] tokens per indicator line. */
function buildAdverseData(state: AnyState) {
  const src = state?.adverseData ?? {};
  const profile = src?.customerProfile ?? {};
  const sources: Array<{author?: string; url?: string}> = Array.isArray(src?.reputationalSources) ? src.reputationalSources : [];

  const raw: string = (src?.reputationalIndicators ?? '').toString();
  const lines = raw.split(/\n+/).filter((s: string) => s.trim() !== '');

  const tokens: string[] = [];
  lines.forEach((line: string, idx: number) => {
    let html = decodeHTMLEntities(line);

    // author hyperlink in "Secondo l'articolo di ..."
    const prefix = \"Secondo l'articolo di \";
    const s = sources[idx] || {};
    const author = (s.author || '').trim();
    const url = (s.url || '').trim();
    if (author && url && html.startsWith(prefix)) {
      const after = html.slice(prefix.length);
      if (after.startsWith(author)) {
        const rest = after.slice(author.length);
        html = `${prefix}<a href=\"${url}\">${author}</a>${rest}`;
      }
    }

    // store as base64 html and emit token pair
    const b64 = btoa(unescape(encodeURIComponent(html)));
    tokens.push(`[[RUN:${idx}]] [[DATA:${idx}:${b64}]]`);
  });

  return {
    agent: src.reviewPerformedBy || src.agentName || '',
    reviewDate: formatDate(src.reviewDate),
    registrationDate: formatDate(profile.registrationDate),
    documentsSent: safeArr<any>(profile.documentsSent).map((d: any) => ({
      document: d.document,
      status: d.status,
      info: d.info && String(d.info).trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit: (profile.firstDeposit || ''),
    totalDeposited: euro(profile.totalDeposited),
    latestLogin: formatDate(profile.latestLogin),
    latestLoginIP: profile.latestLoginIP || '',
    latestLoginNationality: profile.latestLoginNationality || '',
    birthplace: [profile.nationality, profile.birthplace].filter(Boolean).join(' - '),
    age: profile.age || '',
    reputationalIndicators: tokens,
    conclusions: src.conclusion || src.conclusions || ''
  };
}

function buildFullData(state: AnyState) {
  const src = state?.fullData ?? {};
  const profile = src?.customerProfile ?? {};

  // keep simple mapping; full template can also consume lines if needed
  const raw: string = (src?.reputationalIndicators ?? '').toString();
  const lines = raw.split(/\n+/).filter((s: string) => s.trim() !== '');
  const tokens = lines.map((line: string, i: number) => {
    const b64 = btoa(unescape(encodeURIComponent(decodeHTMLEntities(line))));
    return `[[RUN:${i}]] [[DATA:${i}:${b64}]]`;
  });

  return {
    reasonForReview: src.reasonForReview || '',
    agent: src.reviewPerformedBy || src.agentName || '',
    reviewDate: formatDate(src.reviewDate),
    customerProfile: profile,
    registrationDate: formatDate(profile.registrationDate),
    firstDeposit: (profile.firstDeposit || ''),
    totalDeposited: euro(profile.totalDeposited),
    birthplace: [profile.nationality, profile.birthplace].filter(Boolean).join(' - '),
    reputationalIndicators: tokens,
    conclusions: src.conclusionAndRiskLevel || src.conclusions || ''
  };
}

export async function exportToDocx(state: AnyState): Promise<Blob> {
  const tplUrl = state?.reviewType === 'adverse' ? adverseTpl : fullTpl;
  const res = await fetch(tplUrl); const buf = await res.arrayBuffer();

  const zip = new PizZip(buf);
  const imgMod = new ImageModule({
    centered: false,
    getImage() { return ''; },
    getSize() { return [100,100] as [number, number]; }
  });

  const doc = new Docxtemplater(zip, { modules: [imgMod], nullGetter() { return ''; } });
  const data = state?.reviewType === 'adverse' ? buildAdverseData(state) : buildFullData(state);
  doc.setData(data);
  try { doc.render(); } catch (e) { console.error('Docxtemplater render error', e); throw e; }

  const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const finalBlob = await postprocessDocxRich(blob);
  return finalBlob;
}

export async function downloadDocx(state: AnyState) {
  const blob = await exportToDocx(state);
  const date = new Date().toISOString().slice(0, 10);
  const prefix = state?.reviewType === 'adverse' ? 'AdverseReview' : 'FullReview';
  (saveAs as any)(blob, `${prefix}_${date}.docx`);
}
