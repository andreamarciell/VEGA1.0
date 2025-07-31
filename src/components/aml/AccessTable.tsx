
import React from 'react'

interface Row {
  ip: string
  country: string
  isp: string
  nSessions: number
}

interface Props {
  rows: Row[]
}

export const AccessTable: React.FC<Props> = ({ rows }) => {
  if (!rows || !rows.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border p-2">IP</th>
            <th className="border p-2">Paese</th>
            <th className="border p-2">ISP</th>
            <th className="border p-2 text-right">Sessioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ip} className="hover:bg-muted/50">
              <td className="border p-2">{r.ip}</td>
              <td className="border p-2">{r.country}</td>
              <td className="border p-2">{r.isp}</td>
              <td className="border p-2 text-right">{r.nSessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
