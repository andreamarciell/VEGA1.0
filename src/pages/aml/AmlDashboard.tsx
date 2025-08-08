import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
// @ts-ignore
import { Chart, registerables, Chart as ChartJS } from 'chart.js';
import { useAmlStore } from '@/store/amlStore';
import { MovementsTable } from '@/components/aml/MovementsTable';
import { CardsTable } from '@/components/aml/CardsTable';
import TransactionsTab, { useTransactionsStore } from '@/components/aml/TransactionsTab';
import useAmlData from '@/components/aml/hooks/useAmlData';
import { exportJsonFile } from '@/components/aml/utils/exportJson';
import AnalisiAvanzata from '@/components/aml/pages/AnalisiAvanzata';
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
    raw?: any;
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

// NUOVO COMPONENTE PER TABELLA FRAZIONATE PRELIEVI
const FrazionatePrelieviTable = ({ title, data }: { title: string, data: Frazionata[] }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (index: number) => {
    setExpanded(expanded === index ? null : index);
  };

  const fmt = (v: any) => {
    if (v == null) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('it-IT');
  };

  const formatImporto = (raw: any, num: number) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return (typeof num === 'number' && isFinite(num)) ? num.toFixed(2) : '';
    }
    return String(raw).trim();
  };


  return (
    <details className="mt-6" open>
      <summary className="font-semibold text-lg cursor-pointer">{title} ({data.length})</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Periodo</th>
              <th className="border p-2 text-right">Totale €</th>
              <th className="border p-2 text-right"># Mov</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, i) => (
              <>
                <tr key={i} onClick={() => toggle(i)} className="cursor-pointer hover:bg-muted/50">
                  <td className="border p-2">{fmt(f.start)} - {fmt(f.end)}</td>
                  <td className="border p-2 text-right">{f.total.toFixed(2)}</td>
                  <td className="border p-2 text-right">{f.transactions.length}</td>
                </tr>
                {expanded === i && (
                  <tr key={`${i}-detail`}>
                    <td colSpan={3} className="p-0 border">
                      <div className="p-2 bg-background">
                        <table className="w-full">
                           <thead>
                            <tr className="bg-muted/50">
                              <th className="p-2 text-left">Data</th>
                              <th className="p-2 text-left">Causale</th>
                              <th className="p-2 text-right">Importo €</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.transactions.map((t, ti) => (
                              <tr key={ti}>
                                <td className="p-2">{fmt(t.date)}</td>
                                <td className="p-2">{t.causale}</td>
                                <td className="p-2 text-right">{formatImporto(t.raw, t.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};


const AmlDashboard = () => {

// Hook che aggrega tutti i dati da esportare
const amlData = useAmlData();

// Handler per esportare i dati in formato JSON
const handleExport = () => {
  const ts = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  exportJsonFile(amlData, `toppery-aml-${ts}.json`);
};
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
  const [showAi, setShowAi] = useState(false);
  const [activeTab, setActiveTab] = useState('frazionate');
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const isAnalyzeDisabled = !depositFile || !withdrawFile || (includeCard && !cardFile);

  // Check authentication and restore persisted results
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          navigate('/auth/login');
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactionResults = useAmlStore(state => state.transactionResults);
  const setTransactionResults = useAmlStore(state => state.setTransactionResults);
  const clearStore = useAmlStore(state => state.clear);
  const [accessFile, setAccessFile] = useState<File | null>(null);
  const [isAnalyzingAccess, setIsAnalyzingAccess] = useState(false);
  const accessResults = useAmlStore(state => state.accessResults);
  const setAccessResults = useAmlStore(state => state.setAccessResults);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // FIX: Removed chartRef as it's no longer used
  const causaliChartRef = useRef<HTMLCanvasElement>(null);
  const hourHeatmapRef = useRef<HTMLCanvasElement>(null);
  const hourChartInstanceRef = useRef<ChartJS | null>(null); 
  

  // Chart creation functions
  const createChartsAfterAnalysis = () => {
    if (!results || !transactions.length) return;

    setTimeout(() => {
      // FIX: Timeline chart creation logic has been removed.

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
        
// --- FIX auto-clear transaction results on mount ---
useEffect(() => {
  // Rimuovi qualunque risultato persistente in modo che al refresh la pagina sia pulita
  setTransactionResults(null);
  localStorage.removeItem('aml_transaction_results');
  localStorage.removeItem('aml_files_processed');
}, [setTransactionResults]);
}
      }
    }, 100);
  };
  
  // useEffect to handle the creation of the "Sessioni Notturne" chart
  useEffect(() => {
    if (activeTab === 'sessioni') {
        if (hourHeatmapRef.current && transactions.length > 0) {
            const ctx = hourHeatmapRef.current.getContext('2d');
            if (ctx) {
                // Destroy the previous chart instance if it exists to prevent memory leaks
                if (hourChartInstanceRef.current) {
                    hourChartInstanceRef.current.destroy();
                }

                const hourCounts = new Array(24).fill(0);
                transactions.forEach(tx => {
                    if (tx.data instanceof Date && !isNaN(tx.data.getTime())) {
                       hourCounts[tx.data.getHours()]++;
                    }
                });

                // Create the new chart and store its instance in the ref
                hourChartInstanceRef.current = new ChartJS(ctx, {
                    type: 'bar',
                    data: {
                        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                        datasets: [{
                            label: 'Numero di Transazioni',
                            data: hourCounts,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                   stepSize: 1 
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Distribuzione Oraria delle Transazioni'
                            }
                        }
                    }
                });
            }
        }
    }
  }, [activeTab, transactions]); 


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

        const sessionTsData = parsedTransactions.map(tx => ({
          timestamp: tx.data.toISOString()
        }));
        console.log("Transactions parsed:", parsedTransactions);
        if (parsedTransactions.length > 0) {
          setTransactions(parsedTransactions);
          try { localStorage.setItem('amlTransactions', JSON.stringify(parsedTransactions)); } catch {}
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
    const THRESHOLD = 4999;
    const frazionate: Frazionata[] = [];

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

    const depositi = transactions.filter(tx => tx.causale === "Ricarica conto gioco per accredito diretto").sort((a, b) => a.data.getTime() - b.data.getTime());
    let i = 0;
    while (i < depositi.length) {
      const windowStart = startOfDay(depositi[i].data);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 6);

      let running = 0;
      const collected: Transaction[] = [];
      let j = i;
      while (j < depositi.length && depositi[j].data <= windowEnd) {
        running += Math.abs(depositi[j].importo);
        collected.push(depositi[j]);
        if (running > THRESHOLD) {
          const sogliaDay = startOfDay(depositi[j].data);
          j++;
          while (j < depositi.length && startOfDay(depositi[j].data).getTime() === sogliaDay.getTime()) {
            running += Math.abs(depositi[j].importo);
            collected.push(depositi[j]);
            j++;
          }

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
          i = j;
          break;
        }
        j++;
      }
      if (running <= THRESHOLD) {
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
        win.forEach(b => {
          if (flagged.has(b)) return;
          alerts.push(`Bonus concentration: bonus €${Math.abs(b.importo).toFixed(2)} (${b.data.toLocaleString()})`);
          flagged.add(b);
        });
      }
    }

    const liveSessions = moves.filter(m => m.type === 'session' && norm(m.causale).includes('live'));
    if (liveSessions.length) {
      alerts.push(`Casino live: ${liveSessions.length} sessioni live rilevate`);
    }
    return alerts;
  };

  // Original runAnalysis function from giasai repository with the fix applied
  const runAnalysis = () => {
    if (transactions.length === 0) {
      toast.error('Carica prima un file Excel');
      return;
    }
    setIsAnalyzing(true);
    try {
      // Persist transactions to localStorage so other tabs can access them reliably.
      localStorage.setItem('amlTransactions', JSON.stringify(transactions));

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

  // NUOVA FUNZIONE - PORTING DA TRANSACTIONS.JS
  const calcWithdrawFrazionate = (rows: any[], cDate: number, cDesc: number, cAmt: number, excelToDate: any, parseNum: any): Frazionata[] => {
    const fmtDateLocal = (d: Date) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
  
    const THRESHOLD = 5000;
    const isVoucherPVR = (desc: string) => {
      if (!desc) return false;
      const d = String(desc).toLowerCase();
      return d.includes('voucher') && d.includes('pvr');
    };
  
    const txs: { data: Date; importo: number; importo_raw: any; causale: string }[] = [];
    rows.forEach(r => {
      if (!Array.isArray(r)) return;
      const desc = String(r[cDesc] ?? '').trim();
      if (!isVoucherPVR(desc)) return;
      const amt = parseNum(r[cAmt]);
      if (!amt) return;
      const dt = excelToDate(r[cDate]);
      if (!dt || isNaN(dt.getTime())) return;
      txs.push({ data: dt, importo: Math.abs(amt), importo_raw: r[cAmt], causale: desc });
    });
  
    txs.sort((a, b) => a.data.getTime() - b.data.getTime());
    const startOfDay = (d: Date) => { const t = new Date(d); t.setHours(0, 0, 0, 0); return t; };
    const res: Frazionata[] = [];
    let i = 0;
    while (i < txs.length) {
      const windowStart = startOfDay(txs[i].data);
      let j = i, run = 0;
      while (j < txs.length) {
        const t = txs[j];
        const diffDays = (startOfDay(t.data).getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 6) break;
        run += t.importo;
        if (run >= THRESHOLD) {
          res.push({
            start: fmtDateLocal(windowStart),
            end: fmtDateLocal(startOfDay(t.data)),
            total: run,
            transactions: txs.slice(i, j + 1).map(t_item => ({
              date: t_item.data.toISOString(),
              amount: t_item.importo,
              raw: t_item.importo_raw,
              causale: t_item.causale
            }))
          });
          i = j + 1;
          break;
        }
        j++;
      }
      if (run < THRESHOLD) i++;
    }
    return res;
  }
  
  // LOGICA DI ANALISI PRINCIPALE
  const analyzeTransactions = async () => {
    if (!depositFile || !withdrawFile) {
      toast.error("Carica sia il file dei depositi che dei prelievi.");
      return;
    }
  
    // Helpers
    const parseNum = (v: any) => {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (v == null) return 0;
        let s = String(v).trim().replace(/\s+/g, '');
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if (lastComma > -1 && lastDot > -1) {
          s = lastComma > lastDot ? s.replace(/\./g, '').replace(/,/g, '.') : s.replace(/,/g, '');
        } else if (lastComma > -1) {
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          s = s.replace(/[^0-9.-]/g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    };
    const excelToDate = (d: any): Date => {
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
          let [, day, mon, yr, hh = '0', mm = '0', ss = '0'] = m;
          const year = +yr < 100 ? +yr + 2000 : +yr;
          return new Date(year, +mon - 1, +day, +hh, +mm, +ss);
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
    const readExcel = (file: File): Promise<any[][]> => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          res(rows as any[][]);
        } catch (err) { rej(err); }
      };
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });
  
    try {
      const results: any = {};
      let depositData: any = null;
  
      if (depositFile) {
        depositData = await parseMovements(depositFile, 'deposit', parseNum, excelToDate, readExcel);
        results.depositData = depositData;
      }
  
      if (withdrawFile) {
        const withdrawData = await parseMovements(withdrawFile, 'withdraw', parseNum, excelToDate, readExcel);
        results.withdrawData = withdrawData;
      }
  
      if (includeCard && cardFile) {
        const cardData = await parseCards(cardFile, readExcel, parseNum, excelToDate, depositData?.totAll ?? 0);
        results.cardData = cardData;
      }
  
      results.includeCard = includeCard;

  
      setTransactionResults(results);
      toast.success('Analisi transazioni completata');
    } catch (error) {
      console.error('Error analyzing transactions:', error);
      toast.error('Errore durante l\'analisi delle transazioni');
    }
  };
  
  const parseMovements = async (file: File, mode: 'deposit' | 'withdraw', parseNum: any, excelToDate: any, readExcel: any) => {
    const RE = mode === 'deposit' ? /^(deposito|ricarica)/i : /^prelievo/i;
    const rows: any[][] = await readExcel(file);
    const sanitize = (s:string) => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
    const findHeaderRow = (rows: any[][], h: string) => rows.findIndex(r => Array.isArray(r) && r.some(c => typeof c === 'string' && sanitize(c).includes(sanitize(h))));
    const findCol = (hdr: any[], als: string[]) => {
      const s = hdr.map(h => sanitize(String(h)));
      for (const a of als) {
        const i = s.findIndex(v => v.includes(sanitize(a)));
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
    const monthsSet = new Set<string>();
    Object.values(perMonth).forEach((obj: any) => {
      Object.keys(obj).forEach(k => monthsSet.add(k));
    });
    const months = Array.from(monthsSet).sort().reverse();
    
    const frazionate = mode === 'withdraw' ? calcWithdrawFrazionate(data, cDate, cDesc, cAmt, excelToDate, parseNum) : [];
  
    return { totAll, months, all, perMonth, frazionate };
  };

  // FUNZIONE COMPLETAMENTE SOSTITUITA - PORTING DA TRANSACTIONS.JS
  const parseCards = async (file: File, readExcel: any, parseNum: any, excelToDate: any, depTot: number) => {
    const rows: any[][] = await readExcel(file);
    const sanitize = (s:string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const findHeaderRow = (rows: any[][], h: string) => rows.findIndex(r => Array.isArray(r) && r.some(c => typeof c === 'string' && sanitize(c).includes(sanitize(h))));
    const findCol = (hdr: any[], als: string[]) => {
      const s = hdr.map(h => sanitize(String(h)));
      for (const a of als) {
        const i = s.findIndex(v => v.includes(sanitize(a)));
        if (i !== -1) return i;
      }
      return -1;
    };

    const hIdx = findHeaderRow(rows, 'amount');
    if (hIdx === -1) {
        toast.error("Intestazioni non trovate nel file delle carte.");
        return { cards: [], summary: { app: 0, dec: 0 }, months: [] };
    }
    const hdr = rows[hIdx];
    const data = rows.slice(hIdx + 1).filter(r => Array.isArray(r) && r.some(c => c));

    const ix = {
        date: findCol(hdr, ['date', 'data']),
        pan: findCol(hdr, ['pan']),
        bin: findCol(hdr, ['bin']),
        name: findCol(hdr, ['holder', 'nameoncard']),
        type: findCol(hdr, ['cardtype']),
        prod: findCol(hdr, ['product']),
        ctry: findCol(hdr, ['country']),
        bank: findCol(hdr, ['bank']),
        amt: findCol(hdr, ['amount']),
        res: findCol(hdr, ['result']),
        ttype: findCol(hdr, ['transactiontype', 'transtype']),
        reason: findCol(hdr, ['reason'])
    };

    if (ix.pan === -1 || ix.amt === -1 || ix.ttype === -1) {
        toast.error("Colonne fondamentali (PAN, Amount, Type) mancanti nel file carte.");
        return { cards: [], summary: { app: 0, dec: 0 }, months: [] };
    }

    const cards_map = new Map<string, any>();
    const summary = { app: 0, dec: 0 };
    const monthsSet = new Set<string>();
    const monthKey = (dt: Date) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');

    data.forEach(r => {
        const txType = String(r[ix.ttype] || '').toLowerCase();
        if (!txType.includes('sale')) return;

        let dt = null;
        if (ix.date !== -1) {
            dt = excelToDate(r[ix.date]);
            if (dt && !isNaN(dt.getTime())) {
                monthsSet.add(monthKey(dt));
            }
        }

        const pan = r[ix.pan] || 'UNKNOWN';
        if (!cards_map.has(pan)) {
            cards_map.set(pan, {
                pan,
                bin: ix.bin !== -1 ? (r[ix.bin] || String(pan).slice(0, 6)) : String(pan).slice(0, 6),
                name: ix.name !== -1 ? (r[ix.name] || '') : '',
                type: ix.type !== -1 ? (r[ix.type] || '') : '',
                prod: ix.prod !== -1 ? (r[ix.prod] || '') : '',
                ctry: ix.ctry !== -1 ? (r[ix.ctry] || '') : '',
                bank: ix.bank !== -1 ? (r[ix.bank] || '') : '',
                app: 0, dec: 0, nDec: 0, reasons: new Set<string>(),
                transactions: []
            });
        }

        const card_entry = cards_map.get(pan);
        const amt = parseNum(r[ix.amt]);
        const resVal = ix.res !== -1 ? String(r[ix.res] || '') : 'approved';
        
        card_entry.transactions.push({ date: dt, amount: amt, result: resVal });

        if (/^approved$/i.test(resVal)) {
            card_entry.app += amt;
            summary.app += amt;
        } else {
            card_entry.dec += amt;
            summary.dec += amt;
            card_entry.nDec += 1;
            if (ix.reason !== -1 && r[ix.reason]) {
                card_entry.reasons.add(r[ix.reason]);
            }
        }
    });

    const card_array = Array.from(cards_map.values()).map(c => ({
        ...c,
        perc: depTot ? ((c.app / depTot) * 100) : 0,
        reasons: Array.from(c.reasons).join(', ')
    }));
    
    const months = Array.from(monthsSet).sort().reverse();
    return { cards: card_array, summary, months };
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
  }, [activeTab, transactions]);

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
    setAccessResults([]);
    setAccessFile(null);
    
    // =================== FIX START ===================
    // Reset the active tab to the default 'frazionate' view.
    // This ensures that after a new analysis, the user always starts from the main tab.
    setActiveTab('frazionate');
    // =================== FIX END =====================

    // Pulisci localStorage da precedenti analisi
    localStorage.removeItem('aml_transaction_results');
    localStorage.removeItem('aml_files_processed');
    localStorage.removeItem('amlTransactions');

    // Reset completo dello store Transazioni
    useTransactionsStore.getState().reset();

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
                    <Button variant="outline" onClick={() => setShowAi(v => !v)} className="mt-2 ml-2">
                      {showAi ? 'Chiudi Analisi Avanzata' : 'Apri Analisi Avanzata'}
                    </Button>
                  </div>}
              </div>
            </Card>
          </div>) : (
      <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Risultati Analisi</h2>
              <Button onClick={handleReset} variant="outline">
                Nuova Analisi
              </Button>
            </div>
          {/* AI under upload */}
          {showAi && transactions.length > 0 && (
            <div className="mt-4">
              <AnalisiAvanzata />
            </div>
          )}

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
            
<Button variant="outline" onClick={handleExport} size="sm">
  Esporta file
</Button></nav>


            {/* ANALISI AVANZATA (AI) */}
            {activeTab === 'analisi' && <AnalisiAvanzata />}
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
                  <h3 className="text-lg font-semibold mb-4">Analisi Sessioni Notturne</h3>
                  <p className="mb-4">
                    Percentuale di transazioni avvenute tra le 22:00 e le 06:00: <strong>{calculateNightSessionsPercentage()}</strong>
                  </p>
                  <div className="relative h-96">
                    <canvas ref={hourHeatmapRef}></canvas>
                  </div>
                </Card>
              </div>}

            {/* GRAFICI SECTION */}
            {activeTab === 'grafici' && <div className="space-y-6">
                {/* AML/Fraud Anomalies Chart */}
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

                {/* FIX: Timeline chart has been removed from here */}
                
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
            {/* TRANSAZIONI SECTION */}
            {activeTab === 'transazioni' && <TransactionsTab />}
            {activeTab === 'importanti' && <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Movimenti Importanti</h3>
                  <div id="movimentiImportantiSection">
                    {/* Original code injects content here via DOM manipulation */}
                  </div>
                </Card>
              </div>}
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