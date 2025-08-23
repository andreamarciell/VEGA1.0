// src/features/review/store/indicatorsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type IndicatorItem = any;

type IndicatorsState = {
  adverseItems: IndicatorItem[];
  fullItems: IndicatorItem[];
  setAdverse: (items: IndicatorItem[]) => void;
  setFull: (items: IndicatorItem[]) => void;
  clear: () => void;
};

export const useIndicatorsStore = create<IndicatorsState>()(
  persist(
    (set) => ({
      adverseItems: [],
      fullItems: [],
      setAdverse: (items) => set({ adverseItems: items }),
      setFull: (items) => set({ fullItems: items }),
      clear: () => set({ adverseItems: [], fullItems: [] }),
    }),
    { name: 'review-indicators', storage: createJSONStorage(() => localStorage) }
  )
);

export default useIndicatorsStore;