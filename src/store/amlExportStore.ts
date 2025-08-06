
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Grafico, SessioneNotturna } from '@/types/aml';

interface AmlExportState {
  grafici: Grafico[];
  sessioniNotturne: SessioneNotturna[];

  setGrafici: (g: Grafico[]) => void;
  setSessioni: (s: SessioneNotturna[]) => void;

  clear: () => void;
}

export const useAmlExportStore = create<AmlExportState>()(
  persist(
    (set) => ({
      grafici: [],
      sessioniNotturne: [],

      setGrafici: (g) => set({ grafici: g }),
      setSessioni: (s) => set({ sessioniNotturne: s }),

      clear: () => set({ grafici: [], sessioniNotturne: [] }),
    }),
    { name: 'toppery-aml-export-store' }
  )
);
