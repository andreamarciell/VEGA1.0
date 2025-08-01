import React, { useEffect, useMemo, useState } from 'react';

interface CardEntry {
  bin: string;
  pan: string;
  name: string;
  type: string;
  prod: string;
  ctry: string;
  bank: string; // CORRETTO: da 'issuerbank' a 'bank' per corrispondere alla fonte dati
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

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  const filteredData = useMemo(() => {
    if (!filterMonth) {
        return {
            cards: data.cards,
            summary: data.summary,
        };
    }

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const newCards: CardEntry[] = [];
    const newSummary = { app: 0, dec: 0 };

    data.cards.forEach(card => {
        const transactionsInMonth = card.transactions.filter(tx => 
            tx.date && !isNaN(new Date(tx.date).getTime()) && monthKey(new Date(tx.date)) === filterMonth
        );

        if (transactionsInMonth.length > 0) {
            const cardInMonth: CardEntry = { ...card, transactions: transactionsInMonth, app: 0, dec: 0, nDec: 0 };
            
            transactionsInMonth.forEach(tx => {
                if (/^approved$/i.test(tx.result)) {
                    cardInMonth.app += tx.amount;
                } else {
                    cardInMonth.dec += tx.amount;
                    cardInMonth.nDec += 1;
                }
            });

            newSummary.app += cardInMonth.app;
            newSummary.dec += cardInMonth.dec;
            newCards.push(cardInMonth);
        }
    });
    
    return { cards: newCards, summary: newSummary };

  }, [data, filterMonth]);

  const caption = filterMonth ? `Carte – ${monthLabel(filterMonth)}` : 'Carte – Totale';

  return (
    <div className="space-y-2 mt-6">
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
          {filteredData.cards.map((c) => (
            <tr key={c.pan}>
              <td>{c.bin}</td>
              <td>{c.pan}</td>
              <td>{c.name}</td>
              <td>{c.type}</td>
              <td>{c.prod}</td>
              <td>{c.ctry}</td>
              <td>{c.bank}</td>
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
            <th style={{ textAlign: 'right' }}>{filteredData.summary.app.toFixed(2)}</th>
            <th style={{ textAlign: 'right' }}>{filteredData.summary.dec.toFixed(2)}</th>
            <th colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
