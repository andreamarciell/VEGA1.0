export function renderTemplate(hbs: string, data: Record<string, any>): string {
  let out = hbs.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_m, k) => String(get(data,k) ?? ''));
  out = out.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m,k,inner)=> get(data,k) ? inner : '');
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m,k)=> escapeHtml(String(get(data,k) ?? '')));
  return out;
}
function get(o:any, p:string){ return p.split('.').reduce((x,k)=>x?x[k]:undefined, o); }
function escapeHtml(s:string){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'); }