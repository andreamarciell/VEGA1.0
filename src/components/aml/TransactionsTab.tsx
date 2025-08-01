import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

/* ----------------------------------------------------------------------
 *  TransactionsTab – refactor finale con fix CardsTable
 *  (BIN, Holder, Country, Bank ora visibili)
 * ------------------------------------------------------------------- */

/* --------------------- UTILITIES --------------------- */
const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const parseNum = (v: any) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s+/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > -1 && lastDot > -1) {
    s =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(/,/g, '.')
        : s.replace(/,/g, '');
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
    const tryD = new Date(d);
    if (!isNaN(tryD.getTime())) return tryD;
  }
  return new Date('');
};

const readExcel = (file: File): Promise<any[][]> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = e => {
      try {
        const wb = XLSX.read(
          new Uint8Array(e.target!.result as ArrayBuffer),
          { type: 'array' }
        );
        const rows = XLSX.utils.sheet_to_json(
          wb.Sheets[wb.SheetNames[0]],
          { header: 1 }
        );
        resolve(rows as any[][]);
      } catch (err) {
        reject(err);
      }
    };
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });

/* --------------------- TYPES --------------------- */
interface MovementSummary {
  totAll: number;
  months: string[];
  methods: Record<string, number>;
  perMonth: Record<string, Record<string, number>>;
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
  perc: number;
  reasons: string;
}

interface CardsSummary {
  cards: CardRow[];
  summary: { app: number; dec: number };
}

interface AnalysisResult {
  deposit: MovementSummary | null;
  withdraw: MovementSummary | null;
  cards: CardsSummary | null;
}

/* --------------------- PARSE MOVEMENTS --------------------- */
const parseMovements = async (
  file: File,
  mode: 'deposit' | 'withdraw'
): Promise<MovementSummary> => {
  const rows = await readExcel(file);
  const perMethod: Record<string, number> = {};
  const perMonth: Record<string, Record<string, number>> = {};
  const months = new Set<string>();
  let tot = 0;
  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  rows.forEach(r => {
    if (!Array.isArray(r)) return;
    const desc = String(r[1] || '').trim();
    const amt = parseNum(r[2]);
    if (!amt) return;
    const dt = excelToDate(r[0]);
    if (!dt || isNaN(dt.getTime())) return;

    const mk = monthKey(dt);
    months.add(mk);
    perMethod[desc] = (perMethod[desc] || 0) + amt;
    perMonth[desc] ??= {};
    perMonth[desc][mk] = (perMonth[desc][mk] || 0) + amt;
    tot += amt;
  });

  return {
    totAll: tot,
    months: Array.from(months).sort().reverse(),
    methods: perMethod,
    perMonth
  };
};

/* --------------------- PARSE CARDS --------------------- */
const parseCards = async (
  file: File,
  depTot: number
): Promise<CardsSummary> => {
  const rows = await readExcel(file);
  if (!rows.length)
    return { cards: [], summary: { app: 0, dec: 0 } };

  const hdr = rows[0].map((h: any) => sanitize(String(h)));
  const ix = {
    pan: hdr.findIndex(h => h.includes('pan')),
    bin: hdr.findIndex(h => h.includes('bin')),
    name: hdr.findIndex(h => h.includes('nameoncard')),
    type: hdr.findIndex(h => h.includes('cardtype')),
    prod: hdr.findIndex(h => h.includes('product')),
    ctry: hdr.findIndex(h => h.includes('country')),
    bank: hdr.findIndex(h => h.includes('bank')),
    amt: hdr.findIndex(h => h.includes('amount')),
    res: hdr.findIndex(h => h.includes('result'))
  };

  if (ix.pan === -1 || ix.amt === -1) {
    toast.error('Colonne fondamentali (PAN, Amount) mancanti nel file carte');
    return { cards: [], summary: { app: 0, dec: 0 } };
  }

  const map = new Map<string, CardRow>();
  const summary = { app: 0, dec: 0 };

  rows.slice(1).forEach(r => {
    if (!Array.isArray(r)) return;
    const pan = String(r[ix.pan] || 'UNKNOWN');
    if (!map.has(pan)) {
      map.set(pan, {
        pan,
        bin: ix.bin !== -1 ? String(r[ix.bin] || '') : '',
        name: ix.name !== -1 ? String(r[ix.name] || '') : '',
        type: ix.type !== -1 ? String(r[ix.type] || '') : '',
        prod: ix.prod !== -1 ? String(r[ix.prod] || '') : '',
        ctry: ix.ctry !== -1 ? String(r[ix.ctry] || '') : '',
        bank: ix.bank !== -1 ? String(r[ix.bank] || '') : '',
        app: 0,
        dec: 0,
        nDec: 0,
        perc: 0,
        reasons: ''
      });
    }

    const row = map.get(pan)!;
    const amt = parseNum(r[ix.amt]);
    const resVal =
      ix.res !== -1 ? String(r[ix.res] || 'approved').toLowerCase() : 'approved';

    if (resVal === 'approved') {
      row.app += amt;
      summary.app += amt;
    } else {
      row.dec += amt;
      summary.dec += amt;
      row.nDec += 1;
    }
  });

  const cards = Array.from(map.values()).map(c => ({
    ...c,
    perc: depTot ? (c.app / depTot) * 100 : 0
  }));

  return { cards, summary };
};

/* --------------------- PRESENTATIONAL --------------------- */
const MovementsTable: React.FC<{
  title: string;
  data: MovementSummary;
}> = ({ title, data }) => {
  const total = useMemo(
    () => Object.values(data.methods).reduce((s, v) => s + v, 0),
    [data]
  );
  if (!total) return null;

  return (
    <div className="border rounded p-2 my-2">
      <h4 className="font-semibold">
        {title} – Totale € {total.toFixed(2)}
      </h4>
      <ul className="text-sm list-disc list-inside">
        {Object.entries(data.methods).map(([k, v]) => (
          <li key={k}>
            {k}: {v.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
};

const CardsTable: React.FC<{ data: CardsSummary }> = ({ data }) => {
  if (!data.cards.length) return null;

  return (
    <div className="mt-8">
      <h4 className="font-semibold text-md mb-3">Carte</h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 border text-left">PAN</th>
              <th className="p-2 border text-left">BIN</th>
              <th className="p-2 border text-left">Holder</th>
              <th className="p-2 border text-left">Tipo</th>
              <th className="p-2 border text-left">Prodotto</th>
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
            {data.cards.map(c => (
              <tr key={c.pan} className="hover:bg-muted/50">
                <td className="p-2 border">{c.pan}</td>
                <td className="p-2 border">{c.bin}</td>
                <td className="p-2 border">{c.name}</td>
                <td className="p-2 border">{c.type}</td>
                <td className="p-2 border">{c.prod}</td>
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
              <th colSpan={7} className="p-2 border text-right">
                Totale € Approved
              </th>
              <th className="p-2 border text-right">
                {data.summary.app.toFixed(2)}
              </th>
              <th colSpan={4}></th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

/* --------------------- MAIN COMPONENT --------------------- */
const TransactionsTab: React.FC = () => {
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const analyze = useCallback(async () => {
    if (!depositFile || !withdrawFile || !cardFile) {
      toast.error('Caricare tutti e tre i file');
      return;
    }
    try {
      const deposit = await parseMovements(depositFile, 'deposit');
      const withdraw = await parseMovements(withdrawFile, 'withdraw');
      const cards = await parseCards(cardFile, deposit.totAll);
      setResult({ deposit, withdraw, cards });
      toast.success('Analisi completata');
    } catch (e) {
      console.error(e);
      toast.error('Errore durante l\'analisi');
    }
  }, [depositFile, withdrawFile, cardFile]);

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Analisi Transazioni</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">File Carte</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setCardFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">File Depositi</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setDepositFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">File Prelievi</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setWithdrawFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <Button
        onClick={analyze}
        disabled={!depositFile || !withdrawFile || !cardFile}
      >
        Analizza
      </Button>

      {result?.deposit && (
        <MovementsTable title="Depositi" data={result.deposit} />
      )}
      {result?.withdraw && (
        <MovementsTable title="Prelievi" data={result.withdraw} />
      )}
      {result?.cards && <CardsTable data={result.cards} />}
    </Card>
  );
};

export default TransactionsTab;
