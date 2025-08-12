
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { FormState } from '../context/FormContext';

/**
 * Formatta valuta in stile italiano con due decimali e spazio unbreakable (€ dopo la cifra).
 */
function formatCurrency(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00A0€';
}

/** Converte "YYYY-MM-DD" in "DD/MM/YYYY". */
function formatDate(raw?: string): string {
  if (!raw) return '';
  // Accept ISO (YYYY-MM-DD) or already formatted DD/MM/YYYY or any parsable date string.
  // 1. If already in DD/MM/YYYY return as‑is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  // 2. If ISO split and reorder
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  // 3. Fallback: try Date parsing
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2,'0');
    const m = String(parsed.getMonth()+1).padStart(2,'0');
    const y = String(parsed.getFullYear());
    return `${d}/${m}/${y}`;
  }
  // 4. If all fails return raw unchanged
  return raw;
}

/**
 * Garantisce che il valore sia sempre un array.
 * Se il parametro è undefined, null o non è un array, restituisce un array vuoto.
 * Se l'array è presente ma vuoto, viene restituito così com'è (i template gestiscono il loop vuoto).
 */
function safeArray<T>(arr?: T[] | null): T[] {
  return Array.isArray(arr) ? arr : [];
}


/**
 * Costruisce l'oggetto dati compatibile con i tag del template.
 */
function buildTemplateDataAdverse(state: FormState) {
  // Scegli il ramo dei dati in base al tipo di review
  const src = state.adverseData;

  // NB: il template attuale (Adverse.docx) usa questi tag;
  // se si vorrà supportare FullReview.docx basterà estendere qui.
  const profile = src.customerProfile;

  return {
    agent:               (src as any).agentName ?? (src as any).reviewPerformedBy ?? '',
    reviewDate:          formatDate(src.reviewDate),

    // Profilo cliente
    registrationDate:    formatDate(profile?.registrationDate),
documentsSent:       safeArray(profile?.documentsSent).map(d => ({
      document: d.document,
      status: d.status,
      info: d.info && d.info.trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit:        formatCurrency(profile?.firstDeposit),
    totalDeposited:      formatCurrency(profile?.totalDeposited),
    age:                 profile?.age ?? '',
    birthplace:          [profile?.nationality, profile?.birthplace].filter(Boolean).join(' - '),
    latestLogin:         formatDate(profile?.latestLogin),
    latestLoginIP:       profile?.latestLoginIP ?? '',
    latestLoginNationality: profile?.latestLoginNationality ?? '',

    reasonForReview:       (src as any).reasonForReview ?? '',
    paymentMethods:        safeArray((src as any).paymentMethods).map((p: any) => ({
      nameNumber:     p.nameNumber,
      type:           p.type,
      additionalInfo: p.additionalInfo,
    })) ?? [],
    thirdPartyPaymentMethods: safeArray((src as any).thirdPartyPaymentMethods).map((p: any) => ({
      nameNumber:     p.nameNumber,
      type:           p.type,
      additionalInfo: p.additionalInfo,
    })) ?? [],
    additionalActivities: safeArray((src as any).additionalActivities).map((a: any) => ({
      type:           a.type,
      additionalInfo: a.additionalInfo,
    })) ?? [],
    // Indicatori & conclusione
    reputationalIndicators: ((src as any).reputationalIndicators ?? '').split(/\n+/).filter(Boolean),
    conclusions:             (src as any).conclusionAndRiskLevel ?? (src as any).conclusions ?? (src as any).conclusion ?? '',
  };
}

function buildTemplateDataFull(state: FormState) {
  // Scegli il ramo dei dati in base al tipo di review
  const src = state.fullData;

  // NB: Mapping per FullReview.docx
  const profile = src.customerProfile;

  return {
    agent:               (src as any).agentName ?? (src as any).reviewPerformedBy ?? '',
    reviewDate:          formatDate(src.reviewDate),

    // Profilo cliente
    registrationDate:    formatDate(profile?.registrationDate),
documentsSent:       safeArray(profile?.documentsSent).map(d => ({
      document: d.document,
      status: d.status,
      info: d.info && d.info.trim() !== '' ? d.info : 'Non sono presenti ulteriori informazioni'
    })),
    firstDeposit:        formatCurrency(profile?.firstDeposit),
    totalDeposited:      formatCurrency(profile?.totalDeposited),
    age:                 profile?.age ?? '',
    birthplace:          [profile?.nationality, profile?.birthplace].filter(Boolean).join(' - '),
    latestLogin:         formatDate(profile?.latestLogin),
    latestLoginIP:       profile?.latestLoginIP ?? '',
    latestLoginNationality: profile?.latestLoginNationality ?? '',

    reasonForReview:       (src as any).reasonForReview ?? '',
    paymentMethods:        safeArray((src as any).paymentMethods).map((p: any) => ({
      nameNumber:     p.nameNumber,
      type:           p.type,
      additionalInfo: p.additionalInfo && p.additionalInfo.trim() !== '' ? p.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })) ?? [],
    thirdPartyPaymentMethods: safeArray((src as any).thirdPartyPaymentMethods).map((p: any) => ({
      nameNumber:     p.nameNumber,
      type:           p.type,
      additionalInfo: p.additionalInfo && p.additionalInfo.trim() !== '' ? p.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })) ?? [],
    additionalActivities: safeArray((src as any).additionalActivities).map((a: any) => ({
      type:           a.type,
      additionalInfo: a.additionalInfo && a.additionalInfo.trim() !== '' ? a.additionalInfo : 'Non sono presenti ulteriori informazioni',
    })) ?? [],
    // Indicatori & conclusione
    reputationalIndicators: ((src as any).reputationalIndicators ?? '').split(/\n+/).filter(Boolean),
    conclusions:             (src as any).conclusionAndRiskLevel ?? (src as any).conclusions ?? (src as any).conclusion ?? '',
  };
}


function buildTemplateData(state: FormState) {
  return state.reviewType === 'adverse'
    ? buildTemplateDataAdverse(state)
    : buildTemplateDataFull(state);
}


/**
 * Genera il DOCX compilato e restituisce un Blob.
 */
export async function exportToDocx(state: FormState): Promise<Blob> {
  const base = import.meta.env.BASE_URL || '/';
  const templateName = state.reviewType === 'adverse' ? 'Adverse.docx' : 'FullReview.docx';

  // Robust URL resolution: try absolute path first to avoid BASE_URL issues on Netlify
  const tryUrls = [
    `/templates/${templateName}`,
    `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/templates/${templateName}`,
  ];

  let arrayBuffer: ArrayBuffer | null = null;
  let lastStatus = 0;
  for (const url of tryUrls) {
    const resp = await fetch(url);
    lastStatus = resp.status;
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && !/text\/(html|plain)/i.test(ct)) {
      arrayBuffer = await resp.arrayBuffer();
      break;
    }
  }
  if (!arrayBuffer) {
    throw new Error(`Impossibile caricare il template ${templateName} (status ${lastStatus}). Assicurati che esista in /public/templates/`);
  }
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true , replaceAll: true });

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

/** Scarica subito il DOCX con un nome file sensato. */
export async function downloadDocx(state: FormState) {
  const blob = await exportToDocx(state);
  const date = new Date().toISOString().slice(0, 10);
  const prefix = state.reviewType === 'adverse' ? 'AdverseReview' : 'FullReview';
  saveAs(blob, `${prefix}_${date}.docx`);
}