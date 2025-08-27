import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { create } from 'zustand';

/* ----------------------------------------------------------------------
 *  PaymentsTab – Analisi dei pagamenti da file Excel
 *  Permette di caricare file Excel di pagamenti e analizzare
 *  i metodi di pagamento e gli importi prelevati.
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

interface PaymentSummary {
  totAll: number;
  months: string[]; // "YYYY-MM"
  methods: Record<string, number>;
  perMonth: Record<string, MonthMap>;
  statusCounts: Record<string, number>;
  totalTransactions: number;
  details: Record<string, string[]>; // Store details for each method
}

interface PaymentRow {
  requestDate: Date;
  processingDate: Date;
  method: string;
  detail: string;
  netAmount: number;
  totalAmount: number;
  status: string;
  month: string;
}

interface AnalysisResult {
  payments: PaymentSummary | null;
}

/* ----------------------------------------------------------------------
 *  Store Zustand
 * ------------------------------------------------------------------- */
interface StoreState {
  result: AnalysisResult | null;
  setResult: (r: AnalysisResult | null) => void;
  reset: () => void;
}

export const usePaymentsStore = create<StoreState>(set => ({
  result: null,
  setResult: (result) => set({ result }),
  reset: () => set({ result: null }),
}));

/* ----------------------------------------------------------------------
 *  Payment Parsing
 * ------------------------------------------------------------------- */
const parsePayments = async (file: File): Promise<PaymentSummary> => {
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

  // Look for common payment headers
  const hIdx = findHeaderRow('totale') || findHeaderRow('netto') || findHeaderRow('importo');
  const hdr = hIdx !== -1 ? rows[hIdx] : [];
  const data = hIdx !== -1 ? rows.slice(hIdx + 1) : rows;

  // Find columns based on the screenshot structure
  const cRequestDate = findCol(hdr, ['data richiesta', 'data', 'date']);
  const cProcessingDate = findCol(hdr, ['data evasione', 'processing date']);
  const cMethod = findCol(hdr, ['modalità prelievo', 'metodo', 'method']);
  const cDetail = findCol(hdr, ['dettaglio', 'detail']);
  const cNet = findCol(hdr, ['netto', 'net']);
  const cTotal = findCol(hdr, ['totale', 'total']);
  const cStatus = findCol(hdr, ['stato', 'status']);

  const perMethod: Record<string, number> = {};
  const perMonth: Record<string, MonthMap> = {};
  const statusCounts: Record<string, number> = {};
  const details: Record<string, string[]> = {};
  let totAll = 0;
  const monthsSet = new Set<string>();
  let totalTransactions = 0;

  // Helper
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  for (const r of data) {
    if (!Array.isArray(r)) continue;

    // Parse amounts - prefer total over net
    const totalAmt = cTotal !== -1 ? parseNum(r[cTotal]) : 0;
    const netAmt = cNet !== -1 ? parseNum(r[cNet]) : totalAmt;
    const amt = totalAmt > 0 ? totalAmt : netAmt;
    
    if (!Number.isFinite(amt) || amt <= 0) continue;

    // Parse method
    const method = cMethod !== -1 ? String(r[cMethod] || '').trim() : 'Sconosciuto';
    if (!method) continue;

    // Parse detail
    const detail = cDetail !== -1 ? String(r[cDetail] || '').trim() : '';
    if (detail) {
      details[method] ??= [];
      details[method].push(detail);
    }

    // Parse status
    const status = cStatus !== -1 ? String(r[cStatus] || '').trim() : 'Sconosciuto';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Parse dates
    const requestDate = cRequestDate !== -1 ? excelToDate(r[cRequestDate]) : new Date();
    const processingDate = cProcessingDate !== -1 ? excelToDate(r[cProcessingDate]) : requestDate;
    
    if (isNaN(requestDate.getTime())) continue;

    const mk = monthKey(requestDate);
    monthsSet.add(mk);

    // Aggregate data
    perMethod[method] = (perMethod[method] || 0) + amt;
    totAll += amt;
    totalTransactions++;

    perMonth[method] ??= {};
    perMonth[method][mk] = (perMonth[method][mk] || 0) + amt;
  }

  const months = Array.from(monthsSet).sort().reverse();

  return { totAll, months, methods: perMethod, perMonth, statusCounts, totalTransactions, details };
};

/* ----------------------------------------------------------------------
 *  Payment Methods Table Component
 * ------------------------------------------------------------------- */
interface PaymentMethodsTableProps {
  data: PaymentSummary;
}

const PaymentMethodsTable: React.FC<PaymentMethodsTableProps> = ({ data }) => {
  const [month, setMonth] = useState<string>('');

  const filteredMethods = useMemo(() => {
    if (!month) return Object.entries(data.methods).map(([k, v]) => [k, v]);
    const filtered: [string, number][] = [];
    Object.entries(data.perMonth).forEach(([method, map]) => {
      const v = map[month];
      if (v) filtered.push([method, v]);
    });
    return filtered;
  }, [month, data]);

  const total = useMemo(() => filteredMethods.reduce((s, [, v]) => s + Number(v), 0), [filteredMethods]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  if (!data.totAll) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3">
        <h4 className="font-semibold text-md flex-1">Metodi di Pagamento</h4>
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
              <th className="p-2 border text-left">Metodo</th>
              <th className="p-2 border text-left">Dettaglio</th>
              <th className="p-2 border text-right">Importo €</th>
              <th className="p-2 border text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {filteredMethods.map(([method, amount]) => (
              <tr key={method} className="hover:bg-muted/50">
                <td className="p-2 border">{method}</td>
                <td className="p-2 border">
                  {data.details[method] && data.details[method].length > 0 ? (
                    <div className="max-h-32 overflow-y-auto">
                      {data.details[method].slice(0, 5).map((detail, index) => (
                        <div key={index} className="text-xs text-muted-foreground mb-1">
                          {detail}
                        </div>
                      ))}
                      {data.details[method].length > 5 && (
                        <div className="text-xs text-muted-foreground italic">
                          ... e altri {data.details[method].length - 5} dettagli
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Nessun dettaglio</span>
                  )}
                </td>
                <td className="p-2 border text-right">{amount.toFixed(2)}</td>
                <td className="p-2 border text-right">{((amount / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="p-2 border text-right" colSpan={2}>Totale €</th>
              <th className="p-2 border text-right">{total.toFixed(2)}</th>
              <th className="p-2 border text-right">100%</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};



/* ----------------------------------------------------------------------
 *  Component principale PaymentsTab
 * ------------------------------------------------------------------- */
const PaymentsTab: React.FC = () => {
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { result, setResult, reset } = usePaymentsStore();

  const analyzeDisabled = !paymentFile;

  const handleAnalyze = useCallback(async () => {
    if (!paymentFile) return;

    setLoading(true);
    try {
      const payments = await parsePayments(paymentFile);
      setResult({ payments });
      toast.success('Analisi pagamenti completata');
    } catch (error) {
      console.error('Errore analisi pagamenti:', error);
      toast.error('Errore durante l\'analisi del file');
    } finally {
      setLoading(false);
    }
  }, [paymentFile, setResult]);

  const handleReset = useCallback(() => {
    setPaymentFile(null);
    reset();
  }, [reset]);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Analisi Pagamenti</h3>
          <p className="text-sm text-muted-foreground">
            Carica un file Excel con i dati dei pagamenti per analizzare i metodi di pagamento e gli importi.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File Pagamenti</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setPaymentFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-muted-foreground hover:file:bg-muted/90"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleAnalyze} disabled={analyzeDisabled || loading}>
            {loading ? 'Analisi in corso…' : 'Analizza'}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {result && (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Totale Pagamenti</div>
                <div className="text-2xl font-bold">€{result.payments?.totAll.toFixed(2) || '0.00'}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Transazioni</div>
                <div className="text-2xl font-bold">{result.payments?.totalTransactions || 0}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Metodi di Pagamento</div>
                <div className="text-2xl font-bold">{Object.keys(result.payments?.methods || {}).length}</div>
              </div>
            </div>

            {/* Tables */}
            {result.payments && <PaymentMethodsTable data={result.payments} />}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PaymentsTab;
