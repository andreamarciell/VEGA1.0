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
  

    return () => {
      // Cleanup on unmount
      const script = document.querySelector('script[data-transaction-logic]');
      if (script) {
        script.remove();
      }
    };
  }, []);
  

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
  

  // Initialize original transactions.js logic when tab is active
  
  // Helper to restore filtering functionality for persisted content
  ;

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
    let includeCard = document.getElementById('includeCardCheckbox') as HTMLInputElement;
    if (cardInput && !includeCard) {
      includeCard = document.createElement('input') as HTMLInputElement;
      includeCard.type = 'checkbox';
      includeCard.id = 'includeCardCheckbox';
      includeCard.checked = true;
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
      const cardsOk = !includeCard.checked || cardInput.files!.length;
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
    

    /* ---- build html tabella frazionate prelievi --------------------------- */
    

    /* ---------------------- Transazioni Carte ------------------------------ */
    async function parseCards(file: File) {
      return readExcel(file);
    }
    

    /* ------------ Render cartes table & dropdown --------------------------- */
    

    /* -------------------------- Main handler ------------------------------- */
    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.disabled = true;

      try {
        const depositData = await parseMovements(depositInput.files![0], 'deposit');
        const withdrawData = await parseMovements(withdrawInput.files![0], 'withdraw');
        let cardRows: any = null;
        if (includeCard.checked) {
          cardRows = await parseCards(cardInput.files![0]);
        }

        setTransactionResults({
          depositData,
          withdrawData,
          cardData: cardRows,
          includeCard: includeCard.checked
        });

        localStorage.setItem('aml_transaction_results', JSON.stringify({
          depositData,
          withdrawData,
          cardData: cardRows,
          includeCard: includeCard.checked
        }));
      } catch(err) {
        console.error(err);
        alert('Errore durante l\'analisi: ' + err.message);
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
    return readExcel(file);
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
)}</div>
                      
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
