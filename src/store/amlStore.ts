
import { create } from 'zustand';
import { Grafico, SessioneNotturna, TransactionResults, AccessResult } from '@/types/aml';

interface AmlStore {
  transactionResults: TransactionResults | null;
  setTransactionResults: (r: TransactionResults | null) => void;

  grafici: Grafico[];
  setGrafici: (g: Grafico[]) => void;

  sessioniNotturne: SessioneNotturna[];
  setSessioniNotturne: (s: SessioneNotturna[]) => void;

  accessResults: AccessResult[];
  setAccessResults: (r: AccessResult[]) => void;

  clear: () => void;
}

export const useAmlStore = create<AmlStore>((set) => ({
  transactionResults: null,
  setTransactionResults: (r) => set({ transactionResults: r }),

  grafici: [],
  setGrafici: (g) => set({ grafici: g }),

  sessioniNotturne: [],
  setSessioniNotturne: (s) => set({ sessioniNotturne: s }),

  accessResults: [],
  setAccessResults: (r) => set({ accessResults: r }),

  clear: () =>
    set({
      transactionResults: null,
      grafici: [],
      sessioniNotturne: [],
      accessResults: [],
    }),
}));
