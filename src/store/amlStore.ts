import { create } from 'zustand';

export type TransactionResults = any;
export type AccessResult = any;

export interface IndicatorNetFlow { month: string; deposits: number; withdrawals: number; }
export interface IndicatorHour { hour: number; count: number; }
export interface IndicatorMethod { method: string; pct: number; }

export interface AdvancedAnalysis {
  risk_score: number;
  summary: string;
  risk_factors?: string[];
  compliance_notes?: string;
  indicators?: {
    net_flow_by_month?: IndicatorNetFlow[];
    hourly_histogram?: IndicatorHour[];
    method_breakdown?: IndicatorMethod[];
  };
}

interface AmlState {
  transactionResults: TransactionResults | null;
  accessResults: AccessResult[];
  grafici: any[];
  sessioniNotturne: any[];
  advancedAnalysis: AdvancedAnalysis | null;
  accountId: string | null;
  syncState: 'idle' | 'loading' | 'success' | 'error';

  setTransactionResults: (r: TransactionResults | null) => void;
  setAccessResults: (r: AccessResult[]) => void;
  setGrafici: (g: any[]) => void;
  setSessioniNotturne: (s: any[]) => void;
  setAdvancedAnalysis: (r: AdvancedAnalysis | null) => void;
  setSyncData: (transactions: any[], accessResults: AccessResult[], accountId: string) => void;
  setSyncState: (state: 'idle' | 'loading' | 'success' | 'error') => void;

  clear: () => void;
}

export const useAmlStore = create<AmlState>((set) => ({
  transactionResults: null,
  accessResults: [],
  grafici: [],
  sessioniNotturne: [],
  advancedAnalysis: null,
  accountId: null,
  syncState: 'idle',

  setTransactionResults: (r) => set({ transactionResults: r }),
  setAccessResults: (r) => set({ accessResults: r }),
  setGrafici: (g) => set({ grafici: g }),
  setSessioniNotturne: (s) => set({ sessioniNotturne: s }),
  setAdvancedAnalysis: (r) => set({ advancedAnalysis: r }),
  setSyncState: (state) => set({ syncState: state }),
  setSyncData: (transactions, accessResults, accountId) => {
    // Converti transactions in formato compatibile con transactionResults
    // Le transactions vengono salvate come array per essere processate da runAnalysis
    set({ 
      accessResults,
      accountId,
      syncState: 'success'
    });
    // Le transactions verranno processate dalla pagina dettagli
  },

  clear: () => set({
    transactionResults: null,
    accessResults: [],
    grafici: [],
    sessioniNotturne: [],
    advancedAnalysis: null,
    accountId: null,
    syncState: 'idle',
  }),
}));

export default useAmlStore;