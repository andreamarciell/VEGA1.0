import { FormState } from '../context/FormContext';
import { sanitizeHtmlBasic } from '../utils/sanitizeHtml';

export function renderCustomerProfileTable(p:any){ if(!p) return ''; const r:string[]=[];
const add=(l:string,v:any)=>{ if(v==null||v==='') return; r.push(`<tr><th style="width:35%">${l}</th><td>${escapeHtml(String(v))}</td></tr>`); };
add('Data Registrazione',p.registrationDate);
if(Array.isArray(p.documentsSent)&&p.documentsSent.length){ const docs=p.documentsSent.map((d:any)=>`${escapeHtml(d.document)} — ${escapeHtml(d.status)} — ${escapeHtml(d.info||'')}`).join('<br>'); r.push(`<tr><th>Documenti Inviati</th><td>${docs}</td></tr>`); }
add('Primo Deposito',p.firstDeposit); add('Totale Depositato',p.totalDeposited); add('Totale Prelevato',p.totalWithdrawn);
add('Saldo',p.balance); add('Età',p.age); add('Occupazione',p.occupation); add('Reddito Stimato',p.estimatedIncome);
add('Nazionalità',p.nationality); add('Residenza',p.residence); return r.length?`<table><tbody>${r.join('')}</tbody></table>`:''; }

export function renderPaymentMethods(list:any[]){ if(!Array.isArray(list)||!list.length)return ''; const rows=list.map(p=>`<tr><td>${escapeHtml(p.method||'')}</td><td>${escapeHtml(p.cardholder||'')}</td><td>${escapeHtml(p.details||'')}</td></tr>`); return `<table><thead><tr><th>Metodo</th><th>Intestatario</th><th>Dettagli</th></tr></thead><tbody>${rows.join('')}</tbody></table>`; }
export function renderThirdPartyPayments(list:any[]){ if(!Array.isArray(list)||!list.length)return ''; const rows=list.map(p=>`<tr><td>${escapeHtml(p.method||'')}</td><td>${escapeHtml(p.owner||'')}</td><td>${escapeHtml(p.relationship||'')}</td></tr>`); return `<table><thead><tr><th>Metodo</th><th>Proprietario</th><th>Relazione</th></tr></thead><tbody>${rows.join('')}</tbody></table>`; }
export function renderAdditionalActivities(list:any[]){ if(!Array.isArray(list)||!list.length)return ''; const rows=list.map(a=>`<tr><td>${escapeHtml(a.activity||'')}</td><td>${escapeHtml(a.description||'')}</td><td>${escapeHtml(a.additionalInfo||'')}</td></tr>`); return `<table><thead><tr><th>Attività</th><th>Descrizione</th><th>Info Aggiuntive</th></tr></thead><tbody>${rows.join('')}</tbody></table>`; }

export function renderReputationalIndicators(state:FormState){ const html=(state.reviewType==='adverse'?(state.adverseData as any).reputationalIndicatorsHtml:(state.fullData as any).reputationalIndicatorsHtml) as string|undefined; if(html&&html.trim()) return sanitizeHtmlBasic(html);
const raw=(state.reviewType==='adverse'?state.adverseData.reputationalIndicators:state.fullData.reputationalIndicators)||''; const sources=(state.reviewType==='adverse'?(state.adverseData as any).reputationalSources:(state.fullData as any).reputationalSources)||[];
const items=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean); const blocks:string[]=[]; items.forEach((line,idx)=>{ const s=sources[idx]||{}; const url=(s.url||'').trim(); const author=(s.author||'').trim(); const anchor=url?`<a href="${escapeHtml(url)}" rel="noreferrer noopener">${escapeHtml(author||url)}</a>`:escapeHtml(author||''); const prefix="Secondo l'articolo di "; let suffix=line; if(suffix.startsWith(prefix)){ let after=suffix.slice(prefix.length); if(author && after.startsWith(author)) after=after.slice(author.length); suffix=after; } blocks.push(`<section class="indicatore"><p><strong>Secondo l'articolo di</strong> ${anchor} ${escapeHtml(suffix)}</p></section><hr/>`); }); return blocks.join('\n'); }

export function renderAttachments(imgs:any[]){ if(!Array.isArray(imgs)||!imgs.length) return ''; return imgs.map((a,i)=>`<figure><img src="${a.dataUrl}" alt="${escapeHtml(a.name||('allegato '+(i+1)))}" /><figcaption class="small">${escapeHtml(a.name||'')}</figcaption></figure>`).join('\n'); }
export function escapeHtml(s:string){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }