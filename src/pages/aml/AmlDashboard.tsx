
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { getCurrentSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { MovementsTable } from '@/components/aml/MovementsTable'
import { CardsTable } from '@/components/aml/CardsTable'
import { useAmlStore } from '@/store/amlStore'

/* ---------------------------------------------------------------------------
 * AmlDashboard.tsx — Refactored 31 Jul 2025
 * ---------------------------------------------------------------------------
 *  • Eliminated DOM‑injection legacy code.
 *  • Re‑implemented Excel parsing as pure utility functions that return JSON.
 *  • Added processCardData (ex‑buildCardTable) that produces structured data.
 *  • React component now follows the canonical → File ➔ Parser ➔ Store ➔ UI flow.
 * -------------------------------------------------------------------------*/

/* ------------------------------------------------------------------ *
 *                    ─── Utility helpers (pure) ───                  *
 * ------------------------------------------------------------------ */

const sanitize = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')

const findHeaderRow = (rows: any[][], key: string) =>
  rows.findIndex(r => Array.isArray(r) && r.some(c => sanitize(c).includes(key)))

const findCol = (hdr: any[], aliases: string[]) => {
  const sHdr = hdr.map(sanitize)
  for (const a of aliases) {
    const i = sHdr.findIndex(h => h === sanitize(a))
    if (i !== -1) return i
  }
  return -1
}

const parseNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

const excelToDate = (cell: unknown): Date | null => {
  if (cell == null) return null
  if (typeof cell === 'number') {
    // Excel serial
    const epoch = XLSX.SSF.parse_date_code(cell)
    if (epoch) return new Date(epoch.y, epoch.m - 1, epoch.d)
  }
  const maybe = new Date(cell as any)
  return isNaN(+maybe) ? null : maybe
}

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/* ----------------------------- Excel I/O ----------------------------- */

const readExcel = (file: File): Promise<any[][]> =>
  new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const rows: any[][] = XLSX.utils.sheet_to_json(
          wb.Sheets[wb.SheetNames[0]],
          { header: 1 }
        )
        res(rows)
      } catch (err) {
        rej(err)
      }
    }
    reader.onerror = rej
    reader.readAsArrayBuffer(file)
  })

/* ------------------------------------------------------------------ *
 *                       ─── Business parsers ───                     *
 * ------------------------------------------------------------------ */

export interface MovementsData {
  totAll: number
  months: string[]
  all: Record<string, number>
  perMonth: Record<string, Record<string, number>>
  frazionate?: Frazionata[]
}

export interface Frazionata {
  start: string
  end: string
  total: number
  transactions: Array<{ date: string; amount: number; causale: string }>
}

export async function parseMovements(
  file: File,
  mode: 'deposit' | 'withdraw'
): Promise<MovementsData> {
  const RE = mode === 'deposit' ? /^(deposito|ricarica)/i : /^prelievo/i
  const rows = await readExcel(file)

  const hIdx = findHeaderRow(rows, 'importo')
  const hdr = hIdx !== -1 ? rows[hIdx] : []
  const data = hIdx !== -1 ? rows.slice(hIdx + 1) : rows

  const cDate = hIdx !== -1 ? findCol(hdr, ['data', 'date']) : 0
  const cDesc = hIdx !== -1 ? findCol(hdr, ['descr', 'description']) : 1
  const cAmt = hIdx !== -1 ? findCol(hdr, ['importo', 'amount']) : 2

  const all: Record<string, number> = {}
  const perMonth: Record<string, Record<string, number>> = {}

  let totAll = 0

  data.forEach(r => {
    if (!Array.isArray(r)) return
    const desc = String(r[cDesc] ?? '').trim()
    if (!RE.test(desc)) return

    const method =
      mode === 'deposit' && desc.toLowerCase().startsWith('ricarica')
        ? 'Cash'
        : desc.replace(RE, '').trim() || 'Sconosciuto'

    const amt = parseNum(r[cAmt])
    if (!amt) return
    all[method] = (all[method] || 0) + amt
    totAll += amt

    const dt = excelToDate(r[cDate])
    if (!dt) return
    const k = monthKey(dt)
    perMonth[method] ??= {}
    perMonth[method][k] = (perMonth[method][k] || 0) + amt
  })

  const monthsSet = new Set<string>()
  Object.values(perMonth).forEach(obj =>
    Object.keys(obj).forEach(k => monthsSet.add(k))
  )
  const today = new Date()
  const months = Array.from(monthsSet)
    .sort()
    .reverse()
    .filter(k => {
      const [y, m] = k.split('-').map(n => parseInt(n, 10))
      return y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth() + 1)
    })

  return { totAll, months, all, perMonth }
}

/* --------------------------- Cards parsing --------------------------- */

export interface ProcessedCard {
  bin: string
  pan: string
  name: string
  type: string
  prod: string
  ctry: string
  bank: string
  app: number
  dec: number
  nDec: number
  reasons: string[]
}

export interface CardDataProcessed {
  processedCards: ProcessedCard[]
  summary: { app: number; dec: number }
  months: string[]
}

/**
 * Equivalent refactor of the legacy buildCardTable(). It now returns pure data.
 */
export function processCardData(
  rows: any[][],
  depositTotal: number,
  filterMonth = ''
): CardDataProcessed {
  const hIdx = findHeaderRow(rows, 'amount')
  if (hIdx === -1) return { processedCards: [], summary: { app: 0, dec: 0 }, months: [] }

  const hdr = rows[hIdx]
  const data = rows.slice(hIdx + 1).filter(r => Array.isArray(r) && r.some(c => c))

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
    reason: findCol(hdr, ['reason'])
  }

  const cards: Record<string, ProcessedCard & { reasonsSet: Set<string> }> = {}
  const summary = { app: 0, dec: 0 }
  const monthsSet = new Set<string>()

  data.forEach(r => {
    const txType = String(r[ix.ttype] ?? '').toLowerCase()
    if (!txType.includes('sale')) return

    /* ------ Filter by month (optional) -------------------------------- */
    let dt: Date | null = null
    if (ix.date !== -1) {
      dt = excelToDate(r[ix.date])
      if (dt && !isNaN(dt as any)) {
        const mk = monthKey(dt)
        monthsSet.add(mk)
        if (filterMonth && mk !== filterMonth) return
      } else if (filterMonth) {
        return
      }
    } else if (filterMonth) return

    const pan = r[ix.pan] || 'UNKNOWN'
    cards[pan] ??= {
      bin: ix.bin !== -1 ? r[ix.bin] || String(pan).slice(0, 6) : '',
      pan,
      name: ix.name !== -1 ? r[ix.name] || '' : '',
      type: ix.type !== -1 ? r[ix.type] || '' : '',
      prod: ix.prod !== -1 ? r[ix.prod] || '' : '',
      ctry: ix.ctry !== -1 ? r[ix.ctry] || '' : '',
      bank: ix.bank !== -1 ? r[ix.bank] || '' : '',
      app: 0,
      dec: 0,
      nDec: 0,
      reasonsSet: new Set<string>(),
      reasons: []
    }

    const amt = parseNum(r[ix.amt])
    const resVal = ix.res !== -1 ? String(r[ix.res] || '') : 'approved'
    if (/^approved$/i.test(resVal)) {
      cards[pan].app += amt
      summary.app += amt
    } else {
      cards[pan].dec += amt
      summary.dec += amt
      cards[pan].nDec += 1
      if (ix.reason !== -1 && r[ix.reason]) cards[pan].reasonsSet.add(r[ix.reason])
    }
  })

  /* Finalise reason codes lists and convert to array */
  Object.values(cards).forEach(c => {
    c.reasons = Array.from(c.reasonsSet)
    delete (c as any).reasonsSet
  })

  const months = Array.from(monthsSet).sort().reverse()
  return { processedCards: Object.values(cards), summary, months }
}

/* ------------------------------------------------------------------ *
 *                       ─── Dashboard Component ───                  *
 * ------------------------------------------------------------------ */

export const AmlDashboard: React.FC = () => {
  const navigate = useNavigate()

  /* --------------------------- Local state -------------------------- */
  const [depositFile, setDepositFile] = useState<File | null>(null)
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null)
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [includeCard, setIncludeCard] = useState<boolean>(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  /* --------------------------- Global store ------------------------- */
  const transactionResults = useAmlStore(s => s.transactionResults)
  const setTransactionResults = useAmlStore(s => s.setTransactionResults)

  /* --------------------- Auth & initial checks ---------------------- */
  useEffect(() => {
    ;(async () => {
      const session = await getCurrentSession()
      if (!session) {
        navigate('/auth/login')
      }
    })()
  }, [navigate])

  /* --------------------- Main ANALYZE handler ----------------------- */
  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true)

      const results: any = { includeCard }
      if (depositFile) {
        results.depositData = await parseMovements(depositFile, 'deposit')
      }
      if (withdrawFile) {
        results.withdrawData = await parseMovements(withdrawFile, 'withdraw')
      }
      if (includeCard && cardFile) {
        const cardRows = await readExcel(cardFile)
        results.cardData = processCardData(
          cardRows,
          results.depositData?.totAll ?? 0
        )
      }

      setTransactionResults(results)
      toast.success('Analisi completata!')
    } catch (err) {
      console.error(err)
      toast.error('Errore durante l‘analisi — controlla i file.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  /* ------------------------------------------------------------------ *
   *                                UI                                  *
   * ------------------------------------------------------------------ */
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" className="flex gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Indietro
      </Button>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Seleziona i file Excel</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="block text-sm">Depositi</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setDepositFile(e.target.files?.[0] || null)}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-sm">Prelievi</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setWithdrawFile(e.target.files?.[0] || null)}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-sm">Transazioni carte</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={!includeCard}
              onChange={e => setCardFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeCard}
            onChange={e => setIncludeCard(e.target.checked)}
          />
          <span className="text-sm">Includi transazioni carte</span>
        </label>

        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!depositFile && !withdrawFile)}
          className="flex items-center gap-2"
        >
          <Upload size={16} />
          {isAnalyzing ? 'Analisi in corso...' : 'Esegui analisi'}
        </Button>
      </Card>

      {/* ------------------- Results section ------------------- */}
      {transactionResults && (
        <div className="space-y-6">
          {transactionResults.depositData && (
            <MovementsTable
              title="Depositi"
              data={transactionResults.depositData}
            />
          )}

          {transactionResults.withdrawData && (
            <MovementsTable
              title="Prelievi"
              data={transactionResults.withdrawData}
            />
          )}

          {transactionResults.includeCard &&
            transactionResults.cardData && (
              <CardsTable
                cards={transactionResults.cardData.processedCards}
                summary={transactionResults.cardData.summary}
                months={transactionResults.cardData.months}
                depositTotal={transactionResults.depositData?.totAll ?? 0}
              />
            )}
        </div>
      )}
    </div>
  )
}
