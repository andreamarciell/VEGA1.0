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
  sessions: Array<{ timestamp: string }>;
}

const AmlDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessionTimestamps, setSessionTimestamps] = useState<Array<{ timestamp: string }>>([]);
  const [results, setResults] = useState<AmlResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('frazionate');
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const [transactionResults, setTransactionResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const causaliChartRef = useRef<HTMLCanvasElement>(null);
  const hourHeatmapRef = useRef<HTMLCanvasElement>(null);

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
  }, [navigate]);

  useEffect(() => {
    if (results) {
      createChartsAfterAnalysis();
    }
  }, [results, activeTab]);

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
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

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

        const headerRow = ((jsonData[headerIdx] as any[]) || []).map(h => (typeof h === 'string' ? h.trim() : h));

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
          const importo = parseFloat(String(row[8]).replace(/\s+/g,'').replace(/\./g,'').replace(/,/g,'.'));
          const dataObj = parseDate(dataStr);
          const tsVal = tsIndex !== -1 ? row[tsIndex] : '';
          const tx: Transaction = { data: dataObj, dataStr: dataStr, causale: causale, importo: importo, importo_raw: row[8] };
          if (tsIndex !== -1 && tsVal != null && tsVal !== '') {
            tx["TSN"] = tsVal;
            tx["TS extension"] = tsVal;
          }
          return tx;
        }).filter(tx => tx.data instanceof Date && !isNaN(tx.data.getTime()));

        // Salva timestamp per analisi sessioni orarie
        const sessionTsData = parsedTransactions.map(tx => ({ timestamp: tx.data.toISOString() }));

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
      const m = String(dt.getMonth()+1).padStart(2,'0');
      const da = String(dt.getDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    };
    
    // Consideriamo solo i depositi ("Ricarica conto gioco per accredito diretto")
    const depositi = transactions
      .filter(tx => tx.causale === "Ricarica conto gioco per accredito diretto")
      .sort((a, b) => a.data.getTime() - b.data.getTime());

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
          while (
            j < depositi.length &&
            startOfDay(depositi[j].data).getTime() === sogliaDay.getTime()
          ) {
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

    return { score, level, motivations };
  };

  // Original rilevaAlertAML function from giasai repository (exactly as it is)
  const rilevaAlertAML = (txs: Transaction[]): string[] => {
    const alerts: string[] = [];
    const norm = (s: string) => (s||'').toLowerCase();

    // classificazione base
    const classify = (c: string) => {
      const cl = norm(c);
      if (cl.includes('ricarica') || cl.includes('deposit')) return 'deposit';
      if (cl.includes('prelievo') || cl.includes('withdraw')) return 'withdraw';
      if (cl.includes('bonus')) return 'bonus';
      if (cl.includes('session')) return 'session';
      return 'other';
    };

    const moves = txs.map(tx => ({ ...tx, type: classify(tx.causale) }))
                    .sort((a,b) => a.data.getTime() - b.data.getTime());

    /* ---- 1. Velocity deposit: ≥3 depositi da >=€500 in ≤10 min ---- */
    const V_N = 3, V_MIN = 10, V_AMT = 500;
    let win: any[] = [];
    for(const m of moves){
      if(m.type !== 'deposit' || Math.abs(m.importo) < V_AMT) continue;
      win.push(m);
      while(win.length && (m.data.getTime() - win[0].data.getTime())/60000 > V_MIN){ win.shift(); }

      if(win.length >= V_N){
        alerts.push(`Velocity deposit: ${win.length} depositi >=€${V_AMT} in ${V_MIN} min (ultimo ${m.data.toLocaleString()})`);
        win = [];
      }
    }

    /* ---- 2. Bonus concentration: mostra ogni bonus individualmente se viene rilevata concentrazione ≥2 bonus in 24h ---- */
    const B_N = 2, B_H = 24;
    win = [];
    let flagged = new Set();
    for(const m of moves){
      if(m.type !== 'bonus') continue;
      win.push(m);
      while(win.length && (m.data.getTime() - win[0].data.getTime())/3600000 > B_H){ win.shift(); }

      if(win.length >= B_N){
        // registra ogni bonus nella finestra, se non già registrato
        win.forEach(b=>{
          if(flagged.has(b)) return;
          alerts.push(`Bonus concentration: bonus €${Math.abs(b.importo).toFixed(2)} (${b.data.toLocaleString()})`);
          flagged.add(b);
        });
      }
    }

    /* ---- 3. Casino live sessions ---- */
    const liveSessions = moves.filter(m => m.type==='session' && norm(m.causale).includes('live'));
    if(liveSessions.length){
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
                backgroundColor: [
                  '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', 
                  '#9966ff', '#ff9f40', '#c9cbcf', '#4bc0c0'
                ]
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
              labels: Array.from({length: 24}, (_, i) => `${i}:00`),
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

  // Transaction analysis functions (from transactions.js)
  const analyzeTransactions = async () => {
    if (!includeCard && !depositFile && !withdrawFile) {
      toast.error('Carica almeno un file per l\'analisi');
      return;
    }

    const results: any = {};
    
    try {
      // Process deposit file
      if (depositFile) {
        const depositData = await processTransactionFile(depositFile);
        results.deposits = depositData;
      }
      
      // Process withdraw file  
      if (withdrawFile) {
        const withdrawData = await processTransactionFile(withdrawFile);
        results.withdraws = withdrawData;
      }
      
      // Process card file if included
      if (includeCard && cardFile) {
        const cardData = await processTransactionFile(cardFile);
        results.cards = cardData;
      }
      
      setTransactionResults(results);
      toast.success('Analisi transazioni completata');
    } catch (error) {
      console.error('Error analyzing transactions:', error);
      toast.error('Errore durante l\'analisi delle transazioni');
    }
  };

  const processTransactionFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          // Basic processing - you can enhance this based on your needs
          const processedData = {
            totalAmount: 0,
            count: 0,
            data: jsonData.slice(1) // Remove header
          };
          
          resolve(processedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleReset = () => {
    setTransactions([]);
    setSessionTimestamps([]);
    setResults(null);
    setTransactionResults(null);
    setCardFile(null);
    setDepositFile(null);
    setWithdrawFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Toppery AML</h1>
            <p className="text-muted-foreground">Sistema di analisi anti-riciclaggio e rilevamento frodi</p>
          </div>
        </div>

        {!results ? (
          /* File Upload Section */
          <div className="space-y-6">
            <Card className="p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Carica File Excel</h2>
                <p className="text-muted-foreground mb-6">
                  Carica un file Excel (.xlsx) contenente i dati delle transazioni per iniziare l'analisi AML
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 mb-4"
                />
                
                {transactions.length > 0 && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      ✅ {transactions.length} transazioni caricate
                    </p>
                    <Button 
                      onClick={runAnalysis}
                      disabled={isAnalyzing}
                      className="mt-2"
                    >
                      {isAnalyzing ? 'Analizzando...' : 'Avvia Analisi'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          /* Tabbed Navigation and Results Section */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Risultati Analisi</h2>
              <Button onClick={handleReset} variant="outline">
                Nuova Analisi
              </Button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex gap-3 flex-wrap">
              {[
                { id: 'frazionate', label: 'Frazionate' },
                { id: 'sessioni', label: 'Sessioni notturne' },
                { id: 'grafici', label: 'Grafici' },
                { id: 'transazioni', label: 'Transazioni' },
                { id: 'importanti', label: 'Movimenti importanti' }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.id)}
                  size="sm"
                >
                  {tab.label}
                </Button>
              ))}
            </nav>

            {/* FRAZIONATE SECTION */}
            {activeTab === 'frazionate' && (
              <div className="space-y-6">
                {/* Risk Assessment */}
                <Card className="p-6 text-center">
                  <h3 className="text-lg font-semibold mb-4">Livello di Rischio</h3>
                  <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl ${
                    results.riskLevel === 'High' ? 'bg-red-500' :
                    results.riskLevel === 'Medium' ? 'bg-orange-500' : 'bg-green-500'
                  }`}>
                    {results.riskLevel}
                  </div>
                  <p className="mt-2 text-lg">Score: {results.riskScore}/100</p>
                </Card>

                {/* Frazionate */}
                {results.frazionate.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Frazionate Rilevate ({results.frazionate.length})</h3>
                    {results.frazionate.map((fraz, index) => (
                      <div key={index} className="mb-4 p-4 border rounded-lg bg-card">
                        <p><strong>Periodo:</strong> {fraz.start} → {fraz.end}</p>
                        <p><strong>Totale:</strong> €{fraz.total.toFixed(2)}</p>
                        <p><strong>Transazioni:</strong> {fraz.transactions.length}</p>
                      </div>
                    ))}
                  </Card>
                )}

                {/* Motivations */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Motivazioni del rischio</h3>
                  <ul className="space-y-2">
                    {results.motivations.map((motivation, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="h-2 w-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <span>{motivation}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Patterns */}
                {results.patterns.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Pattern rilevati</h3>
                    <ul className="space-y-2">
                      {results.patterns.map((pattern, index) => (
                        <li key={index} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200">
                          {pattern}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Alerts */}
                {results.alerts.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Alert AML/Fraud ({results.alerts.length})</h3>
                    <ul className="space-y-2">
                      {results.alerts.map((alert, index) => (
                        <li key={index} className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
                          {alert}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {/* SESSIONI NOTTURNE SECTION */}
            {activeTab === 'sessioni' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Sessioni Notturne</h3>
                  <p className="mb-4">
                    Sessioni notturne rilevate: {transactions.filter(tx => {
                      const hour = tx.data.getHours();
                      return hour >= 22 || hour <= 6;
                    }).length}
                  </p>
                  <canvas ref={hourHeatmapRef} className="w-full max-w-2xl mx-auto"></canvas>
                </Card>
              </div>
            )}

            {/* GRAFICI SECTION */}
            {activeTab === 'grafici' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Timeline movimenti (frazionate)</h3>
                  <canvas ref={chartRef} className="w-full max-w-2xl mx-auto"></canvas>
                </Card>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Distribuzione movimenti</h3>
                  <canvas ref={causaliChartRef} className="w-full max-w-2xl mx-auto"></canvas>
                </Card>
              </div>
            )}

            {/* TRANSAZIONI SECTION */}
            {activeTab === 'transazioni' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Analisi Transazioni</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="includeCardCheckbox"
                        checked={includeCard}
                        onChange={(e) => setIncludeCard(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="includeCardCheckbox">Includi Transazioni Carte</label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {includeCard && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Transazioni Carte</label>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setCardFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm"
                          />
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Depositi</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => setDepositFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Prelievi</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => setWithdrawFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={analyzeTransactions}
                      disabled={!includeCard && !depositFile && !withdrawFile}
                      className="mt-4"
                    >
                      Analizza Transazioni
                    </Button>

                    {transactionResults && (
                      <div className="mt-6 space-y-4">
                        {transactionResults.deposits && (
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold">Depositi</h4>
                            <p>Elaborati: {transactionResults.deposits.count || transactionResults.deposits.data?.length || 0} record</p>
                          </div>
                        )}
                        {transactionResults.withdraws && (
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold">Prelievi</h4>
                            <p>Elaborati: {transactionResults.withdraws.count || transactionResults.withdraws.data?.length || 0} record</p>
                          </div>
                        )}
                        {transactionResults.cards && (
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold">Carte</h4>
                            <p>Elaborati: {transactionResults.cards.count || transactionResults.cards.data?.length || 0} record</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* MOVIMENTI IMPORTANTI SECTION */}
            {activeTab === 'importanti' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Movimenti importanti</h3>
                  <div className="space-y-2">
                    {transactions
                      .filter(tx => Math.abs(tx.importo) > 1000)
                      .sort((a, b) => Math.abs(b.importo) - Math.abs(a.importo))
                      .slice(0, 20)
                      .map((tx, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-card">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{tx.dataStr}</span>
                            <span className={`font-semibold ${tx.importo > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              €{Math.abs(tx.importo).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm">{tx.causale}</p>
                        </div>
                      ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AmlDashboard;