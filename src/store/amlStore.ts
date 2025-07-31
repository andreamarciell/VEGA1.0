
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

interface AmlStore {
  transactionResults: TransactionResults | null
  setTransactionResults: (r: TransactionResults | null) => void
  accessResults: AccessResult[]
  setAccessResults: (r: AccessResult[]) => void
  clear: () => void
}

export const useAmlStore = create<AmlStore>(set => ({
  transactionResults: null,
  setTransactionResults: (r) => set({ transactionResults: r }),
  accessResults: [],
  setAccessResults: (r) => set({ accessResults: r }),
  clear: () => set({ transactionResults: null, accessResults: [] })
}))
