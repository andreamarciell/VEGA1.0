
import React, { useState, useCallback, useMemo, Fragment, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { create } from 'zustand';
import TransactionsCharts from '@/components/aml/charts/TransactionsCharts';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, Wallet } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

/* ----------------------------------------------------------------------
 *  TransactionsTab – completamente riscritto in React/TypeScript
 *  Permette di caricare file Excel di Depositi, Prelievi e (opz.) Carte,
 *  di analizzarli e visualizzare i risultati con filtri mensili.
 * ------------------------------------------------------------------- */

/** Utilities condivise **/
const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

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
  return Number.isFinite(n) ? n : 0;
};

const excelToDate = (d: any): Date => {
  if (d instanceof Date) return d;
  if (typeof d === 'number') {
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + d);
    return base;
  }
  if (typeof d === 'string') {
    const s = d.trim();
    const m = s.match(/^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{2,4})(?:\D+([0-2]?\d):([0-5]?\d)(?::([0-5]?\d))?)?/);
    if (m) {
      const [_, dd, mm, yy, hh = '0', min = '0', ss = '0'] = m;
      const year = +yy < 100 ? +yy + 2000 : +yy;
      return new Date(year, +mm - 1, +dd, +hh, +min, +ss);
    }
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
    const tryD = new Date(s);
    if (!isNaN(tryD.getTime())) return tryD;
  }
  return new Date('');
};

const readExcel = (file: File): Promise<any[][]> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        resolve(rows as any[][]);
      } catch (err) {
        reject(err);
      }
    };
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });

/* ----------------------------------------------------------------------
 *  Tipi & interfacce
 * ------------------------------------------------------------------- */
interface MonthMap<T = number> {
  [yyyyMM: string]: T;
}

interface MovementSummary {
  totAll: number;
  months: string[]; // "YYYY-MM"
  methods: Record<string, number>;
  perMonth: Record<string, MonthMap>;
  transactionsByMethod: Record<string, any[]>;
  fractions?: FractionWindow[];
}

interface FractionWindow {
  start: string; // YYYY-MM-DD
  end: string;
  total: number;
  transactions: {
    date: string;
    amount: number;
    raw?: any;
    causale: string;
  }[];
}

interface CardsSummary {
  cards: CardRow[];
  summary: { app: number; dec: number };
  months: string[];
}

interface CardRow {
  pan: string;
  bin: string;
  name: string;
  type: string;
  prod: string;
  ctry: string;
  bank: string;
  app: number;
  dec: number;
  nDec: number;
  /** Importi approved per mese */
  appPerMonth?: MonthMap;
  /** Importi declined per mese */
  decPerMonth?: MonthMap;
  /** Numero declined per mese */
  nDecPerMonth?: MonthMap<number>;
  perc: number; // % sul totale depositi
  reasons: string;
  months?: string[];
  transactions: any[];
}

interface AnalysisResult {
  deposit: MovementSummary | null;
  withdraw: MovementSummary | null;
  cards: CardsSummary | null;
}

interface AverageDetail {
  month: string;
  total: number;
}

interface AverageResult {
  id: string;
  category: 'depositi' | 'prelievi' | 'carte';
  rangeMonths: number;
  includeCurrentMonth: boolean;
  selectedMethods: string[];
  averageValue: number;
  details: AverageDetail[];
}

interface NetDepositResult {
  id: string;
  type: 'mensile' | 'annuale' | 'totale';
  period: string;
  totalDeposits: number;
  totalWithdrawals: number;
  netValue: number;
  details: {
    deposits: { method: string; amount: number }[];
    withdrawals: { method: string; amount: number }[];
  };
}


/* ----------------------------------------------------------------------
 *  Zustand store per la persistenza in memoria dei risultati
 * ------------------------------------------------------------------- */
type StoreState = {
  result: AnalysisResult | null;
  setResult: (r: AnalysisResult | null) => void;
  reset: () => void;
};

export const useTransactionsStore = create<StoreState>(set => ({
  result: null,
  setResult: (result) => set({ result }),
  reset: () => set({ result: null }),
}));


/* ----------------------------------------------------------------------
 *  Movimento Parsing (depositi / prelievi)
 * ------------------------------------------------------------------- */
const parseMovements = async (
  file: File,
  mode: 'deposit' | 'withdraw',
): Promise<MovementSummary> => {
  const RE = mode === 'deposit' ? /^(deposito|ricarica)/i : /^prelievo/i;
  const rows = await readExcel(file);

  const findHeaderRow = (h: string) => rows.findIndex(r => Array.isArray(r) && r.some(c => typeof c === 'string' && sanitize(String(c)).includes(sanitize(h))));
  const findCol = (hdr: any[], als: string[]) => {
    const ss = hdr.map(h => sanitize(String(h)));
    for (const a of als) {
      const idx = ss.findIndex(v => v.includes(sanitize(a)));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const hIdx = findHeaderRow('importo');
  const hdr = hIdx !== -1 ? rows[hIdx] : [];
  const data = hIdx !== -1 ? rows.slice(hIdx + 1) : rows;

  const cDate = hIdx !== -1 ? findCol(hdr, ['data', 'date']) : 0;
  const cDesc = hIdx !== -1 ? findCol(hdr, ['descr', 'description']) : 1;
  const cAmt = hIdx !== -1 ? findCol(hdr, ['importo', 'amount']) : 2;

  const perMethod: Record<string, number> = {};
  const perMonth: Record<string, MonthMap> = {};
  const transactionsByMethod: Record<string, any[]> = {};
  let totAll = 0;
  const monthsSet = new Set<string>();

  // Helper
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const transactions: { data: Date; desc: string; amt: number; rawAmt: any }[] = [];

  for (const r of data) {
    if (!Array.isArray(r)) continue;
    const desc = String(r[cDesc] ?? '').trim();
    if (!RE.test(desc)) continue;

    const method = mode === 'deposit' && desc.toLowerCase().startsWith('ricarica')
      ? 'Cash'
      : desc.replace(RE, '').trim() || 'Sconosciuto';

    const rawAmt = r[cAmt];
    const isEmpty = rawAmt === null || rawAmt === undefined || (typeof rawAmt === 'string' && rawAmt.trim() === '');
    if (isEmpty) continue;

    const amt = parseNum(rawAmt);
    if (!Number.isFinite(amt)) continue;

    perMethod[method] = (perMethod[method] || 0) + amt;
    totAll += amt;

    const dt = excelToDate(r[cDate]);
    if (!dt || isNaN(dt.getTime())) continue;

    const mk = monthKey(dt);
    monthsSet.add(mk);

    perMonth[method] ??= {};
    perMonth[method][mk] = (perMonth[method][mk] || 0) + amt;

    transactionsByMethod[method] ??= [];
    transactionsByMethod[method].push({
      date: dt.toISOString(),
      description: desc,
      amount: amt,
      raw: rawAmt,
      month: mk
    });

    transactions.push({ data: dt, desc, amt, rawAmt: r[cAmt] });
  }

  const months = Array.from(monthsSet).sort().reverse();

  const fractions = detectFractions(transactions, mode);

  return { totAll, months, methods: perMethod, perMonth, transactionsByMethod, fractions };
};

/* ----------------------------------------------------------------------
 *  Fractions detection (rolling 7gg, >=5000.00€, con filtri specifici per tipo)
 * ------------------------------------------------------------------- */
const detectFractions = (txs: { data: Date; desc: string; amt: number; rawAmt: any }[], mode: 'deposit' | 'withdraw'): FractionWindow[] => {
  const THRESHOLD = 5000.00;
  
  // Filtri specifici per tipo:
  // DEPOSITI: solo transazioni con descrizione contenente "ricarica conto gioco per accredito diretto" (case-insensitive)
  // PRELIEVI: solo transazioni con descrizione contenente "voucher" o "pvr" (case-insensitive)
  const shouldInclude = (desc: string): boolean => {
    const lower = desc.toLowerCase();
    if (mode === 'deposit') {
      return lower.includes('ricarica conto gioco per accredito diretto');
    } else {
      // mode === 'withdraw'
      return lower.includes('voucher') || lower.includes('pvr');
    }
  };
  
  const filtered = txs.filter(t => shouldInclude(t.desc));
  
  // Ordina le transazioni filtrate per data
  const sorted = [...filtered].sort((a, b) => a.data.getTime() - b.data.getTime());

  const fmt = (d: Date) => {
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  };

  const res: FractionWindow[] = [];
  const startDay = (d: Date) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return t;
  };

  // Ciclo Principale: Itera con indice i. Per ogni transazione di partenza:
  let i = 0;
  while (i < sorted.length) {
    // Inizializza windowStart alla data di filtered[i]
    const firstTx = sorted[i];
    const windowStart = startDay(firstTx.data);
    
    // Inizializza runningSum = 0 e cluster = []
    let runningSum = 0;
    const cluster: typeof sorted = [];
    let triggerDate: Date | null = null;

    // Ciclo Interno j: Accumula transazioni finché filtered[j] è entro 7 giorni solari da windowStart
    const windowEndLimit = new Date(windowStart);
    windowEndLimit.setDate(windowEndLimit.getDate() + 7);
    
    let j = i;
    while (j < sorted.length) {
      const t = sorted[j];
      const tDay = startDay(t.data);
      
      // Se siamo oltre la finestra di 7 giorni solari, fermati
      if (tDay.getTime() >= windowEndLimit.getTime()) break;
      
      runningSum += t.amt;
      cluster.push(t);
      
      // Trigger Soglia: Se runningSum raggiunge o supera 4.999,99€
      if (runningSum >= THRESHOLD && !triggerDate) {
        // Identifica la data solare corrente (triggerDate) di filtered[j]
        triggerDate = tDay;
        
        // Svuotamento Giorno: Continua ad aggiungere al cluster tutte le transazioni successive
        // che hanno la stessa data solare di triggerDate, anche se la somma aumenta ulteriormente.
        // Fermati non appena trovi una transazione di un giorno diverso.
        j++;
        while (j < sorted.length) {
          const nextT = sorted[j];
          const nextTDay = startDay(nextT.data);
          
          // Se la transazione è di un giorno diverso, fermati
          if (nextTDay.getTime() > triggerDate.getTime()) break;
          
          // Se è dello stesso giorno, aggiungila al cluster
          runningSum += nextT.amt;
          cluster.push(nextT);
          j++;
        }
        
        // Registrazione: Salva la SOS con l'importo totale reale accumulato e il periodo (da windowStart a triggerDate)
        res.push({
          start: fmt(windowStart),
          end: fmt(triggerDate),
          total: runningSum,
          transactions: cluster.map(x => ({
            date: x.data.toISOString(),
            amount: x.amt,
            raw: x.rawAmt,
            causale: x.desc,
          })),
        });

        // Salto Temporale: Imposta il nuovo indice di partenza i alla prima transazione
        // che avviene in un giorno di calendario strettamente successivo a triggerDate
        const nextDay = new Date(triggerDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        let nextI = j;
        while (nextI < sorted.length && startDay(sorted[nextI].data).getTime() < nextDay.getTime()) {
          nextI++;
        }
        i = nextI;
        
        // Esci dal ciclo interno (break)
        break;
      }
      
      j++;
    }

    // Avanzamento standard: Se la finestra di 7 giorni si chiude senza superare la soglia, incrementa i di uno (i++)
    if (!triggerDate) {
      i++;
    }
  }
  
  return res;
};

/* ----------------------------------------------------------------------
 *  Carte – parsing essenziale, aggregazione per PAN
 * ------------------------------------------------------------------- */
const parseCards = async (file: File, depTot: number): Promise<CardsSummary> => {
  const rows = await readExcel(file);
  const findHeaderRow = (h: string) => rows.findIndex(r => Array.isArray(r) && r.some(c => typeof c === 'string' && sanitize(String(c)).includes(sanitize(h))));
  const findCol = (hdr: any[], als: string[]) => {
    const ss = hdr.map(h => sanitize(String(h)));
    for (const a of als) {
      const idx = ss.findIndex(v => v.includes(sanitize(a)));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const hIdx = findHeaderRow('amount');
  if (hIdx === -1) {
    toast.error('Intestazioni carte non trovate');
    return { cards: [], summary: { app: 0, dec: 0 }, months: [] };
  }

  const hdr = rows[hIdx];
  const data = rows.slice(hIdx + 1).filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));

  const ix = {
    date: findCol(hdr, ['date', 'data']),
    pan: findCol(hdr, ['pan']),
    bin: findCol(hdr, ['bin']),
    name: findCol(hdr, ['holder', 'nameoncard']),
    type: findCol(hdr, ['cardtype']),
    prod: findCol(hdr, ['product']),
    ctry: findCol(hdr, ['country']),
    bank: findCol(hdr, ['issuerbank']),
    amt: findCol(hdr, ['amount']),
    res: findCol(hdr, ['result']),
    ttype: findCol(hdr, ['transactiontype', 'transtype']),
    reason: findCol(hdr, ['reason']),
  };

  if (ix.pan === -1 || ix.amt === -1 || ix.ttype === -1) {
    toast.error('Colonne fondamentali (PAN, Amount, Type) mancanti nel file carte');
    return { cards: [], summary: { app: 0, dec: 0 }, months: [] };
  }

  const cardsMap = new Map<string, CardRow>();
  const summary = { app: 0, dec: 0 };
  const monthsSet = new Set<string>();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  for (const r of data) {
    const tType = String(r[ix.ttype] || '').toLowerCase();
    if (!tType.includes('sale')) continue; // analizziamo solo transazioni sale

    let dt: Date | null = null;
    let mk: string | null = null;
    if (ix.date !== -1) {
      dt = excelToDate(r[ix.date]);
      if (dt && !isNaN(dt.getTime())) {
        mk = monthKey(dt);
        monthsSet.add(mk);
      }
    }

    const pan = r[ix.pan] || 'UNKNOWN';
    if (!cardsMap.has(pan)) {
      cardsMap.set(pan, {
        pan,
        bin: ix.bin !== -1 ? (r[ix.bin] || String(pan).slice(0, 6)) : String(pan).slice(0, 6),
        name: ix.name !== -1 ? r[ix.name] || '' : '',
        type: ix.type !== -1 ? r[ix.type] || '' : '',
        prod: ix.prod !== -1 ? r[ix.prod] || '' : '',
        ctry: ix.ctry !== -1 ? r[ix.ctry] || '' : '',
        bank: ix.bank !== -1 ? r[ix.bank] || '' : '',
        app: 0,
        dec: 0,
        nDec: 0,
        appPerMonth: {},
        decPerMonth: {},
        nDecPerMonth: {},
        perc: 0,
        months: [],
        reasons: '',
        transactions: [],
      });
    }
    const entry = cardsMap.get(pan)!;

    // Aggiorna elenco mesi per cui la carta ha transazioni
    if (mk) {
      if (!entry.months) entry.months = [mk];
      else if (!entry.months.includes(mk)) entry.months.push(mk);
    }

    const amt = parseNum(r[ix.amt]);
    const resultVal = ix.res !== -1 ? String(r[ix.res] || '') : 'approved';
    const reason = ix.reason !== -1 && r[ix.reason] ? String(r[ix.reason]) : '';

    entry.transactions.push({
      date: dt ? dt.toISOString() : null,
      result: resultVal,
      reason,
      amount: amt,
      month: mk
    });

    if (/^approved$/i.test(resultVal)) {
      entry.app += amt;
      summary.app += amt;
      if (mk) {
        entry.appPerMonth![mk] = (entry.appPerMonth![mk] || 0) + amt;
      }
    } else {
      entry.dec += amt;
      entry.nDec += 1;
      summary.dec += amt;
      if (mk) {
        entry.decPerMonth![mk] = (entry.decPerMonth![mk] || 0) + amt;
        entry.nDecPerMonth![mk] = (entry.nDecPerMonth![mk] || 0) + 1;
      }
      if (ix.reason !== -1 && r[ix.reason]) {
        entry.reasons = entry.reasons ? `${entry.reasons}, ${r[ix.reason]}` : String(r[ix.reason]);
      }
    }
  }

  const cards = Array.from(cardsMap.values()).map(c => ({
    ...c,
    perc: depTot ? (c.app / depTot) * 100 : 0,
  }));

  return { cards, summary, months: Array.from(monthsSet).sort().reverse() };
};

/* ----------------------------------------------------------------------
 *  Media Mensile - Componenti e Logica
 * ------------------------------------------------------------------- */
interface CalculateAverageDialogProps {
  category: 'depositi' | 'prelievi' | 'carte';
  methods: string[];
  availableMonths: string[];
  onCalculate: (result: AverageResult) => void;
  trigger: React.ReactNode;
}

const CalculateAverageDialog: React.FC<CalculateAverageDialogProps> = ({
  category,
  methods,
  availableMonths,
  onCalculate,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(3);
  const [includeCurrent, setIncludeCurrent] = useState(true);
  const [selectedMethods, setSelectedMethods] = useState<string[]>(methods);

  const handleToggleMethod = (m: string) => {
    setSelectedMethods(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const calculate = () => {
    if (range <= 0) {
      toast.error('Inserire un numero di mesi valido');
      return;
    }
    if (selectedMethods.length === 0) {
      toast.error('Selezionare almeno un metodo');
      return;
    }

    // Determiniamo i mesi da includere
    const sortedMonths = [...availableMonths].sort().reverse();
    if (sortedMonths.length === 0) {
      toast.error('Dati non disponibili per il calcolo');
      return;
    }

    const startIdx = includeCurrent ? 0 : 1;
    const targetMonths = sortedMonths.slice(startIdx, startIdx + range);

    if (targetMonths.length === 0) {
      toast.error('Nessun mese disponibile per il range selezionato');
      return;
    }

    onCalculate({
      id: crypto.randomUUID(),
      category,
      rangeMonths: range,
      includeCurrentMonth: includeCurrent,
      selectedMethods,
      averageValue: 0,
      details: []
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Calcola Media Mensile - {category.toUpperCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="range">Range di mesi (ultimi X)</Label>
            <Input
              id="range"
              type="number"
              min={1}
              value={range}
              onChange={e => setRange(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeCurrent"
              checked={includeCurrent}
              onCheckedChange={(v) => setIncludeCurrent(!!v)}
            />
            <Label htmlFor="includeCurrent">Includi mese corrente</Label>
          </div>
          <div className="space-y-2">
            <Label>Metodi da includere</Label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2 bg-muted/20">
              {methods.map(m => (
                <div key={m} className="flex items-center space-x-2">
                  <Checkbox
                    id={`method-${m}`}
                    checked={selectedMethods.includes(m)}
                    onCheckedChange={() => handleToggleMethod(m)}
                  />
                  <Label htmlFor={`method-${m}`} className="text-xs font-normal truncate">
                    {m}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
          <Button onClick={calculate}>Calcola</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AveragesTable: React.FC<{
  results: AverageResult[];
  category: 'depositi' | 'prelievi' | 'carte';
  onDelete: (id: string) => void;
}> = ({ results, category, onDelete }) => {
  const filtered = results.filter(r => r.category === category);
  const [expand, setExpand] = useState<string | null>(null);

  if (filtered.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h5 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Calculator className="w-4 h-4" /> Medie Mensili Calcolate
      </h5>
      {filtered.map(r => (
        <div key={r.id} className="border rounded bg-muted/10 overflow-hidden">
          <div
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/20"
            onClick={() => setExpand(expand === r.id ? null : r.id)}
          >
            <div className="text-sm">
              <span className="font-medium">€ {r.averageValue.toFixed(2)}</span>
              <span className="text-muted-foreground ml-2">
                (su {r.rangeMonths} mesi e {r.selectedMethods.length} metodi)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
              >
                ×
              </Button>
            </div>
          </div>
          {expand === r.id && (
            <div className="p-3 bg-background border-t">
              <div className="text-xs space-y-1 mb-2">
                <p><strong>Metodi:</strong> {r.selectedMethods.join(', ')}</p>
                <p><strong>Include corrente:</strong> {r.includeCurrentMonth ? 'Sì' : 'No'}</p>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-1 border text-left">Mese</th>
                    <th className="p-1 border text-right">Totale €</th>
                  </tr>
                </thead>
                <tbody>
                  {r.details.map((d, di) => (
                    <tr key={di}>
                      <td className="p-1 border">{d.month}</td>
                      <td className="p-1 border text-right">{d.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ----------------------------------------------------------------------
 *  Deposito Netto - Componenti e Logica
 * ------------------------------------------------------------------- */
interface CalculateNetDepositDialogProps {
  deposit: MovementSummary;
  withdraw: MovementSummary;
  onCalculate: (result: NetDepositResult) => void;
}

const CalculateNetDepositDialog: React.FC<CalculateNetDepositDialogProps> = ({
  deposit,
  withdraw,
  onCalculate,
}) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'mensile' | 'annuale' | 'totale'>('mensile');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  const months = useMemo(() => {
    const all = new Set([...deposit.months, ...withdraw.months]);
    return Array.from(all).sort().reverse();
  }, [deposit, withdraw]);

  const years = useMemo(() => {
    const all = new Set([...deposit.months, ...withdraw.months].map(m => m.split('-')[0]));
    return Array.from(all).sort().reverse();
  }, [deposit, withdraw]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  const calculate = () => {
    let depSum = 0;
    let witSum = 0;
    let periodDesc = '';
    const depDetails: { method: string; amount: number }[] = [];
    const witDetails: { method: string; amount: number }[] = [];

    if (type === 'mensile') {
      if (!selectedPeriod) return toast.error('Seleziona un mese');
      periodDesc = monthLabel(selectedPeriod);
      
      Object.entries(deposit.perMonth).forEach(([method, map]) => {
        const amt = map[selectedPeriod] || 0;
        if (amt > 0) {
          depSum += amt;
          depDetails.push({ method, amount: amt });
        }
      });
      Object.entries(withdraw.perMonth).forEach(([method, map]) => {
        const amt = map[selectedPeriod] || 0;
        if (amt > 0) {
          witSum += amt;
          witDetails.push({ method, amount: amt });
        }
      });
    } else if (type === 'annuale') {
      if (!selectedPeriod) return toast.error('Seleziona un anno');
      periodDesc = `Anno ${selectedPeriod}`;
      
      Object.entries(deposit.perMonth).forEach(([method, map]) => {
        let methodTotal = 0;
        Object.entries(map).forEach(([mk, amt]) => {
          if (mk.startsWith(selectedPeriod)) methodTotal += amt;
        });
        if (methodTotal > 0) {
          depSum += methodTotal;
          depDetails.push({ method, amount: methodTotal });
        }
      });
      Object.entries(withdraw.perMonth).forEach(([method, map]) => {
        let methodTotal = 0;
        Object.entries(map).forEach(([mk, amt]) => {
          if (mk.startsWith(selectedPeriod)) methodTotal += amt;
        });
        if (methodTotal > 0) {
          witSum += methodTotal;
          witDetails.push({ method, amount: methodTotal });
        }
      });
    } else {
      periodDesc = "Intero corso attività";
      depSum = deposit.totAll;
      witSum = withdraw.totAll;
      Object.entries(deposit.methods).forEach(([method, amount]) => depDetails.push({ method, amount }));
      Object.entries(withdraw.methods).forEach(([method, amount]) => witDetails.push({ method, amount }));
    }

    onCalculate({
      id: crypto.randomUUID(),
      type,
      period: periodDesc,
      totalDeposits: depSum,
      totalWithdrawals: witSum,
      netValue: witSum - depSum,
      details: { deposits: depDetails, withdrawals: witDetails }
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Wallet className="w-4 h-4" /> Calcola Deposito Netto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calcolo Deposito Netto</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Tipo di Range</Label>
            <RadioGroup value={type} onValueChange={(v: any) => { setType(v); setSelectedPeriod(''); }}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mensile" id="r-mensile" />
                <Label htmlFor="r-mensile">Mensile</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="annuale" id="r-annuale" />
                <Label htmlFor="r-annuale">Annuale</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="totale" id="r-totale" />
                <Label htmlFor="r-totale">Intero corso attività</Label>
              </div>
            </RadioGroup>
          </div>

          {type === 'mensile' && (
            <div className="space-y-2">
              <Label>Seleziona Mese</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli un mese..." />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'annuale' && (
            <div className="space-y-2">
              <Label>Seleziona Anno</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli un anno..." />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
          <Button onClick={calculate}>Calcola</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NetDepositTable: React.FC<{
  results: NetDepositResult[];
  onDelete: (id: string) => void;
}> = ({ results, onDelete }) => {
  const [expand, setExpand] = useState<string | null>(null);

  if (results.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="font-semibold text-md mb-3 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" /> Risultati Deposito Netto
      </h4>
      <div className="space-y-3">
        {results.map(r => (
          <div key={r.id} className="border rounded bg-card overflow-hidden">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpand(expand === r.id ? null : r.id)}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Periodo</div>
                  <div className="font-medium text-sm">{r.period}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Depositi (+)</div>
                  <div className="text-sm">€ {r.totalDeposits.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Prelievi (-)</div>
                  <div className="text-sm">€ {r.totalWithdrawals.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Netto</div>
                  <div className={cn(
                    "font-bold text-sm px-2 py-0.5 rounded-md inline-block",
                    r.netValue < 0 
                      ? "text-red-600 bg-red-100 dark:text-red-500 dark:bg-red-900/30" 
                      : "text-green-600 bg-green-100 dark:text-green-500 dark:bg-green-900/30"
                  )}>
                    {r.netValue < 0 ? '-' : '+'}{Math.abs(r.netValue).toFixed(2)} €
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-4 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
              >
                Elimina
              </Button>
            </div>
            {expand === r.id && (
              <div className="p-4 bg-muted/30 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-bold mb-2 uppercase text-muted-foreground">Dettaglio Depositi</h5>
                  <ul className="text-xs space-y-1">
                    {r.details.deposits.map((d, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{d.method}</span>
                        <span className="font-mono">€ {d.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-xs font-bold mb-2 uppercase text-muted-foreground">Dettaglio Prelievi</h5>
                  <ul className="text-xs space-y-1">
                    {r.details.withdrawals.map((w, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{w.method}</span>
                        <span className="font-mono">€ {w.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-span-full mt-4 pt-4 border-t flex justify-between items-center bg-muted/20 -mx-4 px-4 -mb-4 py-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Riepilogo Deposito Netto</span>
                  <div className={cn(
                    "font-bold text-sm px-3 py-1 rounded-full",
                    r.netValue < 0 
                      ? "text-red-600 bg-red-100 dark:text-red-500 dark:bg-red-900/30" 
                      : "text-green-600 bg-green-100 dark:text-green-500 dark:bg-green-900/30"
                  )}>
                    {r.netValue < 0 ? '-' : '+'}{Math.abs(r.netValue).toFixed(2)} €
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------------
 *  Presentational components (MovementsTable, FractionsTable, CardsTable)
 * ------------------------------------------------------------------- */
interface MovementsTableProps {
  title: string;
  data: MovementSummary;
  category: 'depositi' | 'prelievi';
  onCalculateAverage: (res: AverageResult) => void;
  averageResults: AverageResult[];
  onDeleteAverage: (id: string) => void;
}

const MovementsTable: React.FC<MovementsTableProps> = ({
  title,
  data,
  category,
  onCalculateAverage,
  averageResults,
  onDeleteAverage,
}) => {
  const [month, setMonth] = useState<string>('');
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthIdx = parseInt(m, 10) - 1;
    return `${names[monthIdx] || m} ${y}`;
  };

  const fmt = (v: any) => {
    const d = v instanceof Date ? v : new Date(v);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('it-IT') : String(v);
  };

  const formatImporto = (raw: any, num: number) => {
    if (raw == null || String(raw).trim() === '') return num.toFixed(2);
    return String(raw).trim();
  };

  const handleCalculateInternal = (params: AverageResult) => {
    // Eseguiamo il calcolo effettivo qui
    const sortedMonths = [...data.months].sort().reverse();
    const startIdx = params.includeCurrentMonth ? 0 : 1;
    const targetMonths = sortedMonths.slice(startIdx, startIdx + params.rangeMonths);

    const details: AverageDetail[] = targetMonths.map(m => {
      let totalForMonth = 0;
      params.selectedMethods.forEach(method => {
        totalForMonth += data.perMonth[method]?.[m] || 0;
      });
      return { month: monthLabel(m), total: totalForMonth };
    });

    const sum = details.reduce((acc, curr) => acc + curr.total, 0);
    const avg = details.length > 0 ? sum / details.length : 0;

    onCalculateAverage({
      ...params,
      averageValue: avg,
      details,
    });
  };

  const rows = useMemo(() => {
    if (!month) return Object.entries(data.methods).map(([k, v]) => [k, v]);
    const filtered: [string, number][] = [];
    Object.entries(data.perMonth).forEach(([method, map]) => {
      const v = map[month];
      if (v) filtered.push([method, v]);
    });
    return filtered;
  }, [month, data]);

  const total = useMemo(() => rows.reduce((s, [, v]) => s + Number(v), 0), [rows]);

  if (!data.totAll) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h4 className="font-semibold text-md flex-1">{title}</h4>
        <CalculateAverageDialog
          category={category}
          methods={Object.keys(data.methods)}
          availableMonths={data.months}
          onCalculate={handleCalculateInternal}
          trigger={
            <Button variant="outline" size="sm" className="gap-2">
              <Calculator className="w-4 h-4" /> Media
            </Button>
          }
        />
        {data.months.length > 0 && (
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            <option value="">Totale</option>
            {data.months.map(m => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left border">Metodo</th>
              <th className="p-2 text-right border">Importo €</th>
              <th className="p-2 text-right border">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([method, value]) => (
              <Fragment key={method}>
                <tr 
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedMethod(expandedMethod === method ? null : method)}
                >
                  <td className="p-2 border flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-3">
                      {expandedMethod === method ? '▼' : '▶'}
                    </span>
                    {method}
                  </td>
                  <td className="p-2 border text-right font-medium">{Number(value).toFixed(2)}</td>
                  <td className="p-2 border text-right text-xs text-muted-foreground">
                    {total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
                {expandedMethod === method && (
                  <tr>
                    <td colSpan={3} className="p-0 border">
                      <div className="p-2 bg-muted/20">
                        <table className="w-full text-xs bg-background rounded border shadow-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-1.5 text-left border-b">Data</th>
                              <th className="p-1.5 text-left border-b">Descrizione/Causale</th>
                              <th className="p-1.5 text-right border-b">Importo €</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.transactionsByMethod[method]
                              ?.filter(tx => !month || tx.month === month)
                              .map((tx, ti) => (
                                <tr key={ti} className="hover:bg-muted/30 border-b last:border-0">
                                  <td className="p-1.5 text-muted-foreground">{fmt(tx.date)}</td>
                                  <td className="p-1.5">{tx.description}</td>
                                  <td className="p-1.5 text-right font-mono">{formatImporto(tx.raw, tx.amount)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="p-2 border text-right">Totale €</th>
              <th className="p-2 border text-right">{total.toFixed(2)}</th>
              <th className="p-2 border text-right text-xs text-muted-foreground">100.0%</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <AveragesTable
        results={averageResults}
        category={category}
        onDelete={onDeleteAverage}
      />
    </div>
  );
};

interface FractionsTableProps {
  title: string;
  data: FractionWindow[];
}

const FractionsTable: React.FC<FractionsTableProps> = ({ title, data }) => {
  const [expand, setExpand] = useState<number | null>(null);
  const fmt = (v: any) => {
    const d = v instanceof Date ? v : new Date(v);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('it-IT') : String(v);
  };
  const formatImporto = (raw: any, num: number) => {
    if (raw == null || String(raw).trim() === '') return num.toFixed(2);
    return String(raw).trim();
  };

  if (!data.length) return null;

  return (
    <details open className="mt-6">
      <summary className="font-semibold cursor-pointer mb-2">
        {title} ({data.length})
      </summary>
      <div className="overflow-x-auto">
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
                <tr
                  key={i}
                  onClick={() => setExpand(expand === i ? null : i)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <td className="border p-2">{fmt(f.start)} - {fmt(f.end)}</td>
                  <td className="border p-2 text-right">{f.total.toFixed(2)}</td>
                  <td className="border p-2 text-right">{f.transactions.length}</td>
                </tr>
                {expand === i && (
                  <tr key={`${i}-d`}>
                    <td colSpan={3} className="p-0 border">
                      <div className="p-2 bg-background">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-1 text-left">Data</th>
                              <th className="p-1 text-left">Causale</th>
                              <th className="p-1 text-right">Importo €</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.transactions.map((t, ti) => (
                              <tr key={ti}>
                                <td className="p-1">{fmt(t.date)}</td>
                                <td className="p-1">{t.causale}</td>
                                <td className="p-1 text-right">{formatImporto(t.raw, t.amount)}</td>
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

interface CardsTableProps {
  data: CardsSummary;
  onCalculateAverage: (res: AverageResult) => void;
  averageResults: AverageResult[];
  onDeleteAverage: (id: string) => void;
}

const CardsTable: React.FC<CardsTableProps> = ({
  data,
  onCalculateAverage,
  averageResults,
  onDeleteAverage,
}) => {
  const [month, setMonth] = useState<string>('');
  const [showReasons, setShowReasons] = useState<boolean>(true);
  const [expandedPan, setExpandedPan] = useState<string | null>(null);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthIdx = parseInt(m, 10) - 1;
    return `${names[monthIdx] || m} ${y}`;
  };

  const fmt = (v: any) => {
    if (!v) return '-';
    const d = v instanceof Date ? v : new Date(v);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('it-IT') : String(v);
  };

  const handleCalculateInternal = (params: AverageResult) => {
    const sortedMonths = [...data.months].sort().reverse();
    const startIdx = params.includeCurrentMonth ? 0 : 1;
    const targetMonths = sortedMonths.slice(startIdx, startIdx + params.rangeMonths);

    const details: AverageDetail[] = targetMonths.map(m => {
      let totalForMonth = 0;
      params.selectedMethods.forEach(pan => {
        const card = data.cards.find(c => c.pan === pan);
        if (card) {
          totalForMonth += card.appPerMonth?.[m] || 0;
        }
      });
      return { month: monthLabel(m), total: totalForMonth };
    });

    const sum = details.reduce((acc, curr) => acc + curr.total, 0);
    const avg = details.length > 0 ? sum / details.length : 0;

    onCalculateAverage({
      ...params,
      averageValue: avg,
      details,
    });
  };

  const filteredCards = useMemo(() => {
    if (!month) return data.cards;
    return data.cards.filter(c => c.months?.includes(month));
  }, [month, data.cards]);

  // Calcola totali approvati/declinati in base al filtro
  const totals = useMemo(() => {
    let tApp = 0, tDec = 0;
    if (month) {
      for (const c of filteredCards) {
        tApp += c.appPerMonth?.[month] ?? 0;
        tDec += c.decPerMonth?.[month] ?? 0;
      }
    } else {
      for (const c of filteredCards) {
        tApp += c.app;
        tDec += c.dec;
      }
    }
    return { app: tApp, dec: tDec };
  }, [filteredCards, month]);

  if (!data.cards.length) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <h4 className="font-semibold text-md flex-1">Carte</h4>
        <CalculateAverageDialog
          category="carte"
          methods={data.cards.map(c => c.pan)}
          availableMonths={data.months}
          onCalculate={handleCalculateInternal}
          trigger={
            <Button variant="outline" size="sm" className="gap-2">
              <Calculator className="w-4 h-4" /> Media
            </Button>
          }
        />
        <button
          onClick={() => setShowReasons(!showReasons)}
          className="px-3 py-1 text-sm border rounded bg-background hover:bg-muted transition-colors"
        >
          {showReasons ? 'Nascondi' : 'Mostra'} Motivi
        </button>
        {data.months.length > 0 && (
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            <option value="">Totale</option>
            {data.months.map(m => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 border text-left">PAN</th>
              <th className="p-2 border text-left">BIN</th>
              <th className="p-2 border text-left">Holder</th>
              <th className="p-2 border text-left">Tipo Carta</th>
              <th className="p-2 border text-left">Tipo Prodotto</th>
              <th className="p-2 border text-left">Paese</th>
              <th className="p-2 border text-left">Banca</th>
              <th className="p-2 border text-right">Approved €</th>
              <th className="p-2 border text-right">Declined €</th>
              <th className="p-2 border text-right"># Declined</th>
              <th className="p-2 border text-right">% Depositi</th>
              {showReasons && <th className="p-2 border text-left">Reasons</th>}
            </tr>
          </thead>
          <tbody>
            {filteredCards.map(c => {
              const appVal = month ? (c.appPerMonth?.[month] ?? 0) : c.app;
              const decVal = month ? (c.decPerMonth?.[month] ?? 0) : c.dec;
              const nDecVal = month ? (c.nDecPerMonth?.[month] ?? 0) : c.nDec;
              return (
                <Fragment key={c.pan}>
                  <tr 
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setExpandedPan(expandedPan === c.pan ? null : c.pan)}
                  >
                    <td className="p-2 border font-mono flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-3">
                        {expandedPan === c.pan ? '▼' : '▶'}
                      </span>
                      {c.pan}
                    </td>
                    <td className="p-2 border">{c.bin}</td>
                    <td className="p-2 border">{c.name}</td>
                    <td className="p-2 border">{c.type}</td>
                    <td className="p-2 border">{c.prod}</td>
                    <td className="p-2 border">{c.ctry}</td>
                    <td className="p-2 border">{c.bank}</td>
                    <td className="p-2 border text-right font-medium">{appVal.toFixed(2)}</td>
                    <td className="p-2 border text-right">{decVal.toFixed(2)}</td>
                    <td className="p-2 border text-right">{nDecVal}</td>
                    <td className="p-2 border text-right">{c.perc.toFixed(1)}%</td>
                    {showReasons && <td className="p-2 border text-xs">{c.reasons}</td>}
                  </tr>
                  {expandedPan === c.pan && (
                    <tr>
                      <td colSpan={showReasons ? 12 : 11} className="p-0 border">
                        <div className="p-2 bg-muted/20">
                          <table className="w-full text-xs bg-background rounded border shadow-sm">
                            <thead>
                              <tr className="bg-muted/50">
                                <th className="p-1.5 text-left border-b">Data</th>
                                <th className="p-1.5 text-left border-b">Risultato</th>
                                <th className="p-1.5 text-left border-b">Motivo</th>
                                <th className="p-1.5 text-right border-b">Importo €</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.transactions
                                ?.filter(tx => !month || tx.month === month)
                                .map((tx, ti) => (
                                  <tr key={ti} className="hover:bg-muted/30 border-b last:border-0">
                                    <td className="p-1.5 text-muted-foreground">{fmt(tx.date)}</td>
                                    <td className="p-1.5">
                                      <Badge variant={tx.result.toLowerCase() === 'approved' ? 'default' : 'destructive'} className="text-[10px] px-1 py-0 h-4">
                                        {tx.result}
                                      </Badge>
                                    </td>
                                    <td className="p-1.5 text-muted-foreground italic">{tx.reason || '-'}</td>
                                    <td className="p-1.5 text-right font-mono">{tx.amount.toFixed(2)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={7} className="p-2 border text-right">Totale € Approved</th>
              <th className="p-2 border text-right font-bold">{totals.app.toFixed(2)}</th>
              <th colSpan={showReasons ? 4 : 3} className="border"></th>
            </tr>
          </tfoot>
        </table>
      </div>
      <AveragesTable
        results={averageResults}
        category="carte"
        onDelete={onDeleteAverage}
      />
    </div>
  );
};

/* ----------------------------------------------------------------------
 *  Component principale TransactionsTab
 * ------------------------------------------------------------------- */
// Componente per la tabella del rigioco mensile con paginazione
const RecyclingTable: React.FC<{
  monthlyRecycling: Array<{
    month: string;
    withdrawalsCount: number;
    totalWithdrawalsAmount: number;
    totalRecycledAmount: number;
    averageRecyclingPercentage: number;
    totalRecyclingPercentageByAmount: number;
  }>;
  totals: {
    withdrawalsCount: number;
    totalWithdrawalsAmount: number;
    totalRecycledAmount: number;
  };
  totalAveragePercentage: number;
  totalPercentageByAmount: number;
}> = ({ monthlyRecycling, totals, totalAveragePercentage, totalPercentageByAmount }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3;

  // Calcola la paginazione
  const totalPages = Math.ceil(monthlyRecycling.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = monthlyRecycling.slice(startIndex, endIndex);

  // Reset alla prima pagina se la pagina corrente non esiste più
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Helper per formattare il mese
  const monthLabel = (month: string) => {
    const [y, m] = month.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${names[parseInt(m) - 1]} ${y}`;
  };

  const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Rigioco delle vincite prelevate (per mese)</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mese</TableHead>
              <TableHead className="text-right">Prelievi</TableHead>
              <TableHead className="text-right">Rigiocato</TableHead>
              <TableHead className="text-right">% Media</TableHead>
              <TableHead className="text-right">% Importi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="font-medium">{monthLabel(row.month)}</TableCell>
                <TableCell className="text-right">
                  {row.withdrawalsCount > 0 ? (
                    <>
                      {eur(row.totalWithdrawalsAmount)}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({row.withdrawalsCount})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {row.totalRecycledAmount > 0 ? (
                    eur(row.totalRecycledAmount)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {row.withdrawalsCount > 0 ? (
                    `${row.averageRecyclingPercentage.toFixed(1)}%`
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {row.totalWithdrawalsAmount > 0 ? (
                    `${row.totalRecyclingPercentageByAmount.toFixed(1)}%`
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="font-bold">Totale</TableCell>
              <TableCell className="text-right font-bold">
                {eur(totals.totalWithdrawalsAmount)}
                <span className="text-xs text-muted-foreground ml-1">
                  ({totals.withdrawalsCount})
                </span>
              </TableCell>
              <TableCell className="text-right font-bold">
                {eur(totals.totalRecycledAmount)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {totalAveragePercentage.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right font-bold">
                {totalPercentageByAmount.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(currentPage - 1);
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(page);
                    }}
                    isActive={currentPage === page}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(currentPage + 1);
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
};

const TransactionsTab: React.FC = () => {
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const [includeWithdraw, setIncludeWithdraw] = useState(true);
  const [loading, setLoading] = useState(false);
  const [averageResults, setAverageResults] = useState<AverageResult[]>([]);
  const [netDepositResults, setNetDepositResults] = useState<NetDepositResult[]>([]);
  const { result, setResult, reset } = useTransactionsStore();

  const analyzeDisabled = !depositFile || (includeWithdraw && !withdrawFile) || (includeCard && !cardFile);

  const handleCalculateAverage = useCallback((res: AverageResult) => {
    setAverageResults(prev => [...prev, res]);
    toast.success('Media calcolata con successo');
  }, []);

  const handleDeleteAverage = useCallback((id: string) => {
    setAverageResults(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleCalculateNetDeposit = useCallback((res: NetDepositResult) => {
    setNetDepositResults(prev => [...prev, res]);
    toast.success('Deposito netto calcolato con successo');
  }, []);

  const handleDeleteNetDeposit = useCallback((id: string) => {
    setNetDepositResults(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (analyzeDisabled) return;
    setLoading(true);
    try {
      const deposit = depositFile ? await parseMovements(depositFile, 'deposit') : null;
      const withdraw = (includeWithdraw && withdrawFile) ? await parseMovements(withdrawFile, 'withdraw') : null;
      const cards = includeCard && cardFile ? await parseCards(cardFile, deposit?.totAll || 0) : null;

      setResult({ deposit, withdraw, cards });
      toast.success('Analisi completata');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante l\'analisi');
    } finally {
      setLoading(false);
    }
  }, [depositFile, withdrawFile, cardFile, includeCard, includeWithdraw, analyzeDisabled]);

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Analisi Transazioni</h3>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="includeWithdrawCheckbox"
            checked={includeWithdraw}
            onChange={e => setIncludeWithdraw(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="includeWithdrawCheckbox" className="text-sm">
            Includi Prelievi
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="includeCardCheckbox"
            checked={includeCard}
            onChange={e => setIncludeCard(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="includeCardCheckbox" className="text-sm">
            Includi Transazioni Carte
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">File Carte</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={!includeCard}
            onChange={e => setCardFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">File Depositi</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setDepositFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">File Prelievi</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={!includeWithdraw}
            onChange={e => setWithdrawFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90"
          />
        </div>
      </div>

      <Button className="w-full" onClick={handleAnalyze} disabled={analyzeDisabled || loading}>
        {loading ? 'Analisi in corso…' : 'Analizza'}
      </Button>

      {result && (
        <div className="space-y-8">
          <div className="flex justify-end">
            <CalculateNetDepositDialog 
              deposit={result.deposit || { totAll: 0, months: [], methods: {}, perMonth: {} }} 
              withdraw={result.withdraw || { totAll: 0, months: [], methods: {}, perMonth: {} }} 
              onCalculate={handleCalculateNetDeposit}
            />
          </div>

          {/* tabelle esistenti */}
          {result.deposit && (
            <MovementsTable
              title="Depositi"
              data={result.deposit}
              category="depositi"
              onCalculateAverage={handleCalculateAverage}
              averageResults={averageResults}
              onDeleteAverage={handleDeleteAverage}
            />
          )}
          {result.withdraw && (
            <>
              <MovementsTable
                title="Prelievi"
                data={result.withdraw}
                category="prelievi"
                onCalculateAverage={handleCalculateAverage}
                averageResults={averageResults}
                onDeleteAverage={handleDeleteAverage}
              />
              {result.withdraw?.fractions && result.withdraw.fractions.length > 0 && (
                <FractionsTable title="Frazionate Prelievi" data={result.withdraw.fractions} />
              )}
            </>
          )}
          {includeCard && result.cards && result.cards.cards.length > 0 && (
            <CardsTable
              data={result.cards}
              onCalculateAverage={handleCalculateAverage}
              averageResults={averageResults}
              onDeleteAverage={handleDeleteAverage}
            />
          )}

          <NetDepositTable 
            results={netDepositResults} 
            onDelete={handleDeleteNetDeposit} 
          />

          {/* Monthly Summary Table */}
          <TransactionsCharts.MonthlySummaryTable 
            depositData={result.deposit} 
            withdrawData={result.withdraw} 
          />

          {/* Rigioco delle vincite prelevate - Mensile */}
          {result.withdraw && result.deposit && (() => {
            // Helper per creare la chiave mensile (stessa logica usata nel parsing)
            const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            // Raccogli tutti i prelievi da tutti i metodi
            const allWithdrawals: { data: Date; desc: string; amt: number; month: string }[] = [];
            Object.values(result.withdraw.transactionsByMethod || {}).forEach(methodTxs => {
              methodTxs.forEach((tx: any) => {
                const date = new Date(tx.date);
                if (isNaN(date.getTime())) return;
                const monthKeyStr = monthKey(date);
                allWithdrawals.push({
                  data: date,
                  desc: tx.description || '',
                  amt: tx.amount || 0,
                  month: monthKeyStr
                });
              });
            });

            // Raccogli tutti i depositi da tutti i metodi
            const allDeposits: { data: Date; desc: string; amt: number }[] = [];
            Object.values(result.deposit.transactionsByMethod || {}).forEach(methodTxs => {
              methodTxs.forEach((tx: any) => {
                const date = new Date(tx.date);
                if (isNaN(date.getTime())) return;
                allDeposits.push({
                  data: date,
                  desc: tx.description || '',
                  amt: tx.amount || 0
                });
              });
            });

            // Funzione helper per calcolare il rigioco per un insieme di prelievi
            const calculateRecycling = (withdrawals: typeof allWithdrawals, deposits: typeof allDeposits) => {
              // Ordina i prelievi per data (più vecchi prima)
              const sortedWithdrawals = [...withdrawals].sort((a, b) => {
                const dateA = a.data.getTime();
                const dateB = b.data.getTime();
                if (isNaN(dateA) || isNaN(dateB)) return 0;
                return dateA - dateB;
              });
              
              // Ordina i depositi per data (più vecchi prima)
              const sortedDeposits = [...deposits].sort((a, b) => {
                const dateA = a.data.getTime();
                const dateB = b.data.getTime();
                if (isNaN(dateA) || isNaN(dateB)) return 0;
                return dateA - dateB;
              });
              
              // Traccia quali depositi sono stati già assegnati
              const depositRemaining = new Map<number, number>();
              sortedDeposits.forEach((dep, index) => {
                depositRemaining.set(index, Math.abs(dep.amt));
              });
              
              let totalRecyclingPercentage = 0;
              let totalWithdrawalsAmount = 0;
              let totalRecycledAmount = 0;
              
              sortedWithdrawals.forEach((prelievo) => {
                const prelievoDate = prelievo.data;
                if (isNaN(prelievoDate.getTime())) return;
                
                const prelievoAmount = Math.abs(prelievo.amt);
                totalWithdrawalsAmount += prelievoAmount;
                
                // Calcola la data limite (7 giorni dopo il prelievo)
                const sevenDaysLater = new Date(prelievoDate);
                sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
                
                // Trova depositi disponibili entro 7 giorni dal prelievo
                let depositedAmount = 0;
                sortedDeposits.forEach((dep, depIndex) => {
                  const remaining = depositRemaining.get(depIndex);
                  if (!remaining || remaining <= 0) return;
                  
                  const depDate = dep.data;
                  if (isNaN(depDate.getTime())) return;
                  
                  if (depDate > prelievoDate && depDate <= sevenDaysLater) {
                    const remainingNeeded = prelievoAmount - depositedAmount;
                    if (remainingNeeded > 0) {
                      const amountToUse = Math.min(remainingNeeded, remaining);
                      depositedAmount += amountToUse;
                      depositRemaining.set(depIndex, remaining - amountToUse);
                      if (depositedAmount >= prelievoAmount) {
                        return;
                      }
                    }
                  }
                });
                
                const recyclingPercentage = prelievoAmount > 0
                  ? Math.min(100, (depositedAmount / prelievoAmount) * 100)
                  : 0;
                
                totalRecyclingPercentage += recyclingPercentage;
                totalRecycledAmount += depositedAmount;
              });

              const averageRecyclingPercentage = withdrawals.length > 0
                ? (totalRecyclingPercentage / withdrawals.length)
                : 0;
              
              const totalRecyclingPercentageByAmount = totalWithdrawalsAmount > 0
                ? ((totalRecycledAmount / totalWithdrawalsAmount) * 100)
                : 0;

              return {
                withdrawalsCount: withdrawals.length,
                totalWithdrawalsAmount,
                totalRecycledAmount,
                averageRecyclingPercentage,
                totalRecyclingPercentageByAmount
              };
            };

            // Raggruppa i prelievi per mese
            const withdrawalsByMonth = new Map<string, typeof allWithdrawals>();
            allWithdrawals.forEach(w => {
              if (!withdrawalsByMonth.has(w.month)) {
                withdrawalsByMonth.set(w.month, []);
              }
              withdrawalsByMonth.get(w.month)!.push(w);
            });

            // Ottieni tutti i mesi (unione di depositi e prelievi)
            const allMonths = new Set<string>();
            if (result.withdraw?.months) result.withdraw.months.forEach(m => allMonths.add(m));
            if (result.deposit?.months) result.deposit.months.forEach(m => allMonths.add(m));
            const sortedMonths = Array.from(allMonths).sort().reverse();

            // Calcola il rigioco per ogni mese
            const monthlyRecycling = sortedMonths.map(month => {
              const monthWithdrawals = withdrawalsByMonth.get(month) || [];
              
              // Per ogni mese, usa tutti i depositi disponibili (possono essere di mesi diversi)
              // perché un deposito può rigiocare un prelievo anche se è nel mese successivo
              const result = calculateRecycling(monthWithdrawals, allDeposits);
              
              return {
                month,
                ...result
              };
            });

            // Calcola totali generali
            const totals = monthlyRecycling.reduce(
              (acc, row) => ({
                withdrawalsCount: acc.withdrawalsCount + row.withdrawalsCount,
                totalWithdrawalsAmount: acc.totalWithdrawalsAmount + row.totalWithdrawalsAmount,
                totalRecycledAmount: acc.totalRecycledAmount + row.totalRecycledAmount,
              }),
              { withdrawalsCount: 0, totalWithdrawalsAmount: 0, totalRecycledAmount: 0 }
            );

            const totalAveragePercentage = totals.withdrawalsCount > 0
              ? (monthlyRecycling.reduce((sum, row) => sum + row.averageRecyclingPercentage * row.withdrawalsCount, 0) / totals.withdrawalsCount)
              : 0;

            const totalPercentageByAmount = totals.totalWithdrawalsAmount > 0
              ? ((totals.totalRecycledAmount / totals.totalWithdrawalsAmount) * 100)
              : 0;

            return (
              <RecyclingTable
                monthlyRecycling={monthlyRecycling}
                totals={totals}
                totalAveragePercentage={totalAveragePercentage}
                totalPercentageByAmount={totalPercentageByAmount}
              />
            );
          })()}

          {/* charts */}
          <TransactionsCharts.DepositiVsPrelievi deposit={result.deposit} withdraw={result.withdraw} />
          <TransactionsCharts.TrendDepositi deposit={result.deposit} withdraw={result.withdraw} />
          {result.deposit && (<TransactionsCharts.TotalePerMetodo title="Depositi per metodo" data={result.deposit} />)}
          {result.withdraw && (<TransactionsCharts.TotalePerMetodo title="Prelievi per metodo" data={result.withdraw} />)}
          {result.deposit && result.deposit.months && result.deposit.months.length >= 3 && (
            <TransactionsCharts.DepositsForecast deposit={result.deposit} />
          )}
          {includeCard && result.cards && result.cards.cards.length > 0 && (
            <TransactionsCharts.TopCardsByApproved rows={result.cards.cards} />
          )}
        </div>
      )}
    </Card>
  );
};

export default TransactionsTab;
