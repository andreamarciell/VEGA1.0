
import { create } from 'zustand'

interface MovementsData {
  totAll: number
  months: string[]
  all: Record<string, number>
  perMonth: Record<string, Record<string, number>>
  frazionate?: any
}

export interface TransactionResults {
  depositData?: MovementsData
  withdrawData?: MovementsData
  cardData?: any[]
  includeCard?: boolean
  hasDeposits?: boolean
  hasWithdraws?: boolean
  hasCards?: boolean
  timestamp?: number
}

export interface AccessResult {
  ip: string
  paese: string
  isp: string
}

interface Grafico {
  month: string
  depositi: number
  prelievi: number
}

interface SessioneNotturna {
  ip: string
  country: string
  isp: string
  nSessions: number
}


interface AmlStore {
  transactionResults: TransactionResults | null
  setTransactionResults: (r: TransactionResults | null) => void
  accessResults: AccessResult[]
  setAccessResults: (r: AccessResult[]) => void
  grafici: Grafico[]
  setGrafici: (g: Grafico[]) => void
  sessioniNotturne: SessioneNotturna[]
  setSessioniNotturne: (s: SessioneNotturna[]) => void
  clear: () => void
}

export const useAmlStore = create<AmlStore>(set => ({
  transactionResults: null,
  setTransactionResults: (r) => set({ transactionResults: r }),
  accessResults: [],
  setAccessResults: (r) => set({ accessResults: r }),
  clear: () => set({ transactionResults: null, accessResults: [], grafici: [], sessioniNotturne: [] })
  grafici: [],
  setGrafici: (g) => set({ grafici: g }),
  sessioniNotturne: [],
  setSessioniNotturne: (s) => set({ sessioniNotturne: s }),
}))