
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TransactionStore {
  transactionResults: any | null;
  setTransactionResults: (data: any | null) => void;
  reset: () => void;
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactionResults: null,
      setTransactionResults: (data) => set({ transactionResults: data }),
      reset: () => set({ transactionResults: null }),
    }),
    {
      name: 'aml_transaction_results',
    }
  )
);
