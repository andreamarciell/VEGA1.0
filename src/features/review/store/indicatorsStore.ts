import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Indicator = any;

type State = {
  adverseItems: Indicator[];
  fullItems: Indicator[];
  setAdverse: (items: Indicator[]) => void;
  setFull: (items: Indicator[]) => void;
  clear: () => void;
};

const useIndicatorsStore = create<State>()(persist((set) => ({
  adverseItems: [],
  fullItems: [],
  setAdverse: (items) => set({ adverseItems: items }),
  setFull: (items) => set({ fullItems: items }),
  clear: () => set({ adverseItems: [], fullItems: [] })
}), { name: 'review-indicators', storage: createJSONStorage(() => localStorage) }));

export default useIndicatorsStore;