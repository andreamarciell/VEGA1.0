
import { create } from "zustand";

export interface Movement {
  date: string;
  description: string;
  amount: number;
}

export interface CardTransaction {
  date: string;
  bin: string;
  name: string;
  amount: number;
}

export interface TransactionResults {
  deposits?: Movement[];
  withdrawals?: Movement[];
  cards?: CardTransaction[];
}

interface State {
  transactionResults: TransactionResults | null;
  setTransactionResults: (r: TransactionResults | null) => void;
  reset: () => void;
}

export const useTransactionStore = create<State>((set) => ({
  transactionResults: null,
  setTransactionResults: (r) => set({ transactionResults: r }),
  reset: () => set({ transactionResults: null }),
}));
