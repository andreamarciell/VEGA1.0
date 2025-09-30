import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import adverseTplUrl from '@/assets/templates/Adverse.docx?url';
import fullTplUrl from '@/assets/templates/FullReview.docx?url';
import type { FormState, AdverseReviewData, FullReviewData } from '../context/FormContext';
import { postprocessDocxRich } from '../utils/postprocessDocxRich';

function toItDate(s: string | undefined): string {
  if (!s) return '';
  
  // Handle Italian date format (DD/MM/YYYY) - if it matches this pattern, parse it correctly
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [day, month, year] = s.split('/');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('it-IT');
    }
  }
  
  try { 
    const d = new Date(s); 
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('it-IT'); 
  } catch { 
    return s; 
  }
}

async function loadArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getImageDimensions(dataUrl: string): Promise<[number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve([img.naturalWidth, img.naturalHeight]);
    };
    img.onerror = () => {
      // Fallback to default size if image fails to load
      resolve([600, 400]);
    };
    img.src = dataUrl;
  });
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

function mapAdverse(d: AdverseReviewData, imageDimensions?: Map<string, [number, number]>) {
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
      // The template expects an array, not a string
      const plainLines = (d.reputationalIndicators || '').split('\n').map(s => s.trim()).filter(Boolean);
      const richLines = Array.isArray(d.reputationalIndicatorsRich) ? d.reputationalIndicatorsRich : [];
      
      // If we have rich text, use it as array; otherwise use plain text as array
      if (richLines.length > 0) {
        return richLines; // Return as array for template
      }
      return plainLines; // Return as array for template
    })(),
    reputationalIndicatorsRich: Array.isArray(d.reputationalIndicatorsRich) ? d.reputationalIndicatorsRich.join('') : '',
    conclusions: encodeHtmlForDocx(d.conclusion || '', 'conclusions'),
    attachments: Array.isArray(d.attachments) ? d.attachments.map(a => {
      const dimensions = imageDimensions?.get(a.dataUrl) || [600, 400];
      return { 
        image: a.dataUrl,
        width: dimensions[0],
        height: dimensions[1]
      };
    }) : [],
  };
}

function mapFull(d: FullReviewData, imageDimensions?: Map<string, [number, number]>) {
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
      
      // If we have rich text, use it as array; otherwise use plain text as array
      if (richLines.length > 0) {
        return richLines; // Return as array for template
      }
      return plainLines; // Return as array for template
    })(),
    // sources section (if template has it as individual fields, use first; otherwise they can be included in rich blocks)
    authorLabel: '',
    link: '',
    conclusions: encodeHtmlForDocx(d.conclusionAndRiskLevel || '', 'conclusions'),
    followUpActions: encodeHtmlForDocx(d.followUpActions || '', 'followUpActions'),
    attachments: Array.isArray(d.attachments) ? d.attachments.map(a => {
      const dimensions = imageDimensions?.get(a.dataUrl) || [600, 400];
      return { 
        image: a.dataUrl,
        width: dimensions[0],
        height: dimensions[1]
      };
    }) : [],
  };
}

// Global variable to store current image dimensions for ImageModule
let currentImageDimensions: [number, number] = [600, 400];

export async function exportToDocx(state: FormState): Promise<Blob> {
  const isAdverse = state.reviewType === 'adverse';
  const url = isAdverse ? adverseTplUrl : fullTplUrl;
  const ab = await loadArrayBuffer(url);
  const zip = new PizZip(ab);

  // Pre-process attachments to get their dimensions
  const attachments = isAdverse ? state.adverseData.attachments : state.fullData.attachments;
  const imageDimensions = new Map<string, [number, number]>();
  
  if (Array.isArray(attachments)) {
    for (const attachment of attachments) {
      if (attachment.dataUrl) {
        const dimensions = await getImageDimensions(attachment.dataUrl);
        imageDimensions.set(attachment.dataUrl, dimensions);
      }
    }
  }

  const imageModule = new ImageModule({
    centered: true,
    getImage: (tagValue: any) => {
      if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
        // Set current dimensions for this image
        const dimensions = imageDimensions.get(tagValue) || [600, 400];
        currentImageDimensions = dimensions;
        return dataUrlToArrayBuffer(tagValue);
      }
      return tagValue as ArrayBuffer;
    },
    getSize: () => {
      return currentImageDimensions;
    },
  });

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });

  const data = isAdverse ? mapAdverse(state.adverseData, imageDimensions) : mapFull(state.fullData, imageDimensions);
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
      customerProfile: { registrationDate: '', documentsSent: [], firstDeposit: '', totalDeposited: '', totalWithdrawn: '', balance: '', age: '', nationality: '', birthplace: '', accessAttempts: '', activityBetween22And6: '', accountHistory: '' },
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
