import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import adverseTplUrl from '@/assets/templates/Adverse.docx?url';
import fullTplUrl from '@/assets/templates/FullReview.docx?url';
import type { FormState, AdverseReviewData, FullReviewData } from '../context/FormContext';
import { postprocessDocxRich } from '../utils/postprocessDocxRich';

function toItDate(s: string | undefined): string {
  if (!s) return '';
  try { const d = new Date(s); return d.toLocaleDateString('it-IT'); } catch { return s; }
}

async function loadArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

// Encode HTML content for Word processing with special markers
function encodeHtmlForDocx(html: string, fieldName: string): string {
  if (!html || html.trim() === '') return '';
  try {
    const encoded = btoa(unescape(encodeURIComponent(html)));
    return `{{${fieldName}_HTML_START}}${encoded}{{${fieldName}_HTML_END}}`;
  } catch (e) {
    console.error('Error encoding HTML:', e);
    return html; // fallback to plain text
  }
}

function mapAdverse(d: AdverseReviewData) {
  const cp = d.customerProfile || ({} as any);
  return {
    agent: d.agentName || '',
    reviewDate: toItDate(d.reviewDate),
    registrationDate: toItDate(cp.registrationDate),
    firstDeposit: cp.firstDeposit || '',
    totalDeposited: cp.totalDeposited || '',
    totalWithdrawn: cp.totalWithdrawn || '',
    balance: cp.balance || '',
    age: cp.age || '',
    birthplace: cp.birthplace || '',
    latestLogin: cp.latestLogin || '',
    latestLoginIP: cp.latestLoginIP || '',
    latestLoginNationality: cp.latestLoginNationality || '',
    documentsSent: Array.isArray(cp.documentsSent) ? cp.documentsSent.map(x => ({ document: x.document || '', status: x.status || '', info: x.info || '' })) : [],
    reputationalIndicators: (() => {
      // Combine both plain text and rich text indicators
      const plainLines = (d.reputationalIndicators || '').split('\n').map(s => s.trim()).filter(Boolean);
      const richLines = Array.isArray(d.reputationalIndicatorsRich) ? d.reputationalIndicatorsRich : [];
      
      // If we have rich text, use it; otherwise use plain text
      if (richLines.length > 0) {
        return richLines.join('');
      }
      return plainLines;
    })(),
    reputationalIndicatorsRich: Array.isArray(d.reputationalIndicatorsRich) ? d.reputationalIndicatorsRich.join('') : '',
    conclusions: encodeHtmlForDocx(d.conclusion || '', 'conclusions'),
    attachments: Array.isArray(d.attachments) ? d.attachments.map(a => a.name || '') : [],
  };
}

function mapFull(d: FullReviewData) {
  const cp = d.customerProfile || ({} as any);
  const rich = Array.isArray(d.reputationalIndicatorsRich)
    ? d.reputationalIndicatorsRich
    : (d.reputationalIndicatorsHtml ? d.reputationalIndicatorsHtml.split(/<hr\s*\/?>/i).map(s => s.trim()).filter(Boolean) : []);

  return {
    reasonForReview: encodeHtmlForDocx(d.reasonForReview || '', 'reasonForReview'),
    agent: d.reviewPerformedBy || '',
    reviewDate: toItDate(d.reviewDate),
    registrationDate: toItDate(cp.registrationDate),
    firstDeposit: cp.firstDeposit || '',
    totalDeposited: cp.totalDeposited || '',
    birthplace: cp.birthplace || '',
    // payments
    paymentMethods: Array.isArray(d.paymentMethods) ? d.paymentMethods.map(x => ({ nameNumber: x.nameNumber || '', type: x.type || '', additionalInfo: x.additionalInfo || '' })) : [],
    thirdPartyPaymentMethods: Array.isArray(d.thirdPartyPaymentMethods) ? d.thirdPartyPaymentMethods.map(x => ({ nameNumber: x.nameNumber || '', type: x.type || '', additionalInfo: x.additionalInfo || '' })) : [],
    additionalActivities: Array.isArray(d.additionalActivities) ? d.additionalActivities.map(x => ({ type: x.type || '', additionalInfo: x.additionalInfo || '' })) : [],
    reputationalIndicatorsRich: Array.isArray(rich) ? rich.join('') : '',
    // Also put rich content in the main reputationalIndicators field for template compatibility
    reputationalIndicators: (() => {
      const plainLines = ((d as any).reputationalIndicators || '').split('\n').map(s => s.trim()).filter(Boolean);
      const richLines = Array.isArray(rich) ? rich : [];
      
      // If we have rich text, use it; otherwise use plain text
      if (richLines.length > 0) {
        return richLines.join('');
      }
      return plainLines;
    })(),
    // sources section (if template has it as individual fields, use first; otherwise they can be included in rich blocks)
    authorLabel: d.reputationalSources && d.reputationalSources[0] ? (d.reputationalSources[0].author || d.reputationalSources[0].url || '') : '',
    link: d.reputationalSources && d.reputationalSources[0] ? (d.reputationalSources[0].url || '') : '',
    conclusions: encodeHtmlForDocx(d.conclusionAndRiskLevel || '', 'conclusions'),
    followUpActions: encodeHtmlForDocx(d.followUpActions || '', 'followUpActions'),
    attachments: Array.isArray(d.attachments) ? d.attachments.map(a => a.name || '') : [],
  };
}

export async function exportToDocx(state: FormState): Promise<Blob> {
  const isAdverse = state.reviewType === 'adverse';
  const url = isAdverse ? adverseTplUrl : fullTplUrl;
  const ab = await loadArrayBuffer(url);
  const zip = new PizZip(ab);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const data = isAdverse ? mapAdverse(state.adverseData) : mapFull(state.fullData);
  doc.setData(data);
  try { doc.render(); } catch (e) { console.error('Docxtemplater render error', e); throw e; }

  const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  // Convert inline HTML pieces and raw links into proper Word runs/hyperlinks
  const finalBlob = await postprocessDocxRich(out);
  return finalBlob;
}

// Back-compat for existing imports
export async function exportDocxFromHtml(html: string): Promise<Blob> {
  const fake: FormState = {
    reviewType: 'adverse',
    adverseData: {
      agentName: '',
      reviewDate: new Date().toISOString().slice(0,10),
      customerProfile: { registrationDate: '', documentsSent: [], firstDeposit: '', totalDeposited: '', totalWithdrawn: '', balance: '', age: '', birthplace: '', accountHistory: '', latestLogin: '', latestLoginIP: '', latestLoginNationality: '', latestLoginNationalityOther: '' },
      reputationalIndicators: '',
      reputationalSources: [],
      conclusion: '',
      attachments: [],
      reputationalIndicatorsHtml: html,
      reputationalIndicatorsRich: [html],
    },
    fullData: {} as any,
    completedSections: {},
    currentSection: 'review-type',
  };
  return exportToDocx(fake);
}

export function composeHtml(_state: any): string { return ''; }
