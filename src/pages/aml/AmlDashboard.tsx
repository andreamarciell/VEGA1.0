import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
// @ts-ignore
import { Chart, registerables } from 'chart.js';
import { useAmlStore } from '@/store/amlStore';
import { MovementsTable } from '@/components/aml/MovementsTable';
import { CardsTable } from '@/components/aml/CardsTable';
Chart.register(...registerables);

// Define types based on the original repository
interface Transaction {
  data: Date;
  dataStr: string;
  causale: string;
  importo: number;
  importo_raw: any;
  TSN?: string;
  "TS extension"?: string;
}
interface Frazionata {
  start: string;
  end: string;
  total: number;
  transactions: Array<{
    date: string;
    amount: number;
    causale: string;
  }>;
}
interface AmlResults {
  riskScore: number;
  riskLevel: string;
  motivations: string[];
  frazionate: Frazionata[];
  patterns: string[];
  alerts: string[];
  sessions: Array<{
    timestamp: string;
  }>;
}
const AmlDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessionTimestamps, setSessionTimestamps] = useState<Array<{
    timestamp: string;
  }>>([]);
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    title: string;
    transactions: any[];
  }>({
    isOpen: false,
    title: '',
    transactions: []
  });
  const [results, setResults] = useState<AmlResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('frazionate');
  const [cardFile, setCardFile] = useState<File | null>(null);
  let includeCard: HTMLInputElement | null = null;  // legacy DOM checkbox ref (may stay null)
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const transactionResults = useAmlStore(state => state.transactionResults);
  const setTransactionResults = useAmlStore(state => state.setTransactionResults);
  const clearStore = useAmlStore(state => state.clear);
  const [accessFile, setAccessFile] = useState<File | null>(null);
  const [isAnalyzingAccess, setIsAnalyzingAccess] = useState(false);
  const accessResults = useAmlStore(state => state.accessResults);
  const setAccessResults = useAmlStore(state => state.setAccessResults);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const causaliChartRef = useRef<HTMLCanvasElement>(null);
  const hourHeatmapRef = useRef<HTMLCanvasElement>(null);

  // Original transactions.js logic wrapped in React useEffect
  useEffect(() => {
    // Wait for DOM to be ready
    const initializeTransactionsLogic = () => {
      const script = document.createElement('script');
      script.textContent = `
/* ---------------------------------------------------------------------------
 * transactions.js - Toppery AML  (Depositi / Prelievi / Carte) - 15 lug 2025
 * ---------------------------------------------------------------------------
 * Changelog 15/07/2025
 * • Checkbox "Includi Transazioni Carte" per escludere / includere il file
 *   Excel delle carte. Se deselezionato l'analisi può essere eseguita caricando
 *   solo i file di Depositi e Prelievi.
 * • Depositi & Prelievi: invece dei "Ultimi 30 gg" ora vengono mostrati gli
 *   importi relativi ai 3 mesi completi precedenti all'ultimo movimento
 *   disponibile (p. es. ultimo movimento 15 lug 2025 => mesi giugno, maggio,
 *   aprile 2025).
 * • Transazioni Carte: aggiunto menù a tendina che consente di filtrare
 *   dinamicamente il report per singolo mese oppure visualizzare il totale.
 *   Il menù viene popolato con tutti i mesi presenti nel file caricato.
 * ------------------------------------------------------------------------- */

"use strict";

/* ---- fallback-ID helper ------------------------------------------------ */
function $(primary, fallback) {
  return document.getElementById(primary) || (fallback ? document.getElementById(fallback) : null);
}

/* --------------------------- DOM references ----------------------------- */
const cardInput      = $('cardFileInput',  'transactionsFileInput');
const depositInput   = $('depositFileInput');
const withdrawInput  = $('withdrawFileInput');
const analyzeBtn     = $('analyzeBtn',     'analyzeTransactionsBtn');

const depositResult  = document.getElementById('depositResult');
const withdrawResult = document.getElementById('withdrawResult');
const cardResult     = document.getElementById('transactionsResult');

/* ---------------- dinamically inject checkbox -------------------------- */
// legacy DOM removed let includeCard = document.getElementById('includeCardCheckbox');
if(cardInput && !includeCard){
  includeCard = document.createElement('input');
  includeCard.type = 'checkbox';
  includeCard.id   = 'includeCardCheckbox';
  if(includeCard) includeCard.checked = true;

  const lbl = document.createElement('label');
  lbl.style.marginLeft = '.5rem';
  lbl.appendChild(includeCard);
  lbl.appendChild(document.createTextNode(' Includi Transazioni Carte'));

  cardInput.parentElement.appendChild(lbl);
}

/* --- basic guards ------------------------------------------------------- */
if (!depositInput || !withdrawInput || !analyzeBtn) {
  console.error('[Toppery AML] DOM element IDs non trovati.');
  return;
}

/* ---------------- inject .transactions-table CSS ----------------------- */
(function ensureStyle() {
  if (document.getElementById('transactions-table-style')) return;
  const css = \`
    .transactions-table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:.35rem}
    .transactions-table caption{caption-side:top;font-weight:600;padding-bottom:.25rem;text-align:left}
    .transactions-table thead{background:#21262d}
    .transactions-table th,.transactions-table td{padding:.45rem .6rem;border-bottom:1px solid #30363d;text-align:left}
    .transactions-table tbody tr:nth-child(even){background:#1b1f24}
    .transactions-table tfoot th{background:#1b1f24}\`;
  const st = document.createElement('style');
  st.id = 'transactions-table-style';
  st.textContent = css;
  document.head.appendChild(st);
})();

/* ------------- Enable / Disable analyse button ------------------------- */
function toggleAnalyzeBtn() {
  const depsLoaded = depositInput.files.length && withdrawInput.files.length;
  const cardsOk    = !(includeCard?.checked ?? true) || cardInput.files.length;
  analyzeBtn.disabled = !(depsLoaded && cardsOk);
}
[cardInput, depositInput, withdrawInput, includeCard].forEach(el => el && el.addEventListener('change', toggleAnalyzeBtn));
toggleAnalyzeBtn();

/* ----------------------- Helper utilities ------------------------------ */
const sanitize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const parseNum = v => {
  if(typeof v === 'number') return isFinite(v)?v:0;
  if(v == null) return 0;
  let s = String(v).trim();
  if(!s) return 0;
  // remove spaces & NBSP
  s = s.replace(/\\s+/g,'');
  // se contiene sia . che , decidiamo quale è decimale guardando l'ultima occorrenza
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if(lastComma > -1 && lastDot > -1){
    if(lastComma > lastDot){
      // formato it: 1.234,56 -> rimuovi punti, sostituisci virgola con .
      s = s.replace(/\\./g,'').replace(/,/g,'.');
    }else{
      // formato en: 1,234.56 -> rimuovi virgole
      s = s.replace(/,/g,'');
    }
  }else if(lastComma > -1){
    // formato 1234,56
    s = s.replace(/\\./g,'').replace(/,/g,'.');
  }else{
    // formato 1.234 o 1234.56 -> togli separatori non numerici tranne - .
    s = s.replace(/[^0-9.-]/g,'');
  }
  const n = parseFloat(s);
  return isNaN(n)?0:n;
};

// --- Helper per visualizzare importi esattamente come da Excel ---
function formatImporto(raw, num){
  if(raw===undefined||raw===null||String(raw).trim()===''){
    return (typeof num==='number'&&isFinite(num))?num.toFixed(2):'';
  }
  return String(raw).trim();
}
const excelToDate = d => {
  if (d instanceof Date) return d;

  /* -----------------------------------------------------------------
   * SERIALI EXCEL (1900 date system)
   * -----------------------------------------------------------------
   * Excel conta i giorni a partire dal 30‑12‑1899 incluso
   * (bug anno bisestile 1900).  Sommiamo i giorni in LOCALE per
   * evitare slittamenti di fuso o giorno.
   * ----------------------------------------------------------------- */
  if (typeof d === 'number') {
    const base = new Date(1899, 11, 30, 0, 0, 0); // 30‑12‑1899 00:00 locale
    base.setDate(base.getDate() + d);
    return base;
  }

  /* -----------------------------------------------------------------
   * STRINGHE tipo 31/05/2025 22:15 o 31-05-2025
   * ----------------------------------------------------------------- */
  if (typeof d === 'string') {
    const s = d.trim();

    // Formato europeo con separatore / o - e orario opzionale
    const m = s.match(/^([0-3]?\\d)[\\/\\-]([0-1]?\\d)[\\/\\-](\\d{2,4})(?:\\D+([0-2]?\\d):([0-5]?\\d)(?::([0-5]?\\d))?)?/);
    if (m) {
      let day = +m[1];
      let mon = +m[2] - 1;
      let yr  = +m[3];
      if (yr < 100) yr += 2000;
      const hh = m[4] != null ? +m[4] : 0;
      const mm = m[5] != null ? +m[5] : 0;
      const ss = m[6] != null ? +m[6] : 0;
      return new Date(yr, mon, day, hh, mm, ss); // locale
    }

    /* ---------------------------------------------------------------
     * ISO 2025-05-31T22:00:00Z  ➜ convertiamo da UTC a locale
     * --------------------------------------------------------------- */
    if (s.endsWith('Z')) {
      const dUTC = new Date(s);
      return new Date(
        dUTC.getUTCFullYear(),
        dUTC.getUTCMonth(),
        dUTC.getUTCDate(),
        dUTC.getUTCHours(),
        dUTC.getUTCMinutes(),
        dUTC.getUTCSeconds()
      );
    }

    const tryDate = new Date(s);
    if (!isNaN(tryDate)) return tryDate;
  }

  // valore non riconosciuto → data invalida
  return new Date('');
};
const findHeaderRow = (rows,h) =>
  rows.findIndex(r=>Array.isArray(r)&&r.some(c=>typeof c==='string'&&sanitize(c).includes(sanitize(h))));
const findCol = (hdr,als)=>{const s=hdr.map(sanitize);for(const a of als){const i=s.findIndex(v=>v.includes(sanitize(a)));if(i!==-1)return i;}return -1;};
const monthKey = dt => dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
const monthLabel = k => {
  const [y,m] = k.split('-');
  const names = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return \`\${names[parseInt(m,10)-1]} \${y}\`;
};
const readExcel = file => new Promise((res,rej)=>{
  const fr=new FileReader();
  fr.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
      res(rows);
    }catch(err){rej(err);}
  };
  fr.onerror=rej;
  fr.readAsArrayBuffer(file);
});


/* ----------------- Helper: calcolo frazionate Prelievi (rolling 7gg) ---- */
/** Cerca frazionate > €4.999 nei movimenti di prelievo.
 * @param {Array[]} rows - righe excel (già slice hIdx+1 in parseMovements)
 * @param {number} cDate - indice colonna Data
 * @param {number} cDesc - indice colonna Descrizione
 * @param {number} cAmt  - indice colonna Importo
 * @returns {Array<{start:string,end:string,total:number,transactions:Array}>}
 */
function calcWithdrawFrazionate(rows, cDate, cDesc, cAmt){
  // Helper: format local date (YYYY-MM-DD) ignoring timezone to avoid off-by-one in display
  const fmtDateLocal = (d)=>{
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const da = String(dt.getDate()).padStart(2,'0');
    return \`\${y}-\${m}-\${da}\`;
  };

  /* Cerca frazionate > €4.999 **SOLO** tra i movimenti "Voucher PVR".
     Allineata a popup.js (rolling window 7 giorni).
     Se nessuna frazionata => array vuoto (UI non mostra). */
  const THRESHOLD = 5000;
  const isVoucherPVR = (desc)=>{
    if(!desc) return false;
    const d = String(desc).toLowerCase();
    return d.includes('voucher') && d.includes('pvr');
  };
  const txs = [];
  rows.forEach(r=>{
    if(!Array.isArray(r)) return;
    const desc = String(r[cDesc]??'').trim();
    if(!isVoucherPVR(desc)) return;
    const amt = parseNum(r[cAmt]); if(!amt) return;
    const dt = excelToDate(r[cDate]); if(!dt||isNaN(dt)) return;
    txs.push({data:dt, importo:Math.abs(amt), importo_raw:r[cAmt], causale:desc});
  });
  txs.sort((a,b)=>a.data-b.data);
  const startOfDay = d=>{const t=new Date(d);t.setHours(0,0,0,0);return t;};
  const res=[];
  let i=0;
  while(i<txs.length){
    const windowStart = startOfDay(txs[i].data);
    let j=i, run=0;
    while(j<txs.length){
      const t = txs[j];
      const diffDays = (startOfDay(t.data)-windowStart)/(1000*60*60*24);
      if(diffDays>6) break;
      run += t.importo;
      if(run>THRESHOLD){
        res.push({
          start: fmtDateLocal(windowStart),
          end: fmtDateLocal(startOfDay(t.data)),
          total: run,
          transactions: txs.slice(i,j+1).map(t=>({
            date: t.data.toISOString(),
            amount: t.importo, raw:t.importo_raw,
            causale: t.causale
          }))
        });
        i = j+1;
        break;
      }
      j++;
    }
    if(run<=THRESHOLD) i++;
  }
  return res;
}
/* ---------------------- Depositi / Prelievi ---------------------------- */
async function parseMovements(file, mode){  /* mode: 'deposit' | 'withdraw' */
  const RE = mode==='deposit'?/^(deposito|ricarica)/i:/^prelievo/i;
  const rows = await readExcel(file);
  const hIdx = findHeaderRow(rows,'importo');
  const hdr  = hIdx!==-1?rows[hIdx]:[];
  const data = hIdx!==-1?rows.slice(hIdx+1):rows;

  const cDate = hIdx!==-1?findCol(hdr,['data','date']):0;
  const cDesc = hIdx!==-1?findCol(hdr,['descr','description']):1;
  const cAmt  = hIdx!==-1?findCol(hdr,['importo','amount']):2;

  const all = Object.create(null);          /* Totali per metodo */
  const perMonth = Object.create(null);     /* {method: {YYYY-MM:val}} */
  let totAll=0, latest=new Date(0);

  data.forEach(r=>{
    if(!Array.isArray(r)) return;
    const desc = String(r[cDesc]??'').trim();
    if(!RE.test(desc)) return;

    const method = mode==='deposit' && desc.toLowerCase().startsWith('ricarica')
      ? 'Cash'
      : desc.replace(RE,'').trim() || 'Sconosciuto';

    const amt = parseNum(r[cAmt]); if(!amt) return;
    all[method] = (all[method]||0)+amt; totAll+=amt;

    const dt = excelToDate(r[cDate]); if(!dt||isNaN(dt)) return;
    if(dt>latest) latest = dt;

    const k = monthKey(dt);
    perMonth[method] ??={};
    perMonth[method][k] = (perMonth[method][k]||0)+amt;
  });

  /* calcolo lista mesi presenti (chiave YYYY-MM) in ordine decrescente */
const monthsSet = new Set();
Object.values(perMonth).forEach(obj=>{
  Object.keys(obj).forEach(k=>monthsSet.add(k));
});
const months = Array.from(monthsSet).sort().reverse().filter(k=>{const [y,m]=k.split('-').map(n=>parseInt(n,10));const d=new Date();return (y<d.getFullYear())||(y===d.getFullYear()&&m<=d.getMonth()+1);});

const frazionate = mode==='withdraw'?calcWithdrawFrazionate(data, cDate, cDesc, cAmt):[];
return {totAll, months, all, perMonth, frazionate};
}

/* ------------------ render Depositi / Prelievi table ------------------- */

function renderMovements(el, title, d){
  /* Aggiornato: filtro mese dinamico (Depositi / Prelievi).
     Mostra solo i mesi realmente presenti nei dati (già calcolati in parseMovements).
     Valore vuoto => Totale (comportamento originario).
  */
  el.innerHTML = '';
  el.classList.add('hidden');
  if(!d || !d.totAll) return;

  const makeTable = (filterMonth='')=>{
    const isTotal = !filterMonth;
    const caption = isTotal ? \`\${title} – Totale\` : \`\${title} – \${monthLabel(filterMonth)}\`;
    let rowsObj, tot;
    if(isTotal){
      rowsObj = d.all;
      tot = d.totAll;
    }else{
      rowsObj = {};
      tot = 0;
      Object.keys(d.perMonth).forEach(method=>{
        const v = d.perMonth[method][filterMonth] || 0;
        if(v){
          rowsObj[method] = v;
          tot += v;
        }
      });
      if(tot===0){
        return \`<p style='color:#999'>\${title}: nessun movimento per \${monthLabel(filterMonth)}.</p>\`;
      }
    }

    const tbl = document.createElement('table');
    tbl.className = 'transactions-table';
    tbl.innerHTML = \`
      <caption>\${caption}</caption>
      <thead><tr><th>Metodo</th><th>Importo €</th></tr></thead>
      <tbody></tbody>
      <tfoot><tr><th style='text-align:right'>Totale €</th><th style='text-align:right'>\${tot.toFixed(2)}</th></tr></tfoot>\`;

    const tbody = tbl.querySelector('tbody');
    Object.keys(rowsObj).forEach(method=>{
      tbody.insertAdjacentHTML('beforeend',
        \`<tr><td>\${method}</td><td style='text-align:right'>\${rowsObj[method].toFixed(2)}</td></tr>\`);
    });
    return tbl;
  };

  // render iniziale = totale
  const firstTbl = makeTable('');
  if(typeof firstTbl === 'string'){ el.innerHTML = firstTbl; }
  else{ el.appendChild(firstTbl); }
  el.classList.remove('hidden');

  // menù a tendina mesi
  if(Array.isArray(d.months) && d.months.length){
    const select = document.createElement('select');
    select.innerHTML = '<option value="">Totale</option>' + d.months.map(k=>\`<option value="\${k}">\${monthLabel(k)}</option>\`).join('');
    select.style.marginRight = '.5rem';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.margin = '0 0 .5rem 0';
    wrapper.appendChild(select);
    el.insertBefore(wrapper, el.firstChild);

    select.addEventListener('change',()=>{
      const cur = makeTable(select.value);
      Array.from(el.querySelectorAll('table:not(.frazionate-table), p')).forEach(n=>n.remove());
      if(typeof cur === 'string'){ wrapper.insertAdjacentHTML('afterend',cur); }
      else{ wrapper.insertAdjacentElement('afterend',cur); }
    });
  }
  // --- Frazionate (solo per Prelievi) -----------------------------------
  if(title==='Prelievi' && Array.isArray(d.frazionate) && d.frazionate.length){
    const det = document.createElement('details');
    det.style.marginTop = '1rem';
    const sum = document.createElement('summary');
    sum.textContent = \`Frazionate Prelievi (\${d.frazionate.length})\`;
    det.appendChild(sum);

    const wrap = document.createElement('div');
    wrap.innerHTML = buildFrazionateTable(d.frazionate);
    det.appendChild(wrap);
    el.appendChild(det);
  }

}

/* ---- build html tabella frazionate prelievi --------------------------- */
function buildFrazionateTable(list){
  /* Formatta periodo dd/mm/yyyy come nel file Excel. */
  if(!list.length) return '<p>Nessuna frazionata rilevata.</p>';
  const fmt = v => {
    if(v==null) return '';
    const d = v instanceof Date ? v : new Date(v);
    if(isNaN(d)) return String(v);
    return d.toLocaleDateString('it-IT');
  };
  let html = '<table class="transactions-table frazionate-table">';
  html += '<thead><tr><th>Periodo</th><th>Totale €</th><th># Mov</th></tr></thead><tbody>';
  list.forEach((f,i)=>{
    const pid = \`frazp_\${i}\`;
    const ds = fmt(f.start);
    const de = fmt(f.end);
    html += \`<tr data-fraz="\${pid}"><td>\${ds} - \${de}</td><td style="text-align:right">\${f.total.toFixed(2)}</td><td style="text-align:right">\${f.transactions.length}</td></tr>\`;
    html += \`<tr class="fraz-det" id="\${pid}" style="display:none"><td colspan="3">\`;
    html += '<table class="inner-fraz"><thead><tr><th>Data</th><th>Causale</th><th>Importo €</th></tr></thead><tbody>';
    f.transactions.forEach(t=>{
      const d = fmt(t.date);
      html += \`<tr><td>\${d}</td><td>\${t.causale}</td><td style="text-align:right">\${formatImporto(t.raw,t.amount)}</td></tr>\`;
    });
    html += '</tbody></table></td></tr>';
  });
  html += '</tbody></table>';
  return html;
}
/* ---------------------- Transazioni Carte ------------------------------ */
async function parseCards(file){
  return readExcel(file);
}

/* ---- Costruisce tabella carte con facoltativo filtro per mese ---------- */
/**
 * @param {Array[]} rows  - righe excel
 * @param {number}  depTot – totale depositi, per % depositi
 * @param {string}  filterMonth - '' per totale oppure chiave YYYY-MM
 * @returns {{html:string, months:string[]}}
 */
function buildCardTable(rows, depTot, filterMonth=''){
  let hIdx = findHeaderRow(rows, 'amount');
    if (hIdx === -1) hIdx = findHeaderRow(rows, 'importo');
  if(hIdx===-1) return {html:'<p style="color:red">Intestazioni carte assenti.</p>', months:[]};
  const hdr = rows[hIdx];
  const data = rows.slice(hIdx+1).filter(r=>Array.isArray(r)&&r.some(c=>c));

  const ix = {
    date : findCol(hdr,['date','data']),
    pan  : findCol(hdr,['pan']),
    bin  : findCol(hdr,['bin']),
    name : findCol(hdr,['holder','nameoncard']),
    type : findCol(hdr,['cardtype']),
    prod : findCol(hdr,['product']),
    ctry : findCol(hdr,['country']),
    bank : findCol(hdr,['bank']),
    amt  : findCol(hdr,['amount']),
    res  : findCol(hdr,['result']),
    ttype: findCol(hdr,['transactiontype','transtype']),
    reason:findCol(hdr,['reason'])
  };
  if(ix.pan===-1 || ix.amt===-1 || ix.ttype===-1){
    return {html:'<p style="color:red">Colonne fondamentali mancanti.</p>', months:[]};
  }

  const cards = {};
  const sum = {app:0, dec:0};
  const monthsSet = new Set();

  data.forEach(r=>{
    const txType = String(r[ix.ttype]||'').toLowerCase();
    const accepted = ['sale', 'payment', 'capture', 'charge', 'acq'];
        if (!accepted.some(k => txType.includes(k))) return;

    // collect date & filter if requested -----------------------------------
    let dt=null;
    if(ix.date!==-1){
      dt = excelToDate(r[ix.date]);
      if(dt && !isNaN(dt)){
        const mk = monthKey(dt);
        monthsSet.add(mk);
        if(filterMonth && mk!==filterMonth) return;   // skip not requested month
      }else if(filterMonth){                          // invalid date row & filtering active → skip
        return;
      }
    }else if(filterMonth){                            // no date column but filter asked
      return;
    }

    const pan = r[ix.pan] || 'UNKNOWN';
    cards[pan] ??={
      bin : ix.bin!==-1 ? (r[ix.bin] || String(pan).slice(0,6)) : '',
      pan,
      name: ix.name!==-1 ? (r[ix.name] || '') : '',
      type: ix.type!==-1 ? (r[ix.type] || '') : '',
      prod: ix.prod!==-1 ? (r[ix.prod] || '') : '',
      ctry: ix.ctry!==-1 ? (r[ix.ctry] || '') : '',
      bank: ix.bank!==-1 ? (r[ix.bank] || '') : '',
      app : 0, dec:0, nDec:0, reasons:new Set()
    };

    const amt = parseNum(r[ix.amt]);
    const resVal = ix.res!==-1 ? String(r[ix.res] || '') : 'approved';
    if(/^approved$/i.test(resVal)){
      cards[pan].app += amt; sum.app += amt;
    }else{
      cards[pan].dec += amt; sum.dec += amt;
      cards[pan].nDec += 1;
      if(ix.reason!==-1 && r[ix.reason]) cards[pan].reasons.add(r[ix.reason]);
    }
  });

  const months = Array.from(monthsSet).sort().reverse().filter(k=>{const [y,m]=k.split('-').map(n=>parseInt(n,10));const d=new Date();return (y<d.getFullYear())||(y===d.getFullYear()&&m<=d.getMonth()+1);});
  const caption = filterMonth ? \`Carte – \${monthLabel(filterMonth)}\` : 'Carte – Totale';

  const tbl = document.createElement('table');
  tbl.className = 'transactions-table';
  tbl.innerHTML = \`
    <caption>\${caption}</caption>
    <colgroup>
      <col style="width:6%"><col style="width:9%"><col style="width:17%">
      <col style="width:8%"><col style="width:9%"><col style="width:7%">
      <col style="width:10%"><col style="width:8%"><col style="width:8%">
      <col style="width:7%"><col style="width:7%"><col>
    </colgroup>
    <thead><tr>
      <th>BIN</th><th>PAN</th><th>Holder</th><th>Type</th><th>Product</th>
      <th>Country</th><th>Bank</th><th>Approved €</th><th>Declined €</th>
      <th>#Declined</th><th>% Depositi</th><th>Reason Codes</th>
    </tr></thead><tbody></tbody>
    <tfoot><tr>
      <th colspan="7" style="text-align:right">TOTAL:</th>
      <th style="text-align:right">\${sum.app.toFixed(2)}</th>
      <th style="text-align:right">\${sum.dec.toFixed(2)}</th>
      <th></th><th></th><th></th>
    </tr></tfoot>\`;

  const tb = tbl.querySelector('tbody');
  Object.values(cards).forEach(c=>{
    const perc = depTot ? ((c.app/depTot)*100).toFixed(2)+'%' : '—';
    tb.insertAdjacentHTML('beforeend', \`
      <tr>
        <td>\${c.bin}</td><td>\${c.pan}</td><td>\${c.name}</td><td>\${c.type}</td><td>\${c.prod}</td>
        <td>\${c.ctry}</td><td>\${c.bank}</td>
        <td style="text-align:right">\${c.app.toFixed(2)}</td>
        <td style="text-align:right">\${c.dec.toFixed(2)}</td>
        <td style="text-align:right">\${c.nDec}</td>
        <td style="text-align:right">\${perc}</td>
        <td>\${[...c.reasons].join(', ')}</td>
      </tr>\`);
  });

  return {html: tbl.outerHTML, months};
}

/* ------------ Render cartes table & dropdown --------------------------- */
function renderCards(rows, depTot){
  cardResult.innerHTML='';
  cardResult.classList.add('hidden');

  const first = buildCardTable(rows, depTot, '');
  const select = document.createElement('select');
  select.innerHTML = '<option value="">Totale</option>' + first.months.map(k=>\`<option value="\${k}">\${monthLabel(k)}</option>\`).join('');
  select.style.marginRight = '.5rem';

  const wrapper = document.createElement('div');
  wrapper.style.marginBottom = '.5rem';
  const lbl = document.createElement('label');
  lbl.textContent = 'Filtro mese: ';
  lbl.appendChild(select);
  wrapper.appendChild(lbl);
  cardResult.appendChild(wrapper);

  const tableContainer = document.createElement('div');
  tableContainer.innerHTML = first.html;
  cardResult.appendChild(tableContainer);
  cardResult.classList.remove('hidden');

  select.addEventListener('change', ()=>{
    const res = buildCardTable(rows, depTot, select.value);
    tableContainer.innerHTML = res.html;
  });
}

/* -------------------------- Main handler ------------------------------- */
if (analyzeBtn && !analyzeBtn.hasTransactionListener) {
  analyzeBtn.hasTransactionListener = true;
  
  const originalHandler = async ()=>{
    analyzeBtn.disabled = true;
    try{
      const depositData = await parseMovements(depositInput.files[0],'deposit');
      renderMovements(depositResult,'Depositi',depositData);

      const withdrawData = await parseMovements(withdrawInput.files[0],'withdraw');
      renderMovements(withdrawResult,'Prelievi',withdrawData);

      if((includeCard?.checked ?? true)){
        const cardRows = await parseCards(cardInput.files[0]);
        renderCards(cardRows, depositData.totAll);
      }else{
        cardResult.innerHTML='';
        cardResult.classList.add('hidden');
      }
      
      // Store results for persistence
      if (typeof window !== 'undefined') {
        (window as any).persistentTransactionResults = {
          deposit: depositResult ? depositResult.outerHTML : '',
          withdraw: withdrawResult ? withdrawResult.outerHTML : '',
          cards: cardResult ? cardResult.outerHTML : ''
        };
      }
      
    }catch(err){
      console.error(err);
      alert('Errore durante l\\'analisi: ' + err.message);
    }
    analyzeBtn.disabled = false;
  };
  
  analyzeBtn.addEventListener('click', originalHandler);
}
      `;
      
      // document.head.appendChild(script); // disabled legacy DOM script
      
      // Restore results if they exist
      if (typeof window !== 'undefined' && (window as any).persistentTransactionResults) {
        const { deposit, withdraw, cards } = (window as any).persistentTransactionResults;
        
        const depositEl = document.getElementById('depositResult');
        const withdrawEl = document.getElementById('withdrawResult');
        const cardEl = document.getElementById('transactionsResult');
        
        if (depositEl && deposit) {
          depositEl.outerHTML = deposit;
        }
        if (withdrawEl && withdraw) {
          withdrawEl.outerHTML = withdraw;  
        }
        if (cardEl && cards) {
          cardEl.outerHTML = cards;
        }
      }
    };

    // Initialize transactions logic immediately
    // initializeTransactionsLogic disabled: legacy DOM table removed

    return () => {
      // Cleanup on unmount
      const script = document.querySelector('script[data-transaction-logic]');
      // if (script) { script.remove(); } // legacy disabled
    };
  }, []);
  useEffect(() => {
    const checkAuth = async () => {
      const session = await getCurrentSession();
      if (!session) {
        navigate('/auth/login');
        return;
      }
      setIsLoading(false);
    };
    checkAuth();

    // Restore persisted access results on mount
    const savedAccessResults = localStorage.getItem('aml_access_results');
    if (savedAccessResults) {
      try {
        const parsed = JSON.parse(savedAccessResults);
        setAccessResults(parsed);
        console.log('🔄 Restored access results from localStorage:', parsed.length);
      } catch (e) {
        console.error('Error parsing saved access results:', e);
      }
    }

    // Restore persisted transaction results on mount if files were processed
    const savedTransactionResults = localStorage.getItem('aml_transaction_results');
    const filesProcessed = localStorage.getItem('aml_files_processed');
    
    if (savedTransactionResults && filesProcessed === 'true') {
      try {
        const parsed = JSON.parse(savedTransactionResults);
        setTransactionResults(parsed);
        
        // Restore file states based on processed data flags
        if (parsed.hasDeposits) {
          setDepositFile(new File([], 'processed-deposits.xlsx'));
        }
        if (parsed.hasWithdraws) {
          setWithdrawFile(new File([], 'processed-withdraws.xlsx'));
        }
        if (parsed.hasCards) {
          setCardFile(new File([], 'processed-cards.xlsx'));
        }
        setIncludeCard(parsed.includeCard || false);
        
        console.log('🔄 Restored transaction results from localStorage');
      } catch (e) {
        console.error('Error parsing saved transaction results:', e);
      }
    }
  }, [navigate]);

  // Chart creation functions (exactly from original repository)
  const createChartsAfterAnalysis = () => {
    if (!results || !transactions.length) return;

    // Create timeline chart
    setTimeout(() => {
      if (chartRef.current) {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: results.frazionate.map(f => f.start),
              datasets: [{
                label: 'Importo Frazionate',
                data: results.frazionate.map(f => f.total),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }]
            }
          });
        }
      }

      // Create causali chart
      if (causaliChartRef.current) {
        const causaliData = transactions.reduce((acc, tx) => {
          acc[tx.causale] = (acc[tx.causale] || 0) + Math.abs(tx.importo);
          return acc;
        }, {} as Record<string, number>);
        const ctx2 = causaliChartRef.current.getContext('2d');
        if (ctx2) {
          new Chart(ctx2, {
            type: 'doughnut',
            data: {
              labels: Object.keys(causaliData),
              datasets: [{
                data: Object.values(causaliData),
                backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf', '#4bc0c0']
              }]
            }
          });
        }
      }

      // Create hour heatmap
      if (hourHeatmapRef.current) {
        const hourCounts = new Array(24).fill(0);
        transactions.forEach(tx => {
          hourCounts[tx.data.getHours()]++;
        });
        const ctx3 = hourHeatmapRef.current.getContext('2d');
        if (ctx3) {
          new Chart(ctx3, {
            type: 'bar',
            data: {
              labels: Array.from({
                length: 24
              }, (_, i) => `${i}:00`),
              datasets: [{
                label: 'Transazioni per ora',
                data: hourCounts,
                backgroundColor: 'rgba(54, 162, 235, 0.6)'
              }]
            }
          });
        }
      }
    }, 100);
  };
  useEffect(() => {
    if (results) {
      createChartsAfterAnalysis();
    }
  }, [results, activeTab]);

  // Initialize original transactions.js logic when tab is active
  useEffect(() => {
    if (activeTab === 'transazioni') {
      // Small delay to ensure DOM elements are ready
      const timer = setTimeout(() => {
        // initializeTransactionsLogic disabled
        
        // Only restore persisted results if there are files currently uploaded
        const depositInput = document.getElementById('depositInput') as HTMLInputElement;
        const withdrawInput = document.getElementById('withdrawInput') as HTMLInputElement;
        const cardInput = document.getElementById('cardInput') as HTMLInputElement;
        
        const hasFiles = (depositInput?.files?.length || 0) > 0 || 
                        (withdrawInput?.files?.length || 0) > 0 || 
                        (cardInput?.files?.length || 0) > 0;
        
        if (hasFiles) {
          // Restore persisted results if they exist and files are uploaded
          const savedResults = localStorage.getItem('aml_transaction_results');
          if (savedResults) {
            try {
              const parsed = JSON.parse(savedResults);
              const depositEl = document.getElementById('depositResult');
              const withdrawEl = document.getElementById('withdrawResult');
              const cardEl = document.getElementById('transactionsResult');
              
              if (depositEl && parsed.deposit) {
                depositEl.innerHTML = parsed.deposit;
                depositEl.classList.remove('hidden');
                // Re-apply month filtering functionality after restoration
                const selectEl = depositEl.querySelector('select');
                if (selectEl && parsed.depositData) {
                  restoreFilteringForElement(depositEl, parsed.depositData, 'Depositi');
                }
              }
              if (withdrawEl && parsed.withdraw) {
                withdrawEl.innerHTML = parsed.withdraw;
                withdrawEl.classList.remove('hidden');
                // Re-apply month filtering functionality after restoration
                const selectEl = withdrawEl.querySelector('select');
                if (selectEl && parsed.withdrawData) {
                  restoreFilteringForElement(withdrawEl, parsed.withdrawData, 'Prelievi');
                }
              }
              if (cardEl && parsed.cards) {
                cardEl.innerHTML = parsed.cards;
                cardEl.classList.remove('hidden');
              }
              console.log('🔄 Restored transaction DOM content from localStorage');
            } catch (e) {
              console.error('Error restoring transaction results:', e);
            }
          }
        } else {
          // No files uploaded, clear any persisted data
          localStorage.removeItem('aml_transaction_results');
          console.log('🧹 Cleared transaction results from localStorage (no files uploaded)');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);
  // Helper to restore filtering functionality for persisted content
  const restoreFilteringForElement = (element: HTMLElement, data: any, title: string) => {
    // monthLabel function (same as in original code)
    const monthLabel = (k: string) => {
      const [y, m] = k.split('-');
      const names = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
      return `${names[parseInt(m,10)-1]} ${y}`;
    };
    
    const selectEl = element.querySelector('select');
    if (selectEl && data) {
      selectEl.addEventListener('change', () => {
        const filterMonth = selectEl.value;
        const isTotal = !filterMonth;
        const caption = isTotal ? `${title} – Totale` : `${title} – ${monthLabel(filterMonth)}`;
        let rowsObj: any, tot: number;
        
        if (isTotal) {
          rowsObj = data.all;
          tot = data.totAll;
        } else {
          rowsObj = {};
          tot = 0;
          Object.keys(data.perMonth).forEach((method: string) => {
            const v = data.perMonth[method][filterMonth] || 0;
            if (v) {
              rowsObj[method] = v;
              tot += v;
            }
          });
          if (tot === 0) {
            element.innerHTML = `<div style="display: flex; align-items: center; margin: 0 0 .5rem 0;"><select style="margin-right: .5rem;">${selectEl.innerHTML}</select></div><p style='color:#999'>${title}: nessun movimento per ${monthLabel(filterMonth)}.</p>`;
            const newSelect = element.querySelector('select');
            if (newSelect) {
              (newSelect as HTMLSelectElement).value = filterMonth;
              restoreFilteringForElement(element, data, title);
            }
            return;
          }
        }

        const tbl = document.createElement('table');
        tbl.className = 'transactions-table';
        tbl.innerHTML = `
          <caption>${caption}</caption>
          <thead><tr><th>Metodo</th><th>Importo €</th></tr></thead>
          <tbody></tbody>
          <tfoot><tr><th style='text-align:right'>Totale €</th><th style='text-align:right'>${tot.toFixed(2)}</th></tr></tfoot>`;

        const tbody = tbl.querySelector('tbody');
        Object.keys(rowsObj).forEach((method: string) => {
          tbody!.insertAdjacentHTML('beforeend',
            `<tr><td>${method}</td><td style='text-align:right'>${rowsObj[method].toFixed(2)}</td></tr>`);
        });

        // Clear old content and add new
        Array.from(element.querySelectorAll('table:not(.frazionate-table), p')).forEach(n => n.remove());
        const wrapper = element.querySelector('div');
        if (wrapper) {
          wrapper.insertAdjacentElement('afterend', tbl);
        }
      });
    }
  };

  const initializeTransactionsLogic = () => {
    // EXACT COPY OF ORIGINAL transactions.js LOGIC - DO NOT MODIFY

    /* ---- fallback-ID helper ------------------------------------------------ */
    function $(primary: string, fallback?: string) {
      return document.getElementById(primary) || (fallback ? document.getElementById(fallback) : null);
    }

    /* --------------------------- DOM references ----------------------------- */
    const cardInput = $('cardFileInput', 'transactionsFileInput') as HTMLInputElement;
    const depositInput = $('depositFileInput') as HTMLInputElement;
    const withdrawInput = $('withdrawFileInput') as HTMLInputElement;
    const analyzeBtn = $('analyzeBtn', 'analyzeTransactionsBtn') as HTMLButtonElement;
    const depositResult = document.getElementById('depositResult');
    const withdrawResult = document.getElementById('withdrawResult');
    const cardResult = document.getElementById('transactionsResult');

    /* ---------------- dinamically inject checkbox -------------------------- */
    // legacy DOM removed let includeCard = document.getElementById('includeCardCheckbox') as HTMLInputElement;
    if (cardInput && !includeCard) {
      includeCard = document.createElement('input') as HTMLInputElement;
      includeCard.type = 'checkbox';
      includeCard.id = 'includeCardCheckbox';
      if(includeCard) includeCard.checked = true;
      const lbl = document.createElement('label');
      lbl.style.marginLeft = '.5rem';
      lbl.appendChild(includeCard);
      lbl.appendChild(document.createTextNode(' Includi Transazioni Carte'));
      cardInput.parentElement!.appendChild(lbl);
    }

    /* --- basic guards ------------------------------------------------------- */
    if (!depositInput || !withdrawInput || !analyzeBtn) {
      console.error('[Toppery AML] DOM element IDs non trovati.');
      return;
    }

    /* ---------------- inject .transactions-table CSS ----------------------- */
    (function ensureStyle() {
      if (document.getElementById('transactions-table-style')) return;
      const css = `
        .transactions-table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:.35rem}
        .transactions-table caption{caption-side:top;font-weight:600;padding-bottom:.25rem;text-align:left}
        .transactions-table thead{background:#21262d}
        .transactions-table th,.transactions-table td{padding:.45rem .6rem;border-bottom:1px solid #30363d;text-align:left}
        .transactions-table tbody tr:nth-child(even){background:#1b1f24}
        .transactions-table tfoot th{background:#1b1f24}`;
      const st = document.createElement('style');
      st.id = 'transactions-table-style';
      st.textContent = css;
      document.head.appendChild(st);
    })();

    /* ------------- Enable / Disable analyse button ------------------------- */
    function toggleAnalyzeBtn() {
      const depsLoaded = depositInput.files!.length && withdrawInput.files!.length;
      const cardsOk = !(includeCard?.checked ?? true) || cardInput.files!.length;
      analyzeBtn.disabled = !(depsLoaded && cardsOk);
    }
    [cardInput, depositInput, withdrawInput, includeCard].forEach(el => {
      if (el) {
        el.addEventListener('change', toggleAnalyzeBtn);
        // Add persistence cleanup for file inputs
        if (el === cardInput || el === depositInput || el === withdrawInput) {
          el.addEventListener('change', (e) => {
            const input = e.target as HTMLInputElement;
            if (!input.files?.length) {
              // Clear localStorage when all files are removed
              const allEmpty = !cardInput.files?.length && !depositInput.files?.length && !withdrawInput.files?.length;
              if (allEmpty) {
                localStorage.removeItem('aml_transaction_results');
                setTransactionResults(null);
                console.log('🧹 Cleared transaction results from localStorage (no files)');
              }
            }
          });
        }
      }
    });
    toggleAnalyzeBtn();

    /* ----------------------- Helper utilities ------------------------------ */
    const sanitize = (s: any) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const parseNum = (v: any) => {
      if (typeof v === 'number') return isFinite(v) ? v : 0;
      if (v == null) return 0;
      let s = String(v).trim();
      if (!s) return 0;
      s = s.replace(/\s+/g, '');
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (lastComma > -1) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        s = s.replace(/[^0-9.-]/g, '');
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };
    function formatImporto(raw: any, num: any) {
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        return typeof num === 'number' && isFinite(num) ? num.toFixed(2) : '';
      }
      return String(raw).trim();
    }
    const excelToDate = (d: any) => {
      if (d instanceof Date) return d;
      if (typeof d === 'number') {
        const base = new Date(1899, 11, 30, 0, 0, 0);
        base.setDate(base.getDate() + d);
        return base;
      }
      if (typeof d === 'string') {
        const s = d.trim();
        const m = s.match(/^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{2,4})(?:\D+([0-2]?\d):([0-5]?\d)(?::([0-5]?\d))?)?/);
        if (m) {
          let day = +m[1];
          let mon = +m[2] - 1;
          let yr = +m[3];
          if (yr < 100) yr += 2000;
          const hh = m[4] != null ? +m[4] : 0;
          const mm = m[5] != null ? +m[5] : 0;
          const ss = m[6] != null ? +m[6] : 0;
          return new Date(yr, mon, day, hh, mm, ss);
        }
        if (s.endsWith('Z')) {
          const dUTC = new Date(s);
          return new Date(dUTC.getUTCFullYear(), dUTC.getUTCMonth(), dUTC.getUTCDate(), dUTC.getUTCHours(), dUTC.getUTCMinutes(), dUTC.getUTCSeconds());
        }
        const tryDate = new Date(s);
        if (!isNaN(tryDate.getTime())) return tryDate;
      }
      return new Date('');
    };
    const findHeaderRow = (rows: any[], h: string) => rows.findIndex(r => Array.isArray(r) && r.some((c: any) => typeof c === 'string' && sanitize(c).includes(sanitize(h))));
    const findCol = (hdr: any[], als: string[]) => {
      const s = hdr.map(sanitize);
      for (const a of als) {
        const i = s.findIndex((v: string) => v.includes(sanitize(a)));
        if (i !== -1) return i;
      }
      return -1;
    };
    const monthKey = (dt: Date) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const monthLabel = (k: string) => {
      const [y, m] = k.split('-');
      const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      return `${names[parseInt(m, 10) - 1]} ${y}`;
    };
    const readExcel = (file: File) => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = (e: any) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), {
            type: 'array'
          });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
            header: 1
          });
          res(rows);
        } catch (err) {
          rej(err);
        }
      };
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });

    /* ----------------- Helper: calcolo frazionate Prelievi (rolling 7gg) ---- */
    function calcWithdrawFrazionate(rows: any[], cDate: number, cDesc: number, cAmt: number) {
      const fmtDateLocal = (d: any) => {
        const dt = new Date(d);
        dt.setHours(0, 0, 0, 0);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const da = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
      };
      const THRESHOLD = 5000;
      const isVoucherPVR = (desc: any) => {
        if (!desc) return false;
        const d = String(desc).toLowerCase();
        return d.includes('voucher') && d.includes('pvr');
      };
      const txs: any[] = [];
      rows.forEach(r => {
        if (!Array.isArray(r)) return;
        const desc = String(r[cDesc] ?? '').trim();
        if (!isVoucherPVR(desc)) return;
        const amt = parseNum(r[cAmt]);
        if (!amt) return;
        const dt = excelToDate(r[cDate]);
        if (!dt || isNaN(dt.getTime())) return;
        txs.push({
          data: dt,
          importo: Math.abs(amt),
          importo_raw: r[cAmt],
          causale: desc
        });
      });
      txs.sort((a, b) => a.data.getTime() - b.data.getTime());
      const startOfDay = (d: Date) => {
        const t = new Date(d);
        t.setHours(0, 0, 0, 0);
        return t;
      };
      const res: any[] = [];
      let i = 0;
      while (i < txs.length) {
        const windowStart = startOfDay(txs[i].data);
        let j = i,
          run = 0;
        while (j < txs.length) {
          const t = txs[j];
          const diffDays = (startOfDay(t.data).getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 6) break;
          run += t.importo;
          if (run > THRESHOLD) {
            res.push({
              start: fmtDateLocal(windowStart),
              end: fmtDateLocal(startOfDay(t.data)),
              total: run,
              transactions: txs.slice(i, j + 1).map(t => ({
                date: t.data.toISOString(),
                amount: t.importo,
                raw: t.importo_raw,
                causale: t.causale
              }))
            });
            i = j + 1;
            break;
          }
          j++;
        }
        if (run <= THRESHOLD) i++;
      }
      return res;
    }

    /* ---------------------- Depositi / Prelievi ---------------------------- */
    async function parseMovements(file: File, mode: string) {
      const RE = mode === 'deposit' ? /^(deposito|ricarica)/i : /^prelievo/i;
      const rows = (await readExcel(file)) as any[];
      const hIdx = findHeaderRow(rows, 'importo');
      const hdr = hIdx !== -1 ? rows[hIdx] : [];
      const data = hIdx !== -1 ? rows.slice(hIdx + 1) : rows;
      const cDate = hIdx !== -1 ? findCol(hdr, ['data', 'date']) : 0;
      const cDesc = hIdx !== -1 ? findCol(hdr, ['descr', 'description']) : 1;
      const cAmt = hIdx !== -1 ? findCol(hdr, ['importo', 'amount']) : 2;
      const all = Object.create(null);
      const perMonth = Object.create(null);
      let totAll = 0,
        latest = new Date(0);
      data.forEach(r => {
        if (!Array.isArray(r)) return;
        const desc = String(r[cDesc] ?? '').trim();
        if (!RE.test(desc)) return;
        const method = mode === 'deposit' && desc.toLowerCase().startsWith('ricarica') ? 'Cash' : desc.replace(RE, '').trim() || 'Sconosciuto';
        const amt = parseNum(r[cAmt]);
        if (!amt) return;
        all[method] = (all[method] || 0) + amt;
        totAll += amt;
        const dt = excelToDate(r[cDate]);
        if (!dt || isNaN(dt.getTime())) return;
        if (dt > latest) latest = dt;
        const k = monthKey(dt);
        perMonth[method] ??= {};
        perMonth[method][k] = (perMonth[method][k] || 0) + amt;
      });
      const monthsSet = new Set<string>();
      Object.values(perMonth).forEach((obj: any) => {
        Object.keys(obj).forEach(k => monthsSet.add(k));
      });
      const months = Array.from(monthsSet).sort().reverse().filter(k => {
        const [y, m] = k.split('-').map(n => parseInt(n, 10));
        const d = new Date();
        return y < d.getFullYear() || y === d.getFullYear() && m <= d.getMonth() + 1;
      });
      const frazionate = mode === 'withdraw' ? calcWithdrawFrazionate(data, cDate, cDesc, cAmt) : [];
      return {
        totAll,
        months,
        all,
        perMonth,
        frazionate
      };
    }

    /* ------------------ render Depositi / Prelievi table ------------------- */
    function renderMovements(el: HTMLElement, title: string, d: any) {
      el.innerHTML = '';
      el.classList.add('hidden');
      if (!d || !d.totAll) return;
      const makeTable = (filterMonth = '') => {
        const isTotal = !filterMonth;
        const caption = isTotal ? `${title} – Totale` : `${title} – ${monthLabel(filterMonth)}`;
        let rowsObj, tot;
        if (isTotal) {
          rowsObj = d.all;
          tot = d.totAll;
        } else {
          rowsObj = {};
          tot = 0;
          Object.keys(d.perMonth).forEach(method => {
            const v = d.perMonth[method][filterMonth] || 0;
            if (v) {
              rowsObj[method] = v;
              tot += v;
            }
          });
          if (tot === 0) {
            return `<p style='color:#999'>${title}: nessun movimento per ${monthLabel(filterMonth)}.</p>`;
          }
        }
        const tbl = document.createElement('table');
        tbl.className = 'transactions-table';
        tbl.innerHTML = `
          <caption>${caption}</caption>
          <thead><tr><th>Metodo</th><th>Importo €</th></tr></thead>
          <tbody></tbody>
          <tfoot><tr><th style='text-align:right'>Totale €</th><th style='text-align:right'>${tot.toFixed(2)}</th></tr></tfoot>`;
        const tbody = tbl.querySelector('tbody')!;
        Object.keys(rowsObj).forEach(method => {
          tbody.insertAdjacentHTML('beforeend', `<tr><td>${method}</td><td style='text-align:right'>${rowsObj[method].toFixed(2)}</td></tr>`);
        });
        return tbl;
      };
      const firstTbl = makeTable('');
      if (typeof firstTbl === 'string') {
        el.innerHTML = firstTbl;
      } else {
        el.appendChild(firstTbl);
      }
      el.classList.remove('hidden');
      if (Array.isArray(d.months) && d.months.length) {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">Totale</option>' + d.months.map((k: string) => `<option value="${k}">${monthLabel(k)}</option>`).join('');
        select.style.marginRight = '.5rem';
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.margin = '0 0 .5rem 0';
        wrapper.appendChild(select);
        el.insertBefore(wrapper, el.firstChild);
        select.addEventListener('change', () => {
          const cur = makeTable(select.value);
          Array.from(el.querySelectorAll('table:not(.frazionate-table), p')).forEach(n => n.remove());
          if (typeof cur === 'string') {
            wrapper.insertAdjacentHTML('afterend', cur);
          } else {
            wrapper.insertAdjacentElement('afterend', cur);
          }
        });
      }
      if (title === 'Prelievi' && Array.isArray(d.frazionate) && d.frazionate.length) {
        const det = document.createElement('details');
        det.style.marginTop = '1rem';
        const sum = document.createElement('summary');
        sum.textContent = `Frazionate Prelievi (${d.frazionate.length})`;
        det.appendChild(sum);
        const wrap = document.createElement('div');
        wrap.innerHTML = buildFrazionateTable(d.frazionate);
        det.appendChild(wrap);
        el.appendChild(det);
      }
    }

    /* ---- build html tabella frazionate prelievi --------------------------- */
    function buildFrazionateTable(list: any[]) {
      if (!list.length) return '<p>Nessuna frazionata rilevata.</p>';
      const fmt = (v: any) => {
        if (v == null) return '';
        const d = v instanceof Date ? v : new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString('it-IT');
      };
      let html = '<table class="transactions-table frazionate-table">';
      html += '<thead><tr><th>Periodo</th><th>Totale €</th><th># Mov</th></tr></thead><tbody>';
      list.forEach((f, i) => {
        const pid = `frazp_${i}`;
        const ds = fmt(f.start);
        const de = fmt(f.end);
        html += `<tr data-fraz="${pid}"><td>${ds} - ${de}</td><td style="text-align:right">${f.total.toFixed(2)}</td><td style="text-align:right">${f.transactions.length}</td></tr>`;
        html += `<tr class="fraz-det" id="${pid}" style="display:none"><td colspan="3">`;
        html += '<table class="inner-fraz"><thead><tr><th>Data</th><th>Causale</th><th>Importo €</th></tr></thead><tbody>';
        f.transactions.forEach((t: any) => {
          const d = fmt(t.date);
          html += `<tr><td>${d}</td><td>${t.causale}</td><td style="text-align:right">${formatImporto(t.raw, t.amount)}</td></tr>`;
        });
        html += '</tbody></table></td></tr>';
      });
      html += '</tbody></table>';
      return html;
    }

    /* ---------------------- Transazioni Carte ------------------------------ */
    async function parseCards(file: File) {
      return readExcel(file);
    }
    function buildCardTable(rows: any[], depTot: number, filterMonth = '') {
      let hIdx = findHeaderRow(rows, 'amount');
    if (hIdx === -1) hIdx = findHeaderRow(rows, 'importo');
      if (hIdx === -1) return {
        html: '<p style="color:red">Intestazioni carte assenti.</p>',
        months: []
      };
      const hdr = rows[hIdx];
      const data = rows.slice(hIdx + 1).filter((r: any) => Array.isArray(r) && r.some((c: any) => c));
      const ix = {
        date: findCol(hdr, ['date', 'data']),
        pan: findCol(hdr, ['pan']),
        bin: findCol(hdr, ['bin']),
        name: findCol(hdr, ['holder', 'nameoncard']),
        type: findCol(hdr, ['cardtype']),
        prod: findCol(hdr, ['product']),
        ctry: findCol(hdr, ['country']),
        bank: findCol(hdr, ['bank']),
        amt: findCol(hdr, ['amount', 'importo', 'amounteur', 'importo€']),
        res: findCol(hdr, ['result']),
        ttype: findCol(hdr, ['transactiontype', 'transtype']),
        reason: findCol(hdr, ['reason'])
      };
      if (ix.pan === -1 || ix.amt === -1 || ix.ttype === -1) {
        return {
          html: '<p style="color:red">Colonne fondamentali mancanti.</p>',
          months: []
        };
      }
      const cards: any = {};
      const sum = {
        app: 0,
        dec: 0
      };
      const monthsSet = new Set<string>();
      data.forEach((r: any) => {
        const txType = String(r[ix.ttype] || '').toLowerCase();
        const accepted = ['sale', 'payment', 'capture', 'charge', 'acq'];
        if (!accepted.some(k => txType.includes(k))) return;
        let dt = null;
        if (ix.date !== -1) {
          dt = excelToDate(r[ix.date]);
          if (dt && !isNaN(dt.getTime())) {
            const mk = monthKey(dt);
            monthsSet.add(mk);
            if (filterMonth && mk !== filterMonth) return;
          } else if (filterMonth) {
            return;
          }
        } else if (filterMonth) {
          return;
        }
        const pan = r[ix.pan] || 'UNKNOWN';
        cards[pan] ??= {
          bin: ix.bin !== -1 ? r[ix.bin] || String(pan).slice(0, 6) : '',
          pan,
          name: ix.name !== -1 ? r[ix.name] || '' : '',
          type: ix.type !== -1 ? r[ix.type] || '' : '',
          prod: ix.prod !== -1 ? r[ix.prod] || '' : '',
          ctry: ix.ctry !== -1 ? r[ix.ctry] || '' : '',
          bank: ix.bank !== -1 ? r[ix.bank] || '' : '',
          app: 0,
          dec: 0,
          nDec: 0,
          reasons: new Set()
        };
        const amt = parseNum(r[ix.amt]);
        const resVal = ix.res !== -1 ? String(r[ix.res] || '') : 'approved';
        if (/^approved$/i.test(resVal)) {
          cards[pan].app += amt;
          sum.app += amt;
        } else {
          cards[pan].dec += amt;
          sum.dec += amt;
          cards[pan].nDec += 1;
          if (ix.reason !== -1 && r[ix.reason]) cards[pan].reasons.add(r[ix.reason]);
        }
      });
      const months = Array.from(monthsSet).sort().reverse().filter(k => {
        const [y, m] = k.split('-').map(n => parseInt(n, 10));
        const d = new Date();
        return y < d.getFullYear() || y === d.getFullYear() && m <= d.getMonth() + 1;
      });
      const caption = filterMonth ? `Carte – ${monthLabel(filterMonth)}` : 'Carte – Totale';
      const tbl = document.createElement('table');
      tbl.className = 'transactions-table';
      tbl.innerHTML = `
        <caption>${caption}</caption>
        <colgroup>
          <col style="width:6%"><col style="width:9%"><col style="width:17%">
          <col style="width:8%"><col style="width:9%"><col style="width:7%">
          <col style="width:10%"><col style="width:8%"><col style="width:8%">
          <col style="width:7%"><col style="width:7%"><col>
        </colgroup>
        <thead><tr>
          <th>BIN</th><th>PAN</th><th>Holder</th><th>Type</th><th>Product</th>
          <th>Country</th><th>Bank</th><th>Approved €</th><th>Declined €</th>
          <th>#Declined</th><th>% Depositi</th><th>Reason Codes</th>
        </tr></thead><tbody></tbody>
        <tfoot><tr>
          <th colspan="7" style="text-align:right">TOTAL:</th>
          <th style="text-align:right">${sum.app.toFixed(2)}</th>
          <th style="text-align:right">${sum.dec.toFixed(2)}</th>
          <th></th><th></th><th></th>
        </tr></tfoot>`;
      const tb = tbl.querySelector('tbody')!;
      Object.values(cards).forEach((c: any) => {
        const perc = depTot ? (c.app / depTot * 100).toFixed(2) + '%' : '—';
        tb.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${c.bin}</td><td>${c.pan}</td><td>${c.name}</td><td>${c.type}</td><td>${c.prod}</td>
            <td>${c.ctry}</td><td>${c.bank}</td>
            <td style="text-align:right">${c.app.toFixed(2)}</td>
            <td style="text-align:right">${c.dec.toFixed(2)}</td>
            <td style="text-align:right">${c.nDec}</td>
            <td style="text-align:right">${perc}</td>
            <td>${[...c.reasons].join(', ')}</td>
          </tr>`);
      });
      return {
        html: tbl.outerHTML,
        months
      };
    }

    /* ------------ Render cartes table & dropdown --------------------------- */
    function renderCards(rows: any[], depTot: number) {
      cardResult!.innerHTML = '';
      cardResult!.classList.add('hidden');
      const first = buildCardTable(rows, depTot, '');
      const select = document.createElement('select');
      select.innerHTML = '<option value="">Totale</option>' + first.months.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('');
      select.style.marginRight = '.5rem';
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '.5rem';
      const lbl = document.createElement('label');
      lbl.textContent = 'Filtro mese: ';
      lbl.appendChild(select);
      wrapper.appendChild(lbl);
      cardResult!.appendChild(wrapper);
      const tableContainer = document.createElement('div');
      tableContainer.innerHTML = first.html;
      cardResult!.appendChild(tableContainer);
      cardResult!.classList.remove('hidden');
      select.addEventListener('change', () => {
        const res = buildCardTable(rows, depTot, select.value);
        tableContainer.innerHTML = res.html;
      });
    }

    /* -------------------------- Main handler ------------------------------- */
    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true;
      
      // Clear previous results from localStorage and DOM when starting new analysis
      localStorage.removeItem('amlTransactionData');
      
      // Clear previous transaction content from DOM
      const depositEl = document.getElementById('deposit-summary');
      const withdrawEl = document.getElementById('withdraw-summary');
      const cardEl = document.getElementById('cards-summary');
      if (depositEl) {
        depositEl.innerHTML = '';
        depositEl.classList.add('hidden');
      }
      if (withdrawEl) {
        withdrawEl.innerHTML = '';
        withdrawEl.classList.add('hidden');
      }
      if (cardEl) {
        cardEl.innerHTML = '';
        cardEl.classList.add('hidden');
      }
      
      try {
        const depositData = await parseMovements(depositInput.files![0], 'deposit');
        renderMovements(depositResult!, 'Depositi', depositData);
        const withdrawData = await parseMovements(withdrawInput.files![0], 'withdraw');
        renderMovements(withdrawResult!, 'Prelievi', withdrawData);
        
        let cardRows = null;
        if ((includeCard?.checked ?? true)) {
          cardRows = await parseCards(cardInput.files![0]);
          renderCards(cardRows as any[], depositData.totAll);
        } else {
          cardResult!.innerHTML = '';
          cardResult!.classList.add('hidden');
        }

        // PERSISTENCE FEATURE: Save structured data for restoration
        setTimeout(() => {
          const results = {
            depositData: depositData,
            withdrawData: withdrawData,
            cardData: cardRows,
            includeCard: (includeCard?.checked ?? true),
            hasDeposits: !!depositFile,
            hasWithdraws: !!withdrawFile,
            hasCards: !!cardFile,
            timestamp: Date.now()
          };
          
          setTransactionResults(results);
          
          // Save structured data and set processed flag
          localStorage.setItem('aml_transaction_results', JSON.stringify(results));
          localStorage.setItem('aml_files_processed', 'true');
          console.log('💾 Transaction results saved to localStorage');
        }, 500);
      } catch (err) {
        console.error(err);
        alert('Errore durante l\'analisi: ' + (err as Error).message);
      }
      analyzeBtn.disabled = false;
    });
  };

  // Original parseDate function from giasai repository
  const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split(/[\s/:]/);
    if (parts.length >= 6) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(parts[3]), Number(parts[4]), Number(parts[5]));
    }
    return new Date(dateStr);
  };

  // Original handleFile function from giasai repository (exactly as it is)
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array'
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          header: 1
        });

        // Individua la riga di intestazione cercando le colonne "Causale/Reason" e "Importo/Amount"
        let headerIdx = 0;
        for (let i = 0; i < jsonData.length; i++) {
          const r = jsonData[i] as any[];
          if (!r || r.length < 9) continue;
          const c7 = String(r[7] || '').toLowerCase();
          const c8 = String(r[8] || '').toLowerCase();
          if ((c7.includes('caus') || c7.includes('reason')) && (c8.includes('importo') || c8.includes('amount'))) {
            headerIdx = i;
            break;
          }
        }
        const headerRow = (jsonData[headerIdx] as any[] || []).map(h => typeof h === 'string' ? h.trim() : h);

        // Trova indice colonna TSN / TS extension (case-insensitive, ignora spazi)
        const tsIndex = headerRow.findIndex(h => {
          if (!h) return false;
          const norm = String(h).toLowerCase().replace(/\s+/g, '');
          return norm.includes('tsn') || norm.includes('tsextension');
        });
        console.log('[Toppery AML] Header row:', headerRow, 'TS index:', tsIndex);
        const rows = (jsonData.slice(headerIdx + 1) as any[][]).filter(row => row.length >= 9 && row[0] && row[7] && row[8]);
        const parsedTransactions = rows.map(row => {
          const dataStr = row[0];
          const causale = row[7];
          const importo = parseFloat(String(row[8]).replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.'));
          const dataObj = parseDate(dataStr);
          const tsVal = tsIndex !== -1 ? row[tsIndex] : '';
          const tx: Transaction = {
            data: dataObj,
            dataStr: dataStr,
            causale: causale,
            importo: importo,
            importo_raw: row[8]
          };
          if (tsIndex !== -1 && tsVal != null && tsVal !== '') {
            tx["TSN"] = tsVal;
            tx["TS extension"] = tsVal;
          }
          return tx;
        }).filter(tx => tx.data instanceof Date && !isNaN(tx.data.getTime()));

        // Salva timestamp per analisi sessioni orarie
        const sessionTsData = parsedTransactions.map(tx => ({
          timestamp: tx.data.toISOString()
        }));
        console.log("Transactions parsed:", parsedTransactions);
        if (parsedTransactions.length > 0) {
          setTransactions(parsedTransactions);
          setSessionTimestamps(sessionTsData);
          toast.success(`${parsedTransactions.length} transazioni caricate con successo`);
        } else {
          toast.error('Nessuna transazione valida trovata nel file');
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Errore durante la lettura del file Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Original cercaFrazionate function from giasai repository (exactly as it is)
  const cercaFrazionate = (transactions: Transaction[]): Frazionata[] => {
    // La finestra si segnala solo se la somma SUPERA €4 999
    const THRESHOLD = 4999; // numero intero senza separatori per compatibilità browser
    const frazionate: Frazionata[] = [];

    // Normalizza la data a inizio giornata (ignora ore/minuti)
    const startOfDay = (d: Date) => {
      const t = new Date(d);
      t.setHours(0, 0, 0, 0);
      return t;
    };
    const fmtDateLocal = (d: Date) => {
      const dt = startOfDay(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };

    // Consideriamo solo i depositi ("Ricarica conto gioco per accredito diretto")
    const depositi = transactions.filter(tx => tx.causale === "Ricarica conto gioco per accredito diretto").sort((a, b) => a.data.getTime() - b.data.getTime());
    let i = 0;
    while (i < depositi.length) {
      const windowStart = startOfDay(depositi[i].data);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 6); // inclusivo

      let running = 0;
      const collected: Transaction[] = [];
      let j = i;
      while (j < depositi.length && depositi[j].data <= windowEnd) {
        running += Math.abs(depositi[j].importo);
        collected.push(depositi[j]);
        if (running > THRESHOLD) {
          // Giorno in cui si è superata la soglia
          const sogliaDay = startOfDay(depositi[j].data);

          // Includi ogni altro deposito che cade nello stesso giorno
          j++;
          while (j < depositi.length && startOfDay(depositi[j].data).getTime() === sogliaDay.getTime()) {
            running += Math.abs(depositi[j].importo);
            collected.push(depositi[j]);
            j++;
          }

          // Registra la frazionata
          frazionate.push({
            start: fmtDateLocal(windowStart),
            end: fmtDateLocal(sogliaDay),
            total: running,
            transactions: collected.map(t => ({
              date: t.data.toISOString(),
              amount: t.importo,
              causale: t.causale
            }))
          });

          // Riprendi dal primo deposito del giorno successivo
          i = j;
          break;
        }
        j++;
      }
      if (running <= THRESHOLD) {
        // Soglia non superata: avanza di una transazione
        i++;
      }
    }
    return frazionate;
  };

  // Original cercaPatternAML function from giasai repository (exactly as it is)
  const cercaPatternAML = (transactions: Transaction[]): string[] => {
    const patterns: string[] = [];
    const depositi = transactions.filter(tx => tx.causale === "Ricarica conto gioco per accredito diretto");
    const prelievi = transactions.filter(tx => tx.causale.toLowerCase().includes("prelievo"));
    for (let dep of depositi) {
      const matchingPrelievi = prelievi.filter(pr => {
        const diffTime = pr.data.getTime() - dep.data.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 2;
      });
      if (matchingPrelievi.length > 0) {
        patterns.push("Ciclo deposito-prelievo rapido rilevato");
        break;
      }
    }
    const bonusTx = transactions.filter(tx => tx.causale.toLowerCase().includes("bonus"));
    for (let bonus of bonusTx) {
      const prelieviDopoBonus = prelievi.filter(pr => pr.data > bonus.data);
      if (prelieviDopoBonus.length > 0) {
        patterns.push("Abuso bonus sospetto rilevato");
        break;
      }
    }
    return patterns;
  };

  // Original calcolaScoring function from giasai repository (exactly as it is)
  const calcolaScoring = (frazionate: Frazionata[], patterns: string[]) => {
    let score = 0;
    const motivations: string[] = [];
    if (frazionate.length > 0) {
      score += 40;
      motivations.push("Frazionate rilevate");
    }
    patterns.forEach(pattern => {
      if (pattern.includes("Ciclo deposito-prelievo")) {
        score += 20;
        motivations.push("Ciclo deposito-prelievo rapido rilevato");
      }
      if (pattern.includes("Abuso bonus")) {
        score += 20;
        motivations.push("Abuso bonus sospetto rilevato");
      }
    });
    let level = "Low";
    if (score > 65) {
      level = "High";
    } else if (score > 30) {
      level = "Medium";
    }
    return {
      score,
      level,
      motivations
    };
  };

  // Original rilevaAlertAML function from giasai repository (exactly as it is)
  const rilevaAlertAML = (txs: Transaction[]): string[] => {
    const alerts: string[] = [];
    const norm = (s: string) => (s || '').toLowerCase();

    // classificazione base
    const classify = (c: string) => {
      const cl = norm(c);
      if (cl.includes('ricarica') || cl.includes('deposit')) return 'deposit';
      if (cl.includes('prelievo') || cl.includes('withdraw')) return 'withdraw';
      if (cl.includes('bonus')) return 'bonus';
      if (cl.includes('session')) return 'session';
      return 'other';
    };
    const moves = txs.map(tx => ({
      ...tx,
      type: classify(tx.causale)
    })).sort((a, b) => a.data.getTime() - b.data.getTime());

    /* ---- 1. Velocity deposit: ≥3 depositi da >=€500 in ≤10 min ---- */
    const V_N = 3,
      V_MIN = 10,
      V_AMT = 500;
    let win: any[] = [];
    for (const m of moves) {
      if (m.type !== 'deposit' || Math.abs(m.importo) < V_AMT) continue;
      win.push(m);
      while (win.length && (m.data.getTime() - win[0].data.getTime()) / 60000 > V_MIN) {
        win.shift();
      }
      if (win.length >= V_N) {
        alerts.push(`Velocity deposit: ${win.length} depositi >=€${V_AMT} in ${V_MIN} min (ultimo ${m.data.toLocaleString()})`);
        win = [];
      }
    }

    /* ---- 2. Bonus concentration: mostra ogni bonus individualmente se viene rilevata concentrazione ≥2 bonus in 24h ---- */
    const B_N = 2,
      B_H = 24;
    win = [];
    let flagged = new Set();
    for (const m of moves) {
      if (m.type !== 'bonus') continue;
      win.push(m);
      while (win.length && (m.data.getTime() - win[0].data.getTime()) / 3600000 > B_H) {
        win.shift();
      }
      if (win.length >= B_N) {
        // registra ogni bonus nella finestra, se non già registrato
        win.forEach(b => {
          if (flagged.has(b)) return;
          alerts.push(`Bonus concentration: bonus €${Math.abs(b.importo).toFixed(2)} (${b.data.toLocaleString()})`);
          flagged.add(b);
        });
      }
    }

    /* ---- 3. Casino live sessions ---- */
    const liveSessions = moves.filter(m => m.type === 'session' && norm(m.causale).includes('live'));
    if (liveSessions.length) {
      alerts.push(`Casino live: ${liveSessions.length} sessioni live rilevate`);
    }
    return alerts;
  };

  // Original runAnalysis function from giasai repository (exactly as it is)
  const runAnalysis = () => {
    if (transactions.length === 0) {
      toast.error('Carica prima un file Excel');
      return;
    }
    setIsAnalyzing(true);
    try {
      const frazionate = cercaFrazionate(transactions);
      const patterns = cercaPatternAML(transactions);
      const scoringResult = calcolaScoring(frazionate, patterns);
      const alerts = rilevaAlertAML(transactions);
      console.log("Frazionate trovate:", frazionate);
      console.log("Pattern AML trovati:", patterns);
      console.log("Scoring:", scoringResult);
      const analysisResults: AmlResults = {
        riskScore: scoringResult.score,
        riskLevel: scoringResult.level,
        motivations: scoringResult.motivations,
        frazionate: frazionate,
        patterns: patterns,
        alerts: alerts,
        sessions: sessionTimestamps
      };
      setResults(analysisResults);
      toast.success('Analisi completata con successo');
    } catch (error) {
      console.error('Error during analysis:', error);
      toast.error('Errore durante l\'analisi');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // EXACT ORIGINAL LOGIC FROM TRANSACTIONS.JS - DO NOT MODIFY
  const analyzeTransactions = async () => {
    if (!includeCard && !depositFile && !withdrawFile) {
      toast.error('Carica almeno un file per l\'analisi');
      return;
    }
    try {
      const parseNum = (v: any) => {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (v == null) return 0;
        let s = String(v).trim();
        if (!s) return 0;
        s = s.replace(/\s+/g, '');
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if (lastComma > -1 && lastDot > -1) {
          if (lastComma > lastDot) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
          } else {
            s = s.replace(/,/g, '');
          }
        } else if (lastComma > -1) {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          s = s.replace(/[^0-9.-]/g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };
      const excelToDate = (d: any) => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') {
          const base = new Date(1899, 11, 30, 0, 0, 0);
          base.setDate(base.getDate() + d);
          return base;
        }
        if (typeof d === 'string') {
          const s = d.trim();
          const m = s.match(/^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{2,4})(?:\D+([0-2]?\d):([0-5]?\d)(?::([0-5]?\d))?)?/);
          if (m) {
            let day = +m[1];
            let mon = +m[2] - 1;
            let yr = +m[3];
            if (yr < 100) yr += 2000;
            const hh = m[4] != null ? +m[4] : 0;
            const mm = m[5] != null ? +m[5] : 0;
            const ss = m[6] != null ? +m[6] : 0;
            return new Date(yr, mon, day, hh, mm, ss);
          }
          if (s.endsWith('Z')) {
            const dUTC = new Date(s);
            return new Date(dUTC.getUTCFullYear(), dUTC.getUTCMonth(), dUTC.getUTCDate(), dUTC.getUTCHours(), dUTC.getUTCMinutes(), dUTC.getUTCSeconds());
          }
          const tryDate = new Date(s);
          if (!isNaN(tryDate.getTime())) return tryDate;
        }
        return new Date('');
      };
      const readExcel = (file: File) => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = e => {
          try {
            const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), {
              type: 'array'
            });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
              header: 1
            });
            res(rows);
          } catch (err) {
            rej(err);
          }
        };
        fr.onerror = rej;
        fr.readAsArrayBuffer(file);
      });
      const results: any = {};
      if (depositFile) {
        const depositData = await parseMovements(depositFile, 'deposit', parseNum, excelToDate, readExcel);
        results.deposits = depositData;
      }
      if (withdrawFile) {
        const withdrawData = await parseMovements(withdrawFile, 'withdraw', parseNum, excelToDate, readExcel);
        results.withdraws = withdrawData;
        results.frazionate = (withdrawData && withdrawData.frazionate) ? withdrawData.frazionate : [];
      }
      if (includeCard && cardFile) {
        const cardData = await parseCards(cardFile, readExcel);
        results.cards = cardData;
      }
      setTransactionResults(results);
      toast.success('Analisi transazioni completata');
    } catch (error) {
      console.error('Error analyzing transactions:', error);
      toast.error('Errore durante l\'analisi delle transazioni');
    }
  };
  const parseMovements = async (file: File, mode: 'deposit' | 'withdraw', parseNum: any, excelToDate: any, readExcel: any) => {
    const RE = mode === 'deposit' ? /^(deposito|ricarica)/i : /^prelievo/i;
    const rows: any = await readExcel(file);
    const findHeaderRow = (rows: any[], h: string) => rows.findIndex((r: any) => Array.isArray(r) && r.some((c: any) => typeof c === 'string' && String(c).toLowerCase().replace(/[^a-z0-9]/g, '').includes(String(h).toLowerCase().replace(/[^a-z0-9]/g, ''))));
    const findCol = (hdr: any[], als: string[]) => {
      const s = hdr.map((h: any) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (const a of als) {
        const i = s.findIndex((v: string) => v.includes(String(a).toLowerCase().replace(/[^a-z0-9]/g, '')));
        if (i !== -1) return i;
      }
      return -1;
    };
    const hIdx = findHeaderRow(rows, 'importo');
    const hdr = hIdx !== -1 ? rows[hIdx] : [];
    const data = hIdx !== -1 ? rows.slice(hIdx + 1) : rows;
    const cDate = hIdx !== -1 ? findCol(hdr, ['data', 'date']) : 0;
    const cDesc = hIdx !== -1 ? findCol(hdr, ['descr', 'description']) : 1;
    const cAmt = hIdx !== -1 ? findCol(hdr, ['importo', 'amount']) : 2;
    const all = Object.create(null);
    const perMonth = Object.create(null);
    let totAll = 0,
      latest = new Date(0);
    data.forEach((r: any) => {
      if (!Array.isArray(r)) return;
      const desc = String(r[cDesc] ?? '').trim();
      if (!RE.test(desc)) return;
      const method = mode === 'deposit' && desc.toLowerCase().startsWith('ricarica') ? 'Cash' : desc.replace(RE, '').trim() || 'Sconosciuto';
      const amt = parseNum(r[cAmt]);
      if (!amt) return;
      all[method] = (all[method] || 0) + amt;
      totAll += amt;
      const dt = excelToDate(r[cDate]);
      if (!dt || isNaN(dt.getTime())) return;
      if (dt > latest) latest = dt;
      const monthKey = (dt: Date) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      const k = monthKey(dt);
      perMonth[method] ??= {};
      perMonth[method][k] = (perMonth[method][k] || 0) + amt;
    });
    const monthsSet = new Set();
    Object.values(perMonth).forEach((obj: any) => {
      Object.keys(obj).forEach(k => monthsSet.add(k));
    });
    const months = Array.from(monthsSet).sort().reverse().filter((k: any) => {
      const [y, m] = (k as string).split('-').map(n => parseInt(n, 10));
      const d = new Date();
      return y < d.getFullYear() || y === d.getFullYear() && m <= d.getMonth() + 1;
    });
    return {
      totAll,
      months,
      all,
      perMonth
    };
  };
  
const parseCards = async (file: File, readExcel: any) => {
  const rows: any[] = await readExcel(file);

  // helper to sanitize strings
  const sanitize = (s: any): string => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const findHeaderRow = (rows: any[][], h: string) =>
    rows.findIndex(r => Array.isArray(r) && r.some((c: any) => typeof c === 'string' && sanitize(c).includes(sanitize(h))));
  const findCol = (hdr: any[], aliases: string[]) => {
    const s = hdr.map(sanitize);
    for (const a of aliases) {
      const i = s.findIndex(v => v.includes(sanitize(a)));
      if (i !== -1) return i;
    }
    return -1;
  };
  const parseNum = (v: any) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/[€\s]/g, '');
    // thousands sep "." decimal ","
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (lastComma > -1) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const hIdxAmount = findHeaderRow(rows, 'amount');
  const hIdx = hIdxAmount !== -1 ? hIdxAmount : findHeaderRow(rows, 'importo');
  if (hIdx === -1) return [];

  const hdr = rows[hIdx];
  const dataRows = rows.slice(hIdx + 1).filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));

  const idx = {
    date  : findCol(hdr, ['date', 'data']),
    pan   : findCol(hdr, ['pan']),
    bin   : findCol(hdr, ['bin']),
    name  : findCol(hdr, ['holder', 'nameoncard']),
    type  : findCol(hdr, ['cardtype', 'type']),
    prod  : findCol(hdr, ['product', 'prod']),
    ctry  : findCol(hdr, ['country', 'ctry']),
    bank  : findCol(hdr, ['bank']),
    amt   : findCol(hdr, ['amount', 'importo', 'amounteur', 'importo€']),
    res   : findCol(hdr, ['result', 'esito']),
    ttype : findCol(hdr, ['transactiontype', 'transtype', 'type']),
    reason: findCol(hdr, ['reason'])
  };

  const cards: Record<string, any> = {};
  const accepted = ['sale', 'payment', 'capture', 'charge', 'acq'];

  dataRows.forEach(r => {
    const txType = idx.ttype !== -1 ? String(r[idx.ttype] || '').toLowerCase() : '';
    if (txType && !accepted.some(k => txType.includes(k))) return;

    const pan = idx.pan !== -1 ? String(r[idx.pan] || '').trim() : 'UNKNOWN';
    if (!cards[pan]) {
      cards[pan] = {
        bin   : idx.bin !== -1 ? (r[idx.bin] || String(pan).slice(0, 6)) : '',
        pan,
        holder: idx.name !== -1 ? (r[idx.name] || '') : '',
        type  : idx.type !== -1 ? (r[idx.type] || '') : '',
        prod  : idx.prod !== -1 ? (r[idx.prod] || '') : '',
        country: idx.ctry !== -1 ? (r[idx.ctry] || '') : '',
        bank   : idx.bank !== -1 ? (r[idx.bank] || '') : '',
        approved: 0,
        declined: 0,
        numDeclined: 0,
        reasons: new Set<string>()
      };
    }

    const amt = idx.amt !== -1 ? parseNum(r[idx.amt]) : 0;
    const resVal = idx.res !== -1 ? String(r[idx.res] || '') : 'approved';

    if (/^approved$/i.test(resVal)) {
      cards[pan].approved += amt;
    } else {
      cards[pan].declined += amt;
      cards[pan].numDeclined += 1;
      if (idx.reason !== -1 && r[idx.reason]) cards[pan].reasons.add(r[idx.reason]);
    }
  });

  // convert reasons set to array / string
  const result = Object.values(cards).map((c: any) => ({
    ...c,
    reasonCodes: Array.from(c.reasons).join('; ')
  }));

  return result;
};


  // ORIGINAL GRAFICI LOGIC FROM ANALYSIS.JS - RESTORED
  useEffect(() => {
    if (activeTab === 'grafici') {
      // Helper function for parsing detail
      const parseDetail = (detail: string) => {
        let fixed = detail.replace(/â‚¬/g, "€").replace(/Â/g, "").trim();
        const sepIdx = fixed.indexOf(':');
        const cat = sepIdx >= 0 ? fixed.slice(0, sepIdx).trim() : '';
        const restStr = sepIdx >= 0 ? fixed.slice(sepIdx + 1).trim() : fixed;
        const depMatch = fixed.match(/deposito\s+€([\d.,]+)/i);
        const preMatch = fixed.match(/prelievo\s+€([\d.,]+)/i);
        const bonusMatch = fixed.match(/bonus\s+€([\d.,]+)/i);
        const countMatch = fixed.match(/(\d+)\s+depositi/i);
        const maxMatch = fixed.match(/≤€([\d.,]+)/);
        const timeMatchMin = fixed.match(/in\s+([\d.,]+)\s+min/i);
        const timeMatchH = fixed.match(/in\s+([\d.,]+)\s*h/i);
        return {
          cat,
          deposito: depMatch ? depMatch[1] : countMatch ? countMatch[1] : '',
          prelievo: preMatch ? preMatch[1] : bonusMatch ? bonusMatch[1] : maxMatch ? maxMatch[1] : '',
          tempo: timeMatchMin ? timeMatchMin[1] : timeMatchH ? timeMatchH[1] + 'h' : '',
          detail: restStr
        };
      };
      const normalizeCausale = (causale: string) => {
        if (!causale) return '';
        const lc = causale.toLowerCase().trim();
        if (lc.startsWith('session slot') || lc.startsWith('sessione slot')) {
          return lc.includes('(live') ? 'Session Slot (Live)' : 'Session Slot';
        }
        return causale;
      };

      // Build AML/Fraud alerts chart
      if (results?.alerts) {
        const alertsArr = results.alerts;
        const counts: Record<string, number> = {};
        alertsArr.forEach((a: string) => {
          const type = a.split(':')[0];
          counts[type] = (counts[type] || 0) + 1;
        });
        const catOrder = ["Velocity deposit", "Bonus concentration", "Casino live"];
        const sortedAlerts = alertsArr.slice().sort((a: string, b: string) => {
          const getKey = (s: string) => s.split(':')[0];
          return catOrder.indexOf(getKey(a)) - catOrder.indexOf(getKey(b));
        });
        const detailsRows = sortedAlerts.map((e: string) => {
          const d = parseDetail(e);
          return `<tr>
            <td>${d.cat}</td>
            <td style="text-align:right;">${d.deposito}</td>
            <td style="text-align:right;">${d.prelievo}</td>
            <td style="text-align:right;">${d.tempo}</td>
            <td>${d.detail}</td>
          </tr>`;
        }).join('');
        const alertsDetailsBody = document.getElementById('alertsDetailsBody');
        if (alertsDetailsBody) {
          alertsDetailsBody.innerHTML = detailsRows;
        }
        const alertsCtx = (document.getElementById('alertsChart') as HTMLCanvasElement)?.getContext('2d');
        if (alertsCtx) {
          new Chart(alertsCtx, {
            type: 'bar',
            data: {
              labels: catOrder,
              datasets: [{
                data: catOrder.map(k => counts[k] || 0)
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  display: false
                }
              }
            }
          });
        }
      }

      // Build clickable pie chart for causali distribution
      const amlTransactions = localStorage.getItem('amlTransactions');
      let allTx: any[] = [];
      if (amlTransactions) {
        try {
          const parsed = JSON.parse(amlTransactions);
          allTx = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          allTx = [];
        }
      } else if (transactions?.length > 0) {
        allTx = [...transactions];
      }
      if (allTx.length > 0) {
        const causaleCount: Record<string, number> = {};
        const causaleTxMap: Record<string, any[]> = {};
        allTx.forEach(tx => {
          const key = normalizeCausale(tx.causale);
          if (!causaleCount[key]) {
            causaleCount[key] = 0;
            causaleTxMap[key] = [];
          }
          causaleCount[key]++;
          const dt = tx.dataStr || tx.data || tx.date || tx.Data || null;
          const caus = tx.causale || tx.Causale || '';
          const amt = tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0;
          causaleTxMap[key].push({
            rawDate: tx.data || tx.date || tx.Data || null,
            displayDate: dt,
            date: tx.data instanceof Date ? tx.data : tx.date instanceof Date ? tx.date : tx.Data instanceof Date ? tx.Data : null,
            causale: caus,
            importo_raw: tx.importo_raw ?? tx.importoRaw ?? tx.amountRaw ?? tx.amount_str ?? tx.amountStr ?? amt,
            amount: Number(amt) || 0
          });
        });
        Object.values(causaleTxMap).forEach((arr: any[]) => {
          arr.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        });
        const labels = Object.keys(causaleCount);
        const data = Object.values(causaleCount);
        const causaliCtx = (document.getElementById('causaliChart') as HTMLCanvasElement)?.getContext('2d');
        if (causaliCtx) {
          const palette = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
          const causaliChart = new Chart(causaliCtx, {
            type: 'pie',
            data: {
              labels,
              datasets: [{
                data,
                backgroundColor: labels.map((_, i) => palette[i % palette.length])
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'top',
                  labels: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '#000'
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function (ctx: any) {
                      const lbl = ctx.label || '';
                      const val = ctx.raw;
                      const tot = data.reduce((s: number, n: number) => s + n, 0);
                      const pct = tot ? (val / tot * 100).toFixed(1) : '0.0';
                      return `${lbl}: ${val} (${pct}%)`;
                    }
                  }
                }
              }
            }
          });

          // Modal functions - declare them first
          const fmtDateIT = (d: any) => {
            const dt = parseTxDate(d);
            if (!dt) return d == null ? '' : String(d);
            try {
              return dt.toLocaleDateString('it-IT');
            } catch (_) {
              return dt.toISOString().slice(0, 10);
            }
          };
          const parseTxDate = (v: any) => {
            if (!v && v !== 0) return null;
            if (v instanceof Date && !isNaN(v.getTime())) return v;
            if (typeof v === 'number' || /^\d+$/.test(String(v).trim()) && String(v).length >= 10 && String(v).length <= 13) {
              const num = Number(v);
              const ms = String(v).length > 10 ? num : num * 1000;
              const d = new Date(ms);
              return isNaN(d.getTime()) ? null : d;
            }
            const s = String(v).trim();
            const iso = Date.parse(s);
            if (!isNaN(iso)) return new Date(iso);
            const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
            if (m) {
              let [_, d, mo, y, h, mi, se] = m;
              y = y.length === 2 ? '20' + y : y;
              const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 0), Number(mi || 0), Number(se || 0));
              return isNaN(dt.getTime()) ? null : dt;
            }
            return null;
          };
          const escapeHtml = (str: string) => {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          };
          const openCausaliModal = (label: string, txs: any[]) => {
            txs = Array.isArray(txs) ? txs : [];
            setModalData({
              isOpen: true,
              title: `Movimenti: ${label} (${txs.length})`,
              transactions: txs
            });
          };

          // Click handler for the pie chart
          const canvas = causaliChart.canvas;
          canvas.addEventListener('click', function (evt: MouseEvent) {
            const points = causaliChart.getElementsAtEventForMode(evt, 'nearest', {
              intersect: true
            }, true);
            if (!points.length) return;
            const idx = points[0].index;
            const label = causaliChart.data.labels[idx];
            const txs = causaleTxMap[label] || [];
            openCausaliModal(label, txs);
          }, false);

          // Store references globally for modal functionality
          (window as any).causaliChart = causaliChart;
          (window as any).causaliTxMap = causaleTxMap;
        }
      }

      // No need for manual event handlers anymore - using React state
    }
  }, [activeTab, results, transactions]);

  // Helper functions for modal data formatting
  const fmtDateIT = (d: any) => {
    const dt = parseTxDate(d);
    if (!dt) return d == null ? '' : String(d);
    try {
      return dt.toLocaleDateString('it-IT');
    } catch (_) {
      return dt.toISOString().slice(0, 10);
    }
  };
  const parseTxDate = (v: any) => {
    if (!v && v !== 0) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    if (typeof v === 'number' || /^\d+$/.test(String(v).trim()) && String(v).length >= 10 && String(v).length <= 13) {
      const num = Number(v);
      const ms = String(v).length > 10 ? num : num * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    const s = String(v).trim();
    const iso = Date.parse(s);
    if (!isNaN(iso)) return new Date(iso);
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      let [_, d, mo, y, h, mi, se] = m;
      y = y.length === 2 ? '20' + y : y;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 0), Number(mi || 0), Number(se || 0));
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  };
  const escapeHtml = (str: string) => {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const closeModal = () => {
    setModalData({
      isOpen: false,
      title: '',
      transactions: []
    });
  };

  // Handle escape key for modal
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalData.isOpen) {
        closeModal();
      }
    };
    if (modalData.isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [modalData.isOpen]);

  // LITERAL COPY PASTE FROM ANALYSIS.JS LINES 477-545 - ZERO CHANGES
  useEffect(() => {
    if (activeTab === 'importanti') {
      console.log('=== MOVIMENTI IMPORTANTI DEBUG ===');
      console.log('Active tab is importanti, running analysis...');

      // Debug all localStorage keys to see what's available
      console.log('All localStorage keys:', Object.keys(localStorage));

      // Try different possible keys for transaction data
      const amlTransactions = localStorage.getItem('amlTransactions');
      const transactionsLocal = localStorage.getItem('transactions');
      const allKeys = Object.keys(localStorage);
      console.log('amlTransactions:', amlTransactions ? 'exists' : 'null');
      console.log('transactionsLocal:', transactionsLocal ? 'exists' : 'null');
      console.log('All localStorage keys:', allKeys);

      // Try to find transaction data from the current transactions state - ADD NULL CHECK
      const transactionsArray = transactions || [];
      console.log('React transactions state length:', transactionsArray.length);
      let allTx: any[] = [];

      // First try localStorage
      if (amlTransactions) {
        try {
          const parsed = JSON.parse(amlTransactions);
          allTx = Array.isArray(parsed) ? parsed : [];
          console.log('Using amlTransactions from localStorage, length:', allTx.length);
        } catch (e) {
          console.error('Error parsing amlTransactions:', e);
          allTx = [];
        }
      } else if (transactionsArray.length > 0) {
        // Use React state transactions if localStorage is empty
        allTx = [...transactionsArray];
        console.log('Using React state transactions, length:', allTx.length);
      }
      console.log('Final allTx length:', allTx.length);
      console.log('All transactions length:', allTx.length);
      console.log('First few transactions:', allTx.slice(0, 3));
      if (!allTx.length) {
        console.log('No transactions found, exiting');
        return;
      }
      const toDate = (tx: any) => new Date(tx.data || tx.date || tx.Data || tx.dataStr || 0);
      allTx.sort((a: any, b: any) => toDate(a).getTime() - toDate(b).getTime()); // asc

      const amountAbs = (tx: any) => Math.abs(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
      const amountSigned = (tx: any) => Number(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
      const isWithdrawal = (tx: any) => /prelievo/i.test(tx.causale || tx.Causale || '');
      const isSession = (tx: any) => /(session|scommessa)/i.test(tx.causale || tx.Causale || '');
      console.log('Testing filters...');
      console.log('Withdrawals found:', allTx.filter(isWithdrawal).length);
      console.log('Sessions found:', allTx.filter(isSession).length);
      const top = (arr: any[]) => arr.sort((a: any, b: any) => amountAbs(b) - amountAbs(a)).slice(0, 5);
      const importantList = [...top(allTx.filter(isWithdrawal)), ...top(allTx.filter(isSession))];
      console.log('Important list length:', importantList.length);
      const seen = new Set();
      const important = importantList.filter(tx => {
        const key = (tx.dataStr || '') + (tx.causale || '') + amountAbs(tx);
        return !seen.has(key) && seen.add(key);
      });
      console.log('Unique important transactions:', important.length);
      const rows: string[] = [];
      important.forEach(tx => {
        const idx = allTx.indexOf(tx);
        const start = Math.max(0, idx - 5);
        const end = Math.min(allTx.length, idx + 6); // idx incluso
        for (let i = start; i < end; i++) {
          const t = allTx[i];
          const dat = t.dataStr || t.date || t.data || t.Data || '';
          const caus = t.causale || t.Causale || '';
          let rawAmt = amountSigned(t);
          const rawStr = (t.importo_raw ?? t.importoRaw ?? t.rawAmount ?? t.amountRaw ?? '').toString().trim();
          const amt = rawStr ? rawStr : rawAmt.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          const hl = t === tx ? ' style="background:rgba(35,134,54,0.30)"' : '';
          const tsExt = t["TSN"] || t["TS extension"] || t["TS Extension"] || t["ts extension"] || t["TS_extension"] || t["TSExtension"] || '';
          const safeVal = String(tsExt).replace(/"/g, '&quot;');
          const tsCell = tsExt ? `<a href="#" class="tsn-link" data-tsext="${safeVal}">${tsExt}</a>` : '';
          rows.push(`<tr${hl}><td>${dat}</td><td>${caus}</td><td>${tsCell}</td><td style="text-align:right;">${rawStr ? rawStr : amt}</td></tr>`);
        }
        rows.push('<tr><td colspan="4" style="background:#30363d;height:2px;"></td></tr>');
      });
      console.log('Generated rows:', rows.length);
      console.log('First few rows:', rows.slice(0, 2));
      const container = document.getElementById('movimentiImportantiSection');
      console.log('Container found:', !!container);
      if (container) {
        const tableHtml = `
              <table class="tx-table">
                  <thead><tr><th>Data</th><th>Causale</th><th>TSN</th><th>Importo</th></tr></thead>
                  <tbody>${rows.join('')}</tbody>
              </table>
          `;
        console.log('Setting innerHTML...');
        container.innerHTML = tableHtml;
        console.log('Table set, container innerHTML length:', container.innerHTML.length);
        container.querySelectorAll('.tsn-link').forEach((link: any) => {
          link.addEventListener('click', function (e: Event) {
            e.preventDefault();
            const val = this.getAttribute('data-tsext');
            if (!val) return;
            const modal = document.getElementById('causaliModal');
            const titleEl = document.getElementById('causaliModalTitle');
            const tableBody = document.querySelector('#causaliModalTable tbody');
            if (modal && titleEl && tableBody) {
              titleEl.textContent = 'Dettaglio Game Session ' + val;
              tableBody.innerHTML = '<tr><td colspan="3" style="padding:0"><iframe src="https://starvegas-gest.admiralbet.it/DettaglioGiocataSlot.asp?GameSessionID=' + encodeURIComponent(val) + '" style="width:100%;height:70vh;border:0;"></iframe></td></tr>';
              modal.removeAttribute('hidden');
            } else {
              window.open('https://starvegas-gest.admiralbet.it/DettaglioGiocataSlot.asp?GameSessionID=' + encodeURIComponent(val), '_blank');
            }
          });
        });
      }
      console.log('=== END MOVIMENTI IMPORTANTI DEBUG ===');
      // EXACT ORIGINAL CODE ENDS HERE
    }
  }, [activeTab]);

  // EXACT ORIGINAL LOGIC FROM ACCESSI.JS - DO NOT MODIFY  
  const analyzeAccessLog = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {
        type: 'array'
      });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1
      });
      const aliases = ['ip', 'ipaddress', 'ip address', 'ip_addr', 'indirizzoip', 'indirizzo ip'];
      const headerRowIdx = rows.findIndex((r: any) => Array.isArray(r) && r.some((c: any) => aliases.includes(String(c).toLowerCase().replace(/\s+/g, ''))));
      let ips: string[] = [];
      if (headerRowIdx !== -1) {
        const ipColIdx = (rows[headerRowIdx] as any[]).findIndex((c: any) => aliases.includes(String(c).toLowerCase().replace(/\s+/g, '')));
        ips = rows.slice(headerRowIdx + 1).filter((r: any) => Array.isArray(r) && r[ipColIdx]).map((r: any) => String(r[ipColIdx]).trim());
      }
      if (!ips.length) {
        rows.forEach((r: any) => {
          if (!Array.isArray(r)) return;
          r.forEach((cell: any) => {
            const m = String(cell || '').match(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/);
            if (m) ips.push(m[0]);
          });
        });
      }
      ips = [...new Set(ips.filter(Boolean))];
      if (!ips.length) return [];
      const out = [];
      for (const ip of ips) {
        out.push(await geoLookup(ip));
        await new Promise(r => setTimeout(r, 200));
      }
      return out;
    } catch (err) {
      console.error(err);
      throw new Error('Errore durante l\'analisi degli accessi');
    }
  };
  const geoLookup = async (ip: string) => {
    const ipRegex = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/;
    const isValidIp = (ip: string) => ipRegex.test(ip);
    const isPrivateIp = (ip: string) => /^(10\.|127\.|192\.168\.|0\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
    if (!isValidIp(ip)) return {
      ip,
      paese: 'non valido',
      isp: '-'
    };
    if (isPrivateIp(ip)) return {
      ip,
      paese: 'privato',
      isp: '-'
    };
    try {
      const r = await fetch(`https://ipapi.co/${ip}/json/`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.reason || r.status);
      return {
        ip,
        paese: j.country_name || '?',
        isp: j.org || j.company?.name || '?'
      };
    } catch (_) {
      try {
        const r2 = await fetch(`https://ipwho.is/${ip}`);
        const j2 = await r2.json();
        if (!j2 || j2.success === false) throw new Error(j2.message || r2.status);
        return {
          ip,
          paese: j2.country || '?',
          isp: j2.connection?.isp || j2.connection?.org || j2.isp || j2.org || '?'
        };
      } catch (err: any) {
        return {
          ip,
          paese: `errore (${err.message})`,
          isp: '-'
        };
      }
    }
  };

  // EXACT CALCULATION FOR NIGHT SESSIONS PERCENTAGE - DO NOT MODIFY
  const calculateNightSessionsPercentage = () => {
    if (!transactions.length) return "0%";
    const nightSessions = transactions.filter(tx => {
      const hour = tx.data.getHours();
      return hour >= 22 || hour <= 6;
    }).length;
    const percentage = (nightSessions / transactions.length * 100).toFixed(1);
    return `${percentage}% (${nightSessions}/${transactions.length})`;
  };
  const handleReset = () => {
    clearStore();
    setTransactions([]);
    setSessionTimestamps([]);
    setResults(null);
    setTransactionResults(null);
    setCardFile(null);
    setDepositFile(null);
    setWithdrawFile(null);
    
    // Clear localStorage for transaction analysis
    localStorage.removeItem('aml_transaction_results');
    localStorage.removeItem('aml_files_processed');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Torna al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Toppery AML</h1>
            
          </div>
        </div>

        {!results ? (/* File Upload Section */
      <div className="space-y-6">
            <Card className="p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Carica File Excel</h2>
                
                
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 mb-4" />
                
                {transactions.length > 0 && <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      ✅ {transactions.length} transazioni caricate
                    </p>
                    <Button onClick={runAnalysis} disabled={isAnalyzing} className="mt-2">
                      {isAnalyzing ? 'Analizzando...' : 'Avvia Analisi'}
                    </Button>
                  </div>}
              </div>
            </Card>
          </div>) : (/* Tabbed Navigation and Results Section */
      <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Risultati Analisi</h2>
              <Button onClick={handleReset} variant="outline">
                Nuova Analisi
              </Button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex gap-3 flex-wrap">
              {[{
            id: 'frazionate',
            label: 'Frazionate'
          }, {
            id: 'sessioni',
            label: 'Sessioni notturne'
          }, {
            id: 'grafici',
            label: 'Grafici'
          }, {
            id: 'transazioni',
            label: 'Transazioni'
          }, {
            id: 'importanti',
            label: 'Movimenti importanti'
          }, {
            id: 'accessi',
            label: 'Accessi'
          }].map(tab => <Button key={tab.id} variant={activeTab === tab.id ? 'default' : 'outline'} onClick={() => setActiveTab(tab.id)} size="sm">
                  {tab.label}
                </Button>)}
            </nav>

            {/* FRAZIONATE SECTION */}
            {activeTab === 'frazionate' && <div className="space-y-6">
                {/* Risk Assessment */}
                <Card className="p-6 text-center">
                  <h3 className="text-lg font-semibold mb-4">Livello di Rischio</h3>
                  <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl ${results.riskLevel === 'High' ? 'bg-red-500' : results.riskLevel === 'Medium' ? 'bg-orange-500' : 'bg-green-500'}`}>
                    {results.riskLevel}
                  </div>
                  <p className="mt-2 text-lg">Score: {results.riskScore}/100</p>
                </Card>

                {/* Frazionate */}
                {results.frazionate.length > 0 && <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Frazionate Rilevate ({results.frazionate.length})</h3>
                    {results.frazionate.map((fraz, index) => <div key={index} className="mb-4 p-4 border rounded-lg bg-card">
                        <p><strong>Periodo:</strong> {fraz.start} → {fraz.end}</p>
                        <p><strong>Totale:</strong> €{fraz.total.toFixed(2)}</p>
                        <p><strong>Transazioni:</strong> {fraz.transactions.length}</p>
                      </div>)}
                  </Card>}

                {/* Motivations */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Motivazioni del rischio</h3>
                  <ul className="space-y-2">
                    {results.motivations.map((motivation, index) => <li key={index} className="flex items-start gap-2">
                        <span className="h-2 w-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <span>{motivation}</span>
                      </li>)}
                  </ul>
                </Card>

                {/* Patterns */}
                {results.patterns.length > 0 && <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Pattern rilevati</h3>
                    <ul className="space-y-2">
                      {results.patterns.map((pattern, index) => <li key={index} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200">
                          {pattern}
                        </li>)}
                    </ul>
                  </Card>}

                {/* Alerts */}
                {results.alerts.length > 0 && <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Alert AML/Fraud ({results.alerts.length})</h3>
                    <ul className="space-y-2">
                      {results.alerts.map((alert, index) => <li key={index} className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
                          {alert}
                        </li>)}
                    </ul>
                  </Card>}
              </div>}

            {/* SESSIONI NOTTURNE SECTION */}
            {activeTab === 'sessioni' && <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Sessioni Notturne</h3>
                  <p className="mb-4">
                    Sessioni notturne rilevate: {calculateNightSessionsPercentage()}
                  </p>
                  <canvas ref={hourHeatmapRef} className="w-full max-w-2xl mx-auto"></canvas>
                </Card>
              </div>}

            {/* GRAFICI SECTION - RESTORED ORIGINAL CODE */}
            {activeTab === 'grafici' && <div className="space-y-6">
                {/* AML/Fraud Anomalies Chart - EXACT ORIGINAL */}
                <Card className="p-6" id="alertsCard">
                  <h3 className="text-lg font-semibold mb-4">Anomalie AML / Fraud</h3>
                  <p>Totale alert: <b>{results?.alerts?.length || 0}</b></p>
                  <div className="mt-4">
                    <canvas id="alertsChart" style={{
                maxHeight: '180px',
                marginBottom: '10px'
              }}></canvas>
                  </div>
                  {results?.alerts?.length > 0 && <details className="mt-4">
                      <summary style={{
                cursor: 'pointer'
              }}>Mostra dettagli ({results.alerts.length})</summary>
                      <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                marginTop: '6px'
              }}>
                        <table style={{
                  width: '100%',
                  fontSize: '12px',
                  borderCollapse: 'collapse'
                }}>
                          <thead>
                            <tr>
                              <th style={{
                        textAlign: 'left'
                      }}>Categoria</th>
                              <th>Valore 1</th>
                              <th>Valore 2</th>
                              <th>Tempo</th>
                              <th>Dettaglio</th>
                            </tr>
                          </thead>
                          <tbody id="alertsDetailsBody">
                            {/* Content populated by original JS logic */}
                          </tbody>
                        </table>
                      </div>
                    </details>}
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Timeline movimenti (frazionate)</h3>
                  <canvas ref={chartRef} className="w-full max-w-2xl mx-auto"></canvas>
                </Card>
                
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Distribuzione Causali </h3>
                  <canvas ref={causaliChartRef} className="w-full max-w-2xl mx-auto" id="causaliChart"></canvas>
                </Card>

                {/* REACT-MANAGED MODAL */}
                {modalData.isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeModal}></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">{modalData.title}</h3>
                        <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none">
                          ✕
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700">
                              <th className="border border-gray-200 dark:border-gray-600 p-2 text-left">Data</th>
                              <th className="border border-gray-200 dark:border-gray-600 p-2 text-left">Causale</th>
                              <th className="border border-gray-200 dark:border-gray-600 p-2 text-left">Importo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.transactions.length > 0 ? modalData.transactions.map((tx, idx) => {
                      const d = tx.displayDate != null && tx.displayDate !== '' ? tx.displayDate : fmtDateIT(tx.date ?? tx.rawDate);
                      const cau = tx.causale ?? '';
                      const rawStrVal = tx.importo_raw ?? tx.importoRaw ?? tx.rawAmount ?? tx.amountRaw ?? tx.amount_str ?? tx.amountStr;
                      const rawStr = rawStrVal == null ? '' : String(rawStrVal).trim();
                      let displayAmount = '';
                      if (rawStr) {
                        displayAmount = rawStr;
                      } else {
                        const rawAmt = Number(tx.amount);
                        displayAmount = isFinite(rawAmt) ? rawAmt.toLocaleString('it-IT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) : '';
                      }
                      return <tr key={idx}>
                                  <td className="border border-gray-200 dark:border-gray-600 p-2">{d}</td>
                                  <td className="border border-gray-200 dark:border-gray-600 p-2">{cau}</td>
                                  <td className="border border-gray-200 dark:border-gray-600 p-2 text-right">{displayAmount}</td>
                                </tr>;
                    }) : <tr>
                                <td colSpan={3} className="border border-gray-200 dark:border-gray-600 p-2 text-center opacity-70">
                                  Nessun movimento
                                </td>
                              </tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>}
              </div>}

            {/* TRANSAZIONI SECTION - EXACT COPY FROM ORIGINAL transactions.js */}
            {activeTab === 'transazioni' && <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Analisi Transazioni</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="includeCardCheckbox" defaultChecked className="rounded" />
                      <label htmlFor="includeCardCheckbox">Includi Transazioni Carte</label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">File Carte</label>
                        <input id="cardFileInput" type="file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90" />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">File Depositi</label>
                        <input id="depositFileInput" type="file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90" />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">File Prelievi</label>
                        <input id="withdrawFileInput" type="file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90" />
                      </div>
                    </div>

                    <Button id="analyzeTransactionsBtn" disabled={true} className="w-full">
                      Analizza Transazioni
                    </Button>
                    
                     <div className="space-y-6">

{/* React components rendering results */}
{transactionResults && (
  <>
    {transactionResults.depositData && (
      <MovementsTable title="Depositi" data={transactionResults.depositData} />
    )}
    {transactionResults.withdrawData && (
      <MovementsTable title="Prelievi" data={transactionResults.withdrawData} />
    )}
    {transactionResults.includeCard && transactionResults.cardData && (
                          <CardsTable rows={transactionResults.cardData as any[]} depositTotal={transactionResults.depositData?.totAll ?? 0} />
    )}
  </>
)}
                       <div id="depositResult" className="hidden"></div>
                       <div id="withdrawResult" className="hidden"></div>
                      <div id="transactionsResult" className="hidden"></div>
                      </div>
                      
                      {/* Re-render transaction results when navigating back to this tab */}
                      {activeTab === 'transazioni' && transactionResults && (
                        <div style={{ display: 'none' }} ref={(ref) => {
                          if (ref && transactionResults) {
                            setTimeout(() => {
                              const depositEl = document.getElementById('depositResult');
                              const withdrawEl = document.getElementById('withdrawResult');
                              const cardEl = document.getElementById('transactionsResult');
                              
                              // Re-run the original analysis with saved data
                              if (transactionResults.depositData && (window as any).renderMovements && depositEl) {
                                (window as any).renderMovements(depositEl, 'Depositi', transactionResults.depositData);
                                depositEl.classList.remove('hidden');
                              }
                              if (transactionResults.withdrawData && (window as any).renderMovements && withdrawEl) {
                                (window as any).renderMovements(withdrawEl, 'Prelievi', transactionResults.withdrawData);
                                withdrawEl.classList.remove('hidden');
                              }
                              if (transactionResults.includeCard && transactionResults.cardData && (window as any).renderCards && cardEl) {
                                (window as any).renderCards(cardEl, transactionResults.cardData);
                                cardEl.classList.remove('hidden');
                              }
                            }, 100);
                          }
                        }} />
                      )}
                      
                       {/* Results will be handled by the original transactions.js logic */}
                  </div>
                </Card>
              </div>}

            {/* MOVIMENTI IMPORTANTI SECTION - EXACT ORIGINAL FROM analysis.js */}
            {activeTab === 'importanti' && <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Movimenti Importanti</h3>
                  <div id="movimentiImportantiSection">
                    {/* Original code injects content here via DOM manipulation */}
                  </div>
                </Card>
              </div>}

            {/* ACCESSI SECTION - ORIGINAL LOGIC FROM accessi.js */}
            {activeTab === 'accessi' && <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Accessi – Analisi IP</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">File Log Accessi</label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => {
                  const file = e.target.files?.[0];
                  setAccessFile(file || null);
                  if (!file) {
                    setAccessResults([]);
                    // Clear localStorage when file is removed
                    localStorage.removeItem('aml_access_results');
                  }
                }} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90" />
                    </div>
                    
                    <Button onClick={async () => {
                if (!accessFile) return;
                setIsAnalyzingAccess(true);
                try {
                  const results = await analyzeAccessLog(accessFile);
                  setAccessResults(results);
                  // Save to localStorage for persistence
                  localStorage.setItem('aml_access_results', JSON.stringify(results));
                  console.log('💾 Access results saved to localStorage:', results.length);
                  toast.success(`Analizzati ${results.length} IP`);
                } catch (error) {
                  console.error('Error analyzing access log:', error);
                  toast.error('Errore durante l\'analisi degli accessi');
                  setAccessResults([]);
                } finally {
                  setIsAnalyzingAccess(false);
                }
              }} disabled={!accessFile || isAnalyzingAccess} className="w-full">
                      {isAnalyzingAccess ? <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analizzando IP...
                        </> : 'Analizza'}
                    </Button>
                    
                    {accessResults.length > 0 && <div className="mt-6">
                        <h4 className="text-md font-semibold mb-3">Risultati Analisi IP ({accessResults.length})</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-muted">
                                <th className="border border-border p-2 text-left">IP</th>
                                <th className="border border-border p-2 text-left">Paese / Stato</th>
                                <th className="border border-border p-2 text-left">ISP / Org</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accessResults.map((result, index) => <tr key={index} className="hover:bg-muted/50">
                                  <td className="border border-border p-2 font-mono text-xs">{result.ip}</td>
                                  <td className="border border-border p-2">{result.paese}</td>
                                  <td className="border border-border p-2">{result.isp}</td>
                                </tr>)}
                            </tbody>
                          </table>
                        </div>
                      </div>}
                  </div>
                </Card>
              </div>}
          </div>)}
      </div>
    </div>;
};
export default AmlDashboard;
