import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessioneNotturna { [key: string]: unknown }
export interface Grafico { [key: string]: unknown }

interface AmlExtraState {
  sessioniNotturne: SessioneNotturna[];
  grafici: Grafico[];
  setSessioni: (s: SessioneNotturna[]) => void;
  setGrafici: (g: Grafico[]) => void;
}

/**
 * Slice Zustand destinato alle funzionalità di esportazione:
 * tiene traccia di Sessioni Notturne e Grafici così che possano
 * essere serializzati insieme a Transazioni e Accessi, già gestiti altrove.
 */
export const useAmlExportStore = create<AmlExtraState>()(
  persist(
    (set) => ({
      sessioniNotturne: [],
      grafici: [],
      setSessioni: (sessioni) => set({ sessioniNotturne: sessioni }),
      setGrafici: (grafici)   => set({ grafici }),
    }),
    { name: 'toppery-aml-export-slice' }
  )
);
