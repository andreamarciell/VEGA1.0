
import { useCallback } from 'react'
import * as XLSX from 'xlsx'

export interface AccessResult {
  ip: string
  country: string
  isp: string
  nSessions: number
}

export const useParseAccess = () => {
  const parse = useCallback(async (file: File): Promise<AccessResult[]> => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

    if (!rows.length) return []

    const header = rows[0].map(v =>
      String(v)
        .toLowerCase()
        .replace(/\s+/g, '')
    )

    const colIP = header.findIndex(h =>
      ['ip', 'ipaddress', 'indirizzoip'].includes(h)
    )
    const colCountry = header.findIndex(h =>
      ['country', 'paese', 'nazione'].includes(h)
    )
    const colISP = header.findIndex(h => ['isp', 'provider'].includes(h))

    const map: Record<string, AccessResult> = {}

    rows.slice(1).forEach(r => {
      const ip = colIP !== -1 ? String(r[colIP] || '') : ''
      if (!ip) return
      const country = colCountry !== -1 ? String(r[colCountry] || '') : ''
      const isp = colISP !== -1 ? String(r[colISP] || '') : ''

      if (!map[ip]) {
        map[ip] = { ip, country, isp, nSessions: 0 }
      }
      map[ip].nSessions += 1
    })

    return Object.values(map).sort((a, b) => b.nSessions - a.nSessions)
  }, [])

  return { parse }
}
