
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Upload, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAmlStore } from '@/store/amlStore'
import { MovementsTable } from '@/components/aml/MovementsTable'
import { CardsTable } from '@/components/aml/CardsTable'
import { AccessTable } from '@/components/aml/AccessTable'
import { useParseTransactions } from '@/hooks/useParseTransactions'
import { useParseAccess } from '@/hooks/useParseAccess'

const AmlDashboard: React.FC = () => {
  const navigate = useNavigate()

  const transactionResults = useAmlStore(s => s.transactionResults)
  const setTransactionResults = useAmlStore(s => s.setTransactionResults)

  const accessResults = useAmlStore(s => s.accessResults)
  const setAccessResults = useAmlStore(s => s.setAccessResults)

  const clearStore = useAmlStore(s => s.clear)

  const [depositFile, setDepositFile] = useState<File | null>(null)
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null)
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [includeCard, setIncludeCard] = useState<boolean>(true)
  const [accessFile, setAccessFile] = useState<File | null>(null)

  const { parse: parseTransactions } = useParseTransactions()
  const { parse: parseAccess } = useParseAccess()

  const handleAnalyzeTransactions = async () => {
    if (!depositFile && !withdrawFile) {
      toast.error('Carica almeno il file di Depositi o Prelievi')
      return
    }
    try {
      const res = await parseTransactions(
        { deposit: depositFile, withdraw: withdrawFile, card: cardFile },
        includeCard
      )
      setTransactionResults(res)
    } catch (err) {
      toast.error('Errore durante il parsing delle transazioni')
      console.error(err)
    }
  }

  const handleAnalyzeAccess = async () => {
    if (!accessFile) {
      toast.error('Carica un file Accessi')
      return
    }
    try {
      const res = await parseAccess(accessFile)
      setAccessResults(res)
    } catch (err) {
      toast.error('Errore durante il parsing accessi')
      console.error(err)
    }
  }

  const handleNewAnalysis = () => {
    clearStore()
    setDepositFile(null)
    setWithdrawFile(null)
    setCardFile(null)
    setAccessFile(null)
  }

  return (
    <div className="p-6 space-y-10">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Indietro
      </Button>

      {/* Transazioni */}
      <Card className="p-6 space-y-6">
        <h2 className="font-semibold text-lg">Analisi Transazioni</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Depositi (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setDepositFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prelievi (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={e => setWithdrawFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeCard"
              checked={includeCard}
              onChange={e => setIncludeCard(e.target.checked)}
            />
            <label htmlFor="includeCard" className="text-sm">
              Includi Transazioni Carte
            </label>
          </div>
          {includeCard && (
            <div>
              <label className="block text-sm font-medium mb-1">Carte (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setCardFile(e.target.files?.[0] || null)}
              />
            </div>
          )}
        </div>

        <Button className="flex items-center gap-2" onClick={handleAnalyzeTransactions}>
          <Upload size={16} />
          Analizza
        </Button>

        {transactionResults?.depositData && (
          <MovementsTable title="Depositi" data={transactionResults.depositData} />
        )}
        {transactionResults?.withdrawData && (
          <MovementsTable title="Prelievi" data={transactionResults.withdrawData} />
        )}
        {includeCard &&
          transactionResults?.cardRows &&
          transactionResults?.depositData && (
            <CardsTable
              rows={transactionResults.cardRows}
              depositTotal={transactionResults.depositData.totAll}
            />
          )}
      </Card>

      {/* Accessi */}
      <Card className="p-6 space-y-6">
        <h2 className="font-semibold text-lg">Analisi Accessi</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Accessi (.xlsx / .csv)</label>
          <input
            type="file"
            accept=".xlsx,.csv,.xls"
            onChange={e => setAccessFile(e.target.files?.[0] || null)}
          />
        </div>

        <Button className="flex items-center gap-2" onClick={handleAnalyzeAccess}>
          <Upload size={16} />
          Analizza Accessi
        </Button>

        <AccessTable rows={accessResults} />
      </Card>

      <Button
        variant="secondary"
        className="flex items-center gap-2"
        onClick={handleNewAnalysis}
      >
        <RotateCw size={16} />
        Nuova Analisi
      </Button>
    </div>
  )
}

export default AmlDashboard
