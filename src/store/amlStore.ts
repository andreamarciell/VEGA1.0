
import create from 'zustand';

/**
 * TYPES
 * ----------------------------------------------------------------------------
 * In un contesto reale importere‑sti i tipi TransactionResults e AccessResult
 * dai loro moduli ufficiali.  Per rendere questo file autosufficiente li
 * dichiariamo con alias `any`, in attesa di collegarli ai tipi “veri”.
 */

export type TransactionResults = any;
export type AccessResult = any;


export interface AdvancedAnalysis {
  risk_score: number;
  flags: { code: string; severity: 'low'|'medium'|'high'; reason: string }[];
  indicators: {
    net_flow_by_month: { month: string; deposits: number; withdrawals: number }[];
    hourly_histogram: { hour: number; count: number }[];
    method_breakdown: { method: string; pct: number }[];
    velocity?: { avg_txs_per_hour?: number; spikes?: { ts: string; z: number }[] };
  };
  recommendations: string[];
}
export interface Grafico {
  month: string;
  depositi: number;
  prelievi: number;
}

export interface SessioneNotturna {
  ip: string;
  country: string;
  isp: string;
  nSessions: number;
}

interface AmlStore {
  /* slice “core” */
  transactionResults: TransactionResults | null;
  accessResults: AccessResult[];

  /* slice aggiunti con il refactor */
  grafici: Grafico[];
  sessioniNotturne: SessioneNotturna[];

  /* ai */
  advancedAnalysis: AdvancedAnalysis | null;

  /* mutators */
  setTransactionResults: (r: TransactionResults | null) => void;
  setAccessResults: (r: AccessResult[]) => void;
  setGrafici: (g: Grafico[]) => void;
  setSessioniNotturne: (s: SessioneNotturna[]) => void;
  setAdvancedAnalysis: (r: AdvancedAnalysis | null) => void;

  /* utils */
  clear: () => void;
}

/**
 * STORE
 * ----------------------------------------------------------------------------
 * Unifica tutti i dati AML in un’unica slice Zustand.  I nuovi campi
 * `grafici` e `sessioniNotturne` sono inizializzati come array vuoti
 * per mantenere la compatibilità con il comportamento precedente.
 */
export const useAmlStore = create<AmlStore>((set) => ({
  /* stato iniziale --------------------------------------------------------- */
  transactionResults: null,
  accessResults: [],
  grafici: [],
  sessioniNotturne: [],
      advancedAnalysis: null,
  advancedAnalysis: null,

  /* setter ----------------------------------------------------------------- */
  setTransactionResults: (r) => set({ transactionResults: r }),
  setAccessResults: (r) => set({ accessResults: r }),
  setGrafici: (g) => set({ grafici: g }),
  setSessioniNotturne: (s) => set({ sessioniNotturne: s }),
  setAdvancedAnalysis: (r) => set({ advancedAnalysis: r }),

  /* clear ------------------------------------------------------------------ */
  clear: () =>
    set({
      transactionResults: null,
      accessResults: [],
      grafici: [],
      sessioniNotturne: [],
      advancedAnalysis: null,
  advancedAnalysis: null,
    }),
}));
