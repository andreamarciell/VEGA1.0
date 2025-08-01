
import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

interface Props {
  rows: any[]
  depositTotal: number
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(k: string) {
  const [y, m] = k.split('-')
  const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

interface CardRow {
  bin: string
  pan: string
  holder: string
  type: string
  product: string
  country: string
  bank: string
  approved: number
  declined: number
  nDeclined: number
  pctDeposit: number
  reasons: string[]
}

export const CardsTable: React.FC<Props> = ({ rows, depositTotal }) => {
  const [filterMonth, setFilterMonth] = useState<string>('')

  const { cardRows, months } = useMemo(() => {
    if (!rows || !rows.length) return { cardRows: [] as CardRow[], months: [] as string[] }

    const hdrIdx = rows.findIndex((r: any[]) =>
      Array.isArray(r) && r.some(c => String(c).toLowerCase().includes('amount'))
    )
    const hdr = hdrIdx !== -1 ? rows[hdrIdx] : []

    const idx = (nameVariants: string[]) =>
      hdr.findIndex((h: any) =>
        nameVariants.includes(String(h).toLowerCase().replace(/\s+/g, ''))
      )

    const ix = {
      date: idx(['date', 'data']),
      pan: idx(['pan']),
      bin: idx(['bin']),
      holder: idx(['holder', 'nameoncard']),
      type: idx(['cardtype']),
      product: idx(['product']),
      country: idx(['country']),
      bank: idx(['bank']),
      amt: idx(['amount']),
      result: idx(['result']),
      ttype: idx(['transactiontype', 'transtype']),
      reason: idx(['reason'])
    }

    const data = hdrIdx !== -1 ? rows.slice(hdrIdx + 1) : rows

    const cards: Record<string, CardRow> = {}
    const monthsSet = new Set<string>()

    const num = (v: any) => {
      const n = parseFloat(String(v).replace(',', '.'))
      return isNaN(n) ? 0 : n
    }

    data.forEach(r => {
      if (!Array.isArray(r)) return
      const txType = String(r[ix.ttype] || '').toLowerCase()
      if (!txType.includes('sale')) return

      let dt: any = null
      if (ix.date !== -1) {
        dt = XLSX.SSF.parse_date_code(r[ix.date])
        if (dt) {
          const jsDate = new Date((dt as any).y, (dt as any).m - 1, (dt as any).d)
          const mk = monthKey(jsDate)
          monthsSet.add(mk)
          if (filterMonth && mk !== filterMonth) return
        }
      }

      const pan = String(r[ix.pan] || '')
      if (!pan) return
      if (!cards[pan]) {
        cards[pan] = {
          bin: ix.bin !== -1 ? String(r[ix.bin] || '') : '',
          pan,
          holder: ix.holder !== -1 ? String(r[ix.holder] || '') : '',
          type: ix.type !== -1 ? String(r[ix.type] || '') : '',
          product: ix.product !== -1 ? String(r[ix.product] || '') : '',
          country: ix.country !== -1 ? String(r[ix.country] || '') : '',
          bank: ix.bank !== -1 ? String(r[ix.bank] || '') : '',
          approved: 0,
          declined: 0,
          nDeclined: 0,
          pctDeposit: 0,
          reasons: []
        }
      }

      const amt = num(r[ix.amt])
      const resVal = ix.result !== -1 ? String(r[ix.result] || '') : 'approved'
      if (/^approved$/i.test(resVal)) {
        cards[pan].approved += amt
      } else {
        cards[pan].declined += amt
        cards[pan].nDeclined += 1
        if (ix.reason !== -1 && r[ix.reason]) cards[pan].reasons.push(String(r[ix.reason]))
      }
    })

    const list = Object.values(cards).map(c => ({
      ...c,
      pctDeposit: depositTotal ? (c.approved * 100) / depositTotal : 0
    }))

    const sortedMonths = Array.from(monthsSet).sort().reverse()

    return { cardRows: list, months: sortedMonths }
  }, [rows, filterMonth, depositTotal])

  if (!cardRows.length) return null

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
          {months.map(m => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full border-collapse text-xs">
        <caption className="text-left font-semibold mb-2">
          {filterMonth ? `Carte – ${monthLabel(filterMonth)}` : 'Carte – Totale'}
        </caption>
        <thead>
          <tr className="bg-muted">
            <th className="border p-1">BIN</th>
            <th className="border p-1">PAN</th>
            <th className="border p-1">Holder</th>
            <th className="border p-1">Type</th>
            <th className="border p-1">Prod</th>
            <th className="border p-1">Country</th>
            <th className="border p-1">Bank</th>
            <th className="border p-1 text-right">Approved €</th>
            <th className="border p-1 text-right">Declined €</th>
            <th className="border p-1 text-right">#Declined</th>
            <th className="border p-1 text-right">% Depositi</th>
            <th className="border p-1">Reason Codes</th>
          </tr>
        </thead>
        <tbody>
          {cardRows.map(r => (
            <tr key={r.pan} className="hover:bg-muted/50">
              <td className="border p-1">{r.bin}</td>
              <td className="border p-1">{r.pan}</td>
              <td className="border p-1">{r.holder}</td>
              <td className="border p-1">{r.type}</td>
              <td className="border p-1">{r.product}</td>
              <td className="border p-1">{r.country}</td>
              <td className="border p-1">{r.bank}</td>
              <td className="border p-1 text-right">{r.approved.toFixed(2)}</td>
              <td className="border p-1 text-right">{r.declined.toFixed(2)}</td>
              <td className="border p-1 text-right">{r.nDeclined}</td>
              <td className="border p-1 text-right">{r.pctDeposit.toFixed(2)}</td>
              <td className="border p-1">{r.reasons.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
