// src/features/review/utils/docx.ts
// back-compat export + robust template input + real hyperlinks
// @ts-nocheck
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escAttr=(s:string)=>esc(s).replace(/"/g,"&quot;");

export function htmlToPlainKeepUrls(h:string){if(!h)return"";let s=String(h);
s=s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,(_m,u,l)=>{const lbl=String(l).replace(/<[^>]+>/g,"").trim()||u;return `${lbl} (${u})`;});
s=s.replace(/<\s*br\s*\/?>(?i)/g,"\n").replace(/<\/p\s*>(?i)/g,"\n").replace(/<[^>]+>/g,"").replace(/\n{3,}/g,"\n\n");return s.trim();}

export function postprocessMakeUrlsHyperlinks(zip:PizZip){let xml=zip.file("word/document.xml")?.asText();let rels=zip.file("word/_rels/document.xml.rels")?.asText();if(!xml||!rels)return zip;
const ids=Array.from(rels.matchAll(/Id="rId(\d+)"/g)).map(m=>Number(m[1])||0);let next=Math.max(1000,...(ids.length?ids:[0]))+1;const nextRid=()=>`rId${next++}`;
const labelUrlRe=/([^\(\)\n\r]{1,200}?)\s*\((https?:\/\/[^\s<>"')\]]+)\)/g;const urlOnlyRe=/(https?:\/\/[^\s<>"')\]]+)/g;
xml=xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g,(para)=>{let block=para,prev;do{prev=block;block=block.replace(/<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr>[\s\S]*?<\/w:rPr>\s*)?<w:t\b[^>]*>/g,"");}while(block!==prev);
block=block.replace(/<w:r\b[\s\S]*?<w:t\b[^>]*>([\s\S]*?)<\/w:t>[\s\S]*?<\/w:r>/g,(run,tText)=>{const text=tText as string;let out="",idx=0,m:any;
while((m=labelUrlRe.exec(text))){const pre=text.slice(idx,m.index),label=m[1].trim(),url=m[2];if(pre)out+=`<w:r><w:t>${esc(pre)}</w:t></w:r>`;const rId=nextRid();
rels=rels.replace(/<\/Relationships>\s*$/,
`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(url)}" TargetMode="External"/></Relationships>`);
out+=`<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${esc(label||url)}</w:t></w:r></w:hyperlink>`;idx=m.index+m[0].length;}
const tail=text.slice(idx);if(tail){let last=0,part="",m2:any;while((m2=urlOnlyRe.exec(tail))){const pre2=tail.slice(last,m2.index),url=m2[1];if(pre2)part+=`<w:r><w:t>${esc(pre2)}</w:t></w:r>`;const rId=nextRid();
rels=rels.replace(/<\/Relationships>\s*$/,
`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(url)}" TargetMode="External"/></Relationships>`);
part+=`<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr><w:t>${esc(url)}</w:t></w:r></w:hyperlink>`;last=m2.index+url.length;}
const tailTail=tail.slice(last);if(tailTail)part+=`<w:r><w:t>${esc(tailTail)}</w:t></w:r>`;out+=part;}return out||run;});return block;});
zip.file("word/document.xml",xml);zip.file("word/_rels/document.xml.rels",rels);return zip;}

async function ensureArrayBuffer(input:any):Promise<ArrayBuffer>{if(input&&typeof input.then==="function"){return ensureArrayBuffer(await input);}
if(input&&typeof input==="object"&&!("byteLength"in input)&&!("arrayBuffer"in input)){const candidates=[input.templateBinary,input.templateArrayBuffer,input.template,input.templateUrl,input.url,input.href,input.src,input.path];for(const c of candidates){if(c)return ensureArrayBuffer(c);}
for(const k of Object.keys(input)){const v=input[k];if(typeof v==="string"&&/\.docx(\?.*)?$/i.test(v))return ensureArrayBuffer(v);if(v&&typeof v==="object"&&(v.name?.endsWith?.(".docx")||v.type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"))return ensureArrayBuffer(v);}}
if(input instanceof ArrayBuffer)return input;if(typeof Uint8Array!=="undefined"&&input instanceof Uint8Array)return input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
if(input&&typeof input.arrayBuffer==="function")return await input.arrayBuffer();
if(typeof input==="string"){if(/^[A-Za-z0-9+/=\s]+$/.test(input)&&input.length%4===0&&input.length>512){const bin=typeof atob!=="undefined"?atob(input):Buffer.from(input,"base64").toString("binary");const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes.buffer;}
if(/^data:/.test(input)){const b64=input.split(",")[1]||"";const bin=typeof atob!=="undefined"?atob(b64):Buffer.from(b64,"base64").toString("binary");const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes.buffer;}
if(typeof fetch==="function"&&(/^(https?:)/.test(input)||input.startsWith("/")||input.startsWith("./")||input.startsWith("../"))){const res=await fetch(input);return await res.arrayBuffer();}}
throw new Error("Unsupported template input for PizZip(data). Expected ArrayBuffer/Uint8Array/Blob/File/URL/dataURI");}

export async function renderDocxWithHyperlinks(templateInput:any,data:any,imageOpts:any={}):Promise<Blob>{const tpl=await ensureArrayBuffer(templateInput);const zip=new PizZip(tpl as any);
const imageModule=new ImageModule(imageOpts as any);const safe=JSON.parse(JSON.stringify(data));const walk=(o:any)=>{if(!o||typeof o!=="object")return;for(const k of Object.keys(o)){const v=o[k];
if(typeof v==="string"&&/<a\b[^>]*href=/i.test(v))o[k]=htmlToPlainKeepUrls(v);else if(Array.isArray(v))o[k]=v.map(it=>typeof it==="string"?htmlToPlainKeepUrls(it):(typeof it==="object"?(walk(it),it):it));else if(typeof v==="object")walk(v);}};walk(safe);
const doc=new Docxtemplater(zip,{paragraphLoop:true,linebreaks:true,replaceAll:true,modules:[imageModule]});doc.setData(safe);doc.render();const outZip=postprocessMakeUrlsHyperlinks(doc.getZip());
return outZip.generate({type:"blob"}) as Blob;}

export async function exportToDocx(a:any,b?:any,c?:any):Promise<Blob>{if(arguments.length===1&&a&&typeof a==="object"&&(a.template||a.templateBinary||a.templateArrayBuffer||a.templateUrl||a.url||a.href||a.src||a.path)){const {template,templateBinary,templateArrayBuffer,templateUrl,url,href,src,path,data,imageOpts}=a as any;
const tpl=templateBinary??templateArrayBuffer??template??templateUrl??url??href??src??path;return renderDocxWithHyperlinks(tpl,data,imageOpts);}return renderDocxWithHyperlinks(a,b,c);}