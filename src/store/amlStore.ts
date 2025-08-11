import { create } from 'zustand';

export type TransactionResults = any;
export type AccessResult = any;

export interface IndicatorNetFlow { month: string; deposits: number; withdrawals: number; }
export interface IndicatorHour { hour: number; count: number; }
export interface IndicatorMethod { method: string; pct: number; }

export interface AdvancedAnalysis {
  risk_score: number;
  summary: string;
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

  setTransactionResults: (r: TransactionResults | null) => void;
  setAccessResults: (r: AccessResult[]) => void;
  setGrafici: (g: any[]) => void;
  setSessioniNotturne: (s: any[]) => void;
  setAdvancedAnalysis: (r: AdvancedAnalysis | null) => void;

  clear: () => void;
}

export const useAmlStore = create<AmlState>((set) => ({
  transactionResults: null,
  accessResults: [],
  grafici: [],
  sessioniNotturne: [],
  advancedAnalysis: null,

  setTransactionResults: (r) => set({ transactionResults: r }),
  setAccessResults: (r) => set({ accessResults: r }),
  setGrafici: (g) => set({ grafici: g }),
  setSessioniNotturne: (s) => set({ sessioniNotturne: s }),
  setAdvancedAnalysis: (r) => set({ advancedAnalysis: r }),

  clear: () => set({
    transactionResults: null,
    accessResults: [],
    grafici: [],
    sessioniNotturne: [],
    advancedAnalysis: null,
  }),
}));

export default useAmlStore;