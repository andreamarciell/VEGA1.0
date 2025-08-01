
import React, { useEffect, useMemo, useState } from 'react';

interface CardEntry {
  bin: string;
  pan: string;
  name: string;
  type: string;
  prod: string;
  ctry: string;
  issuerbank: string;
  app: number;
  dec: number;
  nDec: number;
  perc: number;
  reasons: string;
  transactions: { date: Date | null; amount: number; result: string }[];
}

interface CardData {
  cards: CardEntry[];
  summary: { app: number; dec: number };
  months: string[];
}

interface CardsTableProps {
  data: CardData;
}

export const CardsTable: React.FC<CardsTableProps> = ({ data }) => {
  // '' = totale
  const [filterMonth, setFilterMonth] = useState<string>('');

  /* -------------------------------------------------------------
     Inject legacy styles if not already present
     ------------------------------------------------------------- */
  useEffect(() => {
    if (document.getElementById('transactions-table-style')) return;
    const style = document.createElement('style');
    style.id = 'transactions-table-style';
    style.textContent = `
      .transactions-table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:.35rem}
      .transactions-table caption{caption-side:top;font-weight:600;padding-bottom:.25rem;text-align:left}
      .transactions-table thead{background:#21262d}
      .transactions-table th,.transactions-table td{padding:.45rem .6rem;border-bottom:1px solid #30363d;text-align:left}
      .transactions-table tbody tr:nth-child(even){background:#1b1f24}
      .transactions-table tfoot th{background:#1b1f24}`;
    document.head.appendChild(style);
  }, []);

  /* -------------------------------------------------------------
     Helpers
     ------------------------------------------------------------- */
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const date = new Date(y, m - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  /* -------------------------------------------------------------
     Filtering
     ------------------------------------------------------------- */
  const filteredCards = useMemo(() => {
    if (!filterMonth) return data.cards;
    return data.cards.filter((c) =>
      c.transactions.some((tx) => tx.date && monthKey(new Date(tx.date)) === filterMonth),
    );
  }, [data.cards, filterMonth]);

  /* -------------------------------------------------------------
     Summary row
     ------------------------------------------------------------- */
  const summary = useMemo(() => {
    return filteredCards.reduce(
      (acc, c) => {
        acc.app += c.app;
        acc.dec += c.dec;
        return acc;
      },
      { app: 0, dec: 0 },
    );
  }, [filteredCards]);

  /* -------------------------------------------------------------
     Render
     ------------------------------------------------------------- */
  const caption = filterMonth ? `Carte – ${monthLabel(filterMonth)}` : 'Carte – Totale';

  return (
    <div className="space-y-2">
      {/* ---- MONTH FILTER ---- */}
      <div className="flex items-center gap-2">
        <label htmlFor="card-month-filter" className="text-sm font-medium">
          Mese
        </label>
        <select
          id="card-month-filter"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-background dark:bg-gray-800"
        >
          <option value="">Totale</option>
          {data.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* ---- TABLE ---- */}
      <table className="transactions-table">
        <caption>{caption}</caption>
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>BIN</th>
            <th>PAN</th>
            <th>Holder</th>
            <th>Type</th>
            <th>Product</th>
            <th>Country</th>
            <th>Bank</th>
            <th>Approved €</th>
            <th>Declined €</th>
            <th>#Declined</th>
            <th>% Depositi</th>
            <th>Reason Codes</th>
          </tr>
        </thead>
        <tbody>
          {filteredCards.map((c) => (
            <tr key={c.pan}>
              <td>{c.bin}</td>
              <td>{c.pan}</td>
              <td>{c.name}</td>
              <td>{c.type}</td>
              <td>{c.prod}</td>
              <td>{c.ctry}</td>
              <td>{c.issuerbank}</td>
              <td style={{ textAlign: 'right' }}>{c.app.toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>{c.dec.toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>{c.nDec}</td>
              <td style={{ textAlign: 'right' }}>
                {c.perc ? `${c.perc.toFixed(2)}%` : '—'}
              </td>
              <td>{c.reasons}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={7} style={{ textAlign: 'right' }}>
              TOTAL:
            </th>
            <th style={{ textAlign: 'right' }}>{summary.app.toFixed(2)}</th>
            <th style={{ textAlign: 'right' }}>{summary.dec.toFixed(2)}</th>
            <th />
            <th />
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
