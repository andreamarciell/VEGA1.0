
import React, { useState, useMemo } from 'react'

interface MovementsData {
  totAll: number
  months: string[]
  all: Record<string, number>
  perMonth: Record<string, Record<string, number>>

  frazionate?: Frazionata[]
}

interface Frazionata {
  start: string;
  end: string;
  total: number;
  transactions: Array<{ date: string; amount: number; causale: string }>;
}


interface Props {
  title: string
  data: MovementsData
}

function monthLabel(k: string) {
  if (!k) return ''
  const [y, m] = k.split('-')
  const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

export const MovementsTable: React.FC<Props> = ({ title, data }) => {
  const [filterMonth, setFilterMonth] = useState<string>('')

  const { rowsObj, total } = useMemo(() => {
    if (!data) return { rowsObj: {}, total: 0 }
    if (!filterMonth) {
      return { rowsObj: data.all, total: data.totAll }
    }
    const rows: Record<string, number> = {}
    let tot = 0
    Object.entries(data.perMonth).forEach(([method, months]) => {
      const v = months[filterMonth]
      if (v) {
        rows[method] = v
        tot += v
      }
    })
    return { rowsObj: rows, total: tot }
  }, [data, filterMonth])

  if (!data || !data.totAll) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm">Filtro mese:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          <option value="">Totale</option>
          {data.months.map(m => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="text-left font-semibold mb-2">
          {filterMonth ? `${title} – ${monthLabel(filterMonth)}` : `${title} – Totale`}
        </caption>
        <thead>
          <tr className="bg-muted">
            <th className="border p-2 text-left">Metodo</th>
            <th className="border p-2 text-right">Importo €</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rowsObj).map(([method, val]) => (
            <tr key={method} className="hover:bg-muted/50">
              <td className="border p-2">{method}</td>
              <td className="border p-2 text-right">{val.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className="border p-2 text-right">Totale €</th>
            <th className="border p-2 text-right">{total.toFixed(2)}</th>
          </tr>
        </tfoot>
      </table>

{data.frazionate && data.frazionate.length > 0 && (
  <div className="mt-4">
    <h4 className="font-semibold mb-2">Prelievi frazionati (&gt; € 4.999 in 7 giorni)</h4>
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-muted">
          <th className="border p-1">Periodo</th>
          <th className="border p-1 text-right">Totale €</th>
          <th className="border p-1 text-right"># Mov</th>
        </tr>
      </thead>
      <tbody>
        {data.frazionate.map((f, idx) => (
          <tr key={idx} className="hover:bg-muted/50">
            <td className="border p-1">{f.start} – {f.end}</td>
            <td className="border p-1 text-right">{f.total.toFixed(2)}</td>
            <td className="border p-1 text-right">{f.transactions.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

    </div>
  )
}
