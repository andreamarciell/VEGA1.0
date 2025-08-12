import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { saveAs } from 'file-saver';
import { FormState } from '../context/FormContext';
import adverseTpl from '@/assets/templates/Adverse.docx?url';
import fullTpl from '@/assets/templates/FullReview.docx?url';

function formatCurrency(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00A0€';
}

function formatDate(raw?: string): string {
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return raw;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yy = String(parsed.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function safeArray<T>(arr?: T[] | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function buildTemplateDataAdverse(state: FormState) {
  const src = state.adverseData;
  const profile = src.customerProfile;

  return {
    agent: (src as any).agentName ?? (src as any).reviewPerformedBy ?? '',
    reviewDate: formatDate(src.reviewDate),

    // Profilo cliente
    registrationDate: formatDate(profile?.registrationDate),
    documentsSent: safeArray(profile?.documentsSent).map(d => ({
      document: d.document,
      status: d.status,
      info: d.info && d.info.trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit: formatCurrency(profile?.firstDeposit),
    totalDeposited: formatCurrency(profile?.totalDeposited),
    totalWithdrawn: formatCurrency(profile?.totalWithdrawn),
    balance: formatCurrency(profile?.balance),
    age: profile?.age ?? '',
    birthplace: [profile?.nationality, profile?.birthplace].filter(Boolean).join(' - '),
    latestLogin: formatDate((profile as any)?.latestLogin),
    latestLoginIP: (profile as any)?.latestLoginIP ?? '',
    latestLoginNationality: (profile as any)?.latestLoginNationality ?? '',

    // Indicatori & conclusioni
    reputationalIndicators: ((src as any).reputationalIndicators ?? '').split(/\n+/).filter(Boolean),
    conclusions: (src as any).conclusion ?? '',

    // Allegati (immagini)
    attachments: (src as any).attachments ? (src as any).attachments.map((a: any) => ({ image: a.dataUrl })) : [],
  };
}

function buildTemplateDataFull(state: FormState) {
  const src = state.fullData;
  const profile = src.customerProfile;

  return {
    agent: (src as any).agentName ?? (src as any).reviewPerformedBy ?? '',
    reviewDate: formatDate(src.reviewDate),

    // Profilo cliente
    registrationDate: formatDate(profile?.registrationDate),
    documentsSent: safeArray(profile?.documentsSent).map(d => ({
      document: d.document,
      status: d.status,
      info: d.info && d.info.trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit: formatCurrency(profile?.firstDeposit),
    totalDeposited: formatCurrency(profile?.totalDeposited),
    totalWithdrawn: formatCurrency(profile?.totalWithdrawn),
    balance: formatCurrency(profile?.balance),
    age: profile?.age ?? '',
    birthplace: [profile?.nationality, profile?.birthplace].filter(Boolean).join(' - '),
    latestLogin: formatDate((profile as any)?.latestLogin),
    latestLoginIP: (profile as any)?.latestLoginIP ?? '',
    latestLoginNationality: (profile as any)?.latestLoginNationality ?? '',

    // Sezioni specifiche Full
    reasonForReview: (src as any).reasonForReview ?? '',
    paymentMethods: safeArray((src as any).paymentMethods).map((p: any) => ({
      nameNumber: p.nameNumber,
      type: p.type,
      additionalInfo: p.additionalInfo && p.additionalInfo.trim() !== '' ? p.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })),
    thirdPartyPaymentMethods: safeArray((src as any).thirdPartyPaymentMethods).map((p: any) => ({
      nameNumber: p.nameNumber,
      type: p.type,
      additionalInfo: p.additionalInfo && p.additionalInfo.trim() !== '' ? p.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })),
    additionalActivities: safeArray((src as any).additionalActivities).map((a: any) => ({
      type: a.type,
      additionalInfo: a.additionalInfo && a.additionalInfo.trim() !== '' ? a.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })),
    sourceOfFundsPrimary: (src as any).sourceOfFunds?.primary ?? '',
    sourceOfFundsSecondary: (src as any).sourceOfFunds?.secondary ?? '',
    sourceOfFundsDocumentation: (src as any).sourceOfFunds?.documentation ?? '',

    reputationalIndicators: ((src as any).reputationalIndicators ?? '').split(/\n+/).filter(Boolean),
    reputationalIndicatorCheck: (src as any).reputationalIndicatorCheck ?? '',
    conclusions: (src as any).conclusionAndRiskLevel ?? (src as any).conclusions ?? (src as any).conclusion ?? '',
    followUpActions: (src as any).followUpActions ?? '',
    backgroundInformation: safeArray((src as any).backgroundInformation).map((b: any) => ({
      source: b.source,
      type: b.type,
      additionalInfo: b.additionalInfo && b.additionalInfo.trim() !== '' ? b.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })),

    // Allegati (immagini)
    attachments: (src as any).attachments ? (src as any).attachments.map((a: any) => ({ image: a.dataUrl })) : [],
  };
}

function buildTemplateData(state: FormState) {
  return state.reviewType === 'adverse' ? buildTemplateDataAdverse(state) : buildTemplateDataFull(state);
}

export async function exportToDocx(state: FormState): Promise<Blob> {
  const templateName = state.reviewType === 'adverse' ? 'Adverse.docx' : 'FullReview.docx';
  const templateUrl  = state.reviewType === 'adverse' ? adverseTpl : fullTpl;

  const resp = await fetch(templateUrl);
  if (!resp.ok) {
    throw new Error(`Impossibile caricare il template ${templateName} (HTTP ${resp.status}). Assicurati che esista in src/assets/templates/`);
  }
  const ct = resp.headers.get('content-type') || '';
  if (/text\/(html|plain)/i.test(ct)) {
    throw new Error(`Risposta non valida per ${templateName}: content-type=${ct}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const imageModule = new ImageModule({
    centered: true,
    getImage: (tagValue: any) => {
      if (typeof tagValue === 'string' && tagValue.startsWith('data:')) return dataUrlToArrayBuffer(tagValue);
      return tagValue as ArrayBuffer;
    },
    getSize: () => [600, 400],
  });

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, replaceAll: true });
  (doc as any).attachModule(imageModule);

  const data = buildTemplateData(state);

  try {
    doc.render(data);
  } catch (error) {
    console.error('Docxtemplater render failed:', error);
    throw error;
  }

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function downloadDocx(state: FormState) {
  const blob = await exportToDocx(state);
  const date = new Date().toISOString().slice(0, 10);
  const prefix = state.reviewType === 'adverse' ? 'AdverseReview' : 'FullReview';
  saveAs(blob, `${prefix}_${date}.docx`);
}