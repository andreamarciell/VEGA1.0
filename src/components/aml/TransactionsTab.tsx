import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

/* ----------------------------------------------------------------------
 *  TransactionsTab – completamente riscritto in React/TypeScript
 *  Permette di caricare file Excel di Depositi, Prelievi e (opz.) Carte,
 *  di analizzarli e visualizzare i risultati con filtri mensili.
 *  Non è stato effettuato alcun porting diretto da transactions.js;
 *  il codice è nuovo, ma replica le stesse funzioni chiave.
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
  perc: number; // % sul totale depositi
  reasons: string;
}

interface AnalysisResult {
  deposit: MovementSummary | null;
  withdraw: MovementSummary | null;
  cards: CardsSummary | null;
}

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

    const amt = parseNum(r[cAmt]);
    if (!amt) continue;

    perMethod[method] = (perMethod[method] || 0) + amt;
    totAll += amt;

    const dt = excelToDate(r[cDate]);
    if (!dt || isNaN(dt.getTime())) continue;

    const mk = monthKey(dt);
    monthsSet.add(mk);

    perMonth[method] ??= {};
    perMonth[method][mk] = (perMonth[method][mk] || 0) + amt;

    if (mode === 'withdraw') {
      transactions.push({ data: dt, desc, amt, rawAmt: r[cAmt] });
    }
  }

  const months = Array.from(monthsSet).sort().reverse();

  const fractions = mode === 'withdraw' ? detectFractions(transactions) : undefined;

  return { totAll, months, methods: perMethod, perMonth, fractions };
};

/* ----------------------------------------------------------------------
 *  Fractions detection (rolling 7gg, >5000€, solo Voucher PVR)
 * ------------------------------------------------------------------- */
const detectFractions = (txs: { data: Date; desc: string; amt: number; rawAmt: any }[]): FractionWindow[] => {
  const THRESHOLD = 5000;
  const isVoucherPVR = (d: string) => d.toLowerCase().includes('voucher') && d.toLowerCase().includes('pvr');
  const filtered = txs.filter(t => isVoucherPVR(t.desc)).sort((a, b) => a.data.getTime() - b.data.getTime());

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

  let i = 0;
  while (i < filtered.length) {
    const windowStart = startDay(filtered[i].data);
    let j = i, running = 0;

    while (j < filtered.length) {
      const t = filtered[j];
      const diffDays = (startDay(t.data).getTime() - windowStart.getTime()) / 86400000;
      if (diffDays > 6) break;
      running += t.amt;
      if (running >= THRESHOLD) {
        res.push({
          start: fmt(windowStart),
          end: fmt(startDay(t.data)),
          total: running,
          transactions: filtered.slice(i, j + 1).map(x => ({
            date: x.data.toISOString(),
            amount: x.amt,
            raw: x.rawAmt,
            causale: x.desc,
          })),
        });
        i = j + 1;
        break;
      }
      j++;
    }
    if (running < THRESHOLD) i++;
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
    bank: findCol(hdr, ['bank']),
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
    if (ix.date !== -1) {
      dt = excelToDate(r[ix.date]);
      if (dt && !isNaN(dt.getTime())) monthsSet.add(monthKey(dt));
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
        perc: 0,
        reasons: '',
      });
    }
    const entry = cardsMap.get(pan)!;
    const amt = parseNum(r[ix.amt]);
    const resultVal = ix.res !== -1 ? String(r[ix.res] || '') : 'approved';

    if (/^approved$/i.test(resultVal)) {
      entry.app += amt;
      summary.app += amt;
    } else {
      entry.dec += amt;
      entry.nDec += 1;
      summary.dec += amt;
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
 *  Presentational components (MovementsTable, FractionsTable, CardsTable)
 * ------------------------------------------------------------------- */
interface MovementsTableProps {
  title: string;
  data: MovementSummary;
}

const MovementsTable: React.FC<MovementsTableProps> = ({ title, data }) => {
  const [month, setMonth] = useState<string>('');
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
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

  const total = useMemo(() => rows.reduce((s, [, v]) => s + v, 0), [rows]);

  if (!data.totAll) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h4 className="font-semibold text-md flex-1">{title}</h4>
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
            </tr>
          </thead>
          <tbody>
            {rows.map(([method, value]) => (
              <tr key={method} className="hover:bg-muted/50">
                <td className="p-2 border">{method}</td>
                <td className="p-2 border text-right">{value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="p-2 border text-right">Totale €</th>
              <th className="p-2 border text-right">{total.toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

interface FractionsTableProps {
  data: FractionWindow[];
}

const FractionsTable: React.FC<FractionsTableProps> = ({ data }) => {
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
        Frazionate Prelievi ({data.length})
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
}

const CardsTable: React.FC<CardsTableProps> = ({ data }) => {
  const [month, setMonth] = useState<string>('');
  const filtered = useMemo(() => {
    if (!month) return data.cards;
    return data.cards.filter(c => c.transactions?.some((t: any) => t.monthKey === month));
  }, [month, data]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  if (!data.cards.length) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <h4 className="font-semibold text-md flex-1">Carte</h4>
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
              <th className="p-2 border text-left">Paese</th>
              <th className="p-2 border text-left">Banca</th>
              <th className="p-2 border text-right">Approved €</th>
              <th className="p-2 border text-right">Declined €</th>
              <th className="p-2 border text-right"># Declined</th>
              <th className="p-2 border text-right">% Depositi</th>
              <th className="p-2 border text-left">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.pan} className="hover:bg-muted/50">
                <td className="p-2 border">{c.pan}</td>
                <td className="p-2 border">{c.bin}</td>
                <td className="p-2 border">{c.name}</td>
                <td className="p-2 border">{c.ctry}</td>
                <td className="p-2 border">{c.bank}</td>
                <td className="p-2 border text-right">{c.app.toFixed(2)}</td>
                <td className="p-2 border text-right">{c.dec.toFixed(2)}</td>
                <td className="p-2 border text-right">{c.nDec}</td>
                <td className="p-2 border text-right">{c.perc.toFixed(1)}%</td>
                <td className="p-2 border">{c.reasons}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5} className="p-2 border text-right">Totale € Approved</th>
              <th className="p-2 border text-right">{data.summary.app.toFixed(2)}</th>
              <th colSpan={4}></th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------------
 *  Component principale TransactionsTab
 * ------------------------------------------------------------------- */
const TransactionsTab: React.FC = () => {
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const analyzeDisabled = !depositFile || !withdrawFile || (includeCard && !cardFile);

  const handleAnalyze = useCallback(async () => {
    if (analyzeDisabled) return;
    setLoading(true);
    try {
      const deposit = depositFile ? await parseMovements(depositFile, 'deposit') : null;
      const withdraw = withdrawFile ? await parseMovements(withdrawFile, 'withdraw') : null;
      const cards = includeCard && cardFile ? await parseCards(cardFile, deposit?.totAll || 0) : null;

      setResult({ deposit, withdraw, cards });
      toast.success('Analisi completata');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante l\'analisi');
    } finally {
      setLoading(false);
    }
  }, [depositFile, withdrawFile, cardFile, includeCard, analyzeDisabled]);

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Analisi Transazioni</h3>

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
          {result.deposit && <MovementsTable title="Depositi" data={result.deposit} />}
          {result.withdraw && (
            <>
              <MovementsTable title="Prelievi" data={result.withdraw} />
              {result.withdraw.fractions && result.withdraw.fractions.length > 0 && (
                <FractionsTable data={result.withdraw.fractions} />
              )}
            </>
          )}
          {includeCard && result.cards && result.cards.cards.length > 0 && (
            <CardsTable data={result.cards} />
          )}
        </div>
      )}
    </Card>
  );
};

export default TransactionsTab;
