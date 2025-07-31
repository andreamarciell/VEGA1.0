
import { useCallback } from 'react'
import * as XLSX from 'xlsx'

export interface MovementsData {
  totAll: number
  months: string[]
  all: Record<string, number>
  perMonth: Record<string, Record<string, number>>
}

export interface TransactionResults {
  depositData?: MovementsData
  withdrawData?: MovementsData
  cardRows?: any[]
  includeCard?: boolean
}

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const parseMovements = (wb: XLSX.WorkBook): MovementsData => {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
  if (!rows.length) {
    return { totAll: 0, months: [], all: {}, perMonth: {} }
  }

  const header = rows[0].map(v =>
    String(v)
      .toLowerCase()
      .replace(/\s+/g, '')
  )

  const colDate = header.findIndex(h => ['date', 'data'].includes(h))
  const colAmount = header.findIndex(h =>
    ['amount', 'importo', 'qty', 'value'].includes(h)
  )
  const colMethod = header.findIndex(h =>
    ['method', 'metodo', 'paymentmethod', 'type'].includes(h)
  )

  const all: Record<string, number> = {}
  const perMonth: Record<string, Record<string, number>> = {}
  let totAll = 0

  rows.slice(1).forEach(r => {
    const amount =
      colAmount !== -1
        ? parseFloat(String(r[colAmount] || '').replace(',', '.'))
        : 0
    if (!amount || isNaN(amount)) return

    const method =
      colMethod !== -1
        ? String(r[colMethod] || '') || 'Altro'
        : 'Altro'

    let d: Date | null = null
    if (colDate !== -1) {
      const v = r[colDate]
      if (typeof v === 'number') {
        const dc = XLSX.SSF.parse_date_code(v as number)
        if (dc) d = new Date(dc.y, dc.m - 1, dc.d)
      } else if (v) {
        const tmp = new Date(v)
        if (!isNaN(tmp as any)) d = tmp
      }
    }

    const mk = d ? monthKey(d) : ''

    all[method] = (all[method] || 0) + amount
    perMonth[method] = perMonth[method] || {}
    if (mk) perMonth[method][mk] = (perMonth[method][mk] || 0) + amount
    totAll += amount
  })

  const monthsSet = new Set<string>()
  Object.values(perMonth).forEach(obj =>
    Object.keys(obj).forEach(m => monthsSet.add(m))
  )

  return {
    totAll,
    months: Array.from(monthsSet).sort().reverse(),
    all,
    perMonth
  }
}

const parseCards = (wb: XLSX.WorkBook): any[] => {
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[]
}

export const useParseTransactions = () => {
  const parse = useCallback(
    async (
      files: { deposit?: File | null; withdraw?: File | null; card?: File | null },
      includeCard: boolean
    ): Promise<TransactionResults | null> => {
      const result: TransactionResults = { includeCard }

      if (files.deposit) {
        const wb = XLSX.read(await files.deposit.arrayBuffer(), { type: 'array' })
        result.depositData = parseMovements(wb)
      }

      if (files.withdraw) {
        const wb = XLSX.read(await files.withdraw.arrayBuffer(), { type: 'array' })
        result.withdrawData = parseMovements(wb)
      }

      if (includeCard && files.card) {
        const wb = XLSX.read(await files.card.arrayBuffer(), { type: 'array' })
        result.cardRows = parseCards(wb)
      }

      return result
    },
    []
  )

  return { parse }
}
