// src/state/amlAdvanced.ts
/* eslint-disable */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Indicator = {
  net_flow_by_month: { month: string; deposits: number; withdrawals: number }[];
  hourly_histogram: { hour: number; count: number }[];
  method_breakdown: { method: string; pct: number }[];
  daily_flow: { day: string; deposits: number; withdrawals: number }[];
  daily_count: { day: string; count: number }[];
};

export type AnalysisResult = {
  summary: string;
  risk_score: number;
  indicators: Indicator;
};

type State = {
  result: AnalysisResult | null;
  setResult: (r: AnalysisResult | null) => void;
  clear: () => void;
};

export const useAmlAdvancedStore = create<State>()(
  persist(
    (set) => ({
      result: null,
      setResult: (r) => set({ result: r }),
      clear: () => set({ result: null }),
    }),
    {
      name: 'aml-advanced-analysis',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
