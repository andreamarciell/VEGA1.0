import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate: string;
  matchType: string;
  matchOther: string;
  inputText: string;
  summary: string;
  loading: boolean;
  error: string;
};

type IndicatorsState = {
  adverse: Indicator[];
  full: Indicator[];
  setAdverse: (items: Indicator[]) => void;
  setFull: (items: Indicator[]) => void;
  clearAll: () => void;
};

export const useIndicatorsStore = create<IndicatorsState>()(
  persist(
    (set) => ({
      adverse: [],
      full: [],
      setAdverse: (items) => set({ adverse: items }),
      setFull: (items) => set({ full: items }),
      clearAll: () => set({ adverse: [], full: [] }),
    }),
    {
      name: 'review-indicators',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ adverse: state.adverse, full: state.full }),
    }
  )
);