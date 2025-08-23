// DOCX export via html-to-docx (dynamic import for bundler compatibility)
import { FormState } from '../context/FormContext';
import { renderTemplate } from '../utils/template';
import baseTpl from '../templates/base.hbs?raw';
import { renderCustomerProfileTable, renderPaymentMethods, renderThirdPartyPayments, renderAdditionalActivities, renderReputationalIndicators, renderAttachments } from '../renderers/sections';

export async function exportDocxFromHtml(html: string): Promise<Blob> {
  let HTMLtoDOCX: any;
  try {
    ({ default: HTMLtoDOCX } = await import('html-to-docx'));
  } catch (e) {
    // fallback explicit ESM path for some bundlers
    ({ default: HTMLtoDOCX } = await import('html-to-docx/dist/html-to-docx.esm.js'));
  }
  const buffer = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    header: true,
    pageNumber: false,
  });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function composeHtml(state: FormState): string {
  const title = state.reviewType === 'adverse' ? 'Adverse Media Review' : 'Full Review';
  const header = `<h1>${title}</h1>`;
  const whenBy = state.reviewType === 'adverse'
    ? `<p class="small"><strong>Agente:</strong> ${escapeHtml(state.adverseData.agentName || '')} — <strong>Data:</strong> ${escapeHtml(state.adverseData.reviewDate || '')}</p>`
    : `<p class="small"><strong>Eseguita da:</strong> ${escapeHtml(state.fullData.reviewPerformedBy || '')} — <strong>Data:</strong> ${escapeHtml(state.fullData.reviewDate || '')}</p>`;

  const profile = renderCustomerProfileTable(state.reviewType === 'adverse' ? state.adverseData.customerProfile : state.fullData.customerProfile);
  const payments = state.reviewType === 'adverse' ? '' : renderPaymentMethods(state.fullData.paymentMethods);
  const third = state.reviewType === 'adverse' ? '' : renderThirdPartyPayments(state.fullData.thirdPartyPaymentMethods);
  const activities = state.reviewType === 'adverse' ? '' : renderAdditionalActivities(state.fullData.additionalActivities);
  const reputational = renderReputationalIndicators(state);
  const conclusion = state.reviewType === 'adverse' ? (state.adverseData.conclusion || '') : (state.fullData.conclusionAndRiskLevel || '');
  const attachments = state.reviewType === 'adverse' ? renderAttachments(state.adverseData.attachments || []) : renderAttachments(state.fullData.attachments || []);

  const body = [
    header,
    whenBy,
    '<h2>Profilo Cliente</h2>',
    profile,
    (state.reviewType === 'full' ? '<div class="page-break"></div><h2>Metodi di Pagamento</h2>' + payments : ''),
    (state.reviewType === 'full' ? '<h2>Metodi di Pagamento di Terzi</h2>' + third : ''),
    (state.reviewType === 'full' ? '<h2>Attività Aggiuntive</h2>' + activities : ''),
    '<div class="page-break"></div><h2>Indicatori Reputazionali</h2>',
    reputational,
    '<h2>Conclusione</h2>',
    `<div>${conclusion}</div>`,
    attachments ? '<div class="page-break"></div><h2>Allegati</h2>' + attachments : '',
  ].filter(Boolean).join('\n');

  return renderTemplate(baseTpl, { title, body, logoSrc: '', generatedAt: new Date().toLocaleString('it-IT') });
}

export async function exportToDocx(state: FormState): Promise<Blob> {
  const html = composeHtml(state);
  return exportDocxFromHtml(html);
}

function escapeHtml(s: string) {
  return (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}