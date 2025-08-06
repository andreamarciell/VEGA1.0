import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Tipi generici – sostituire con interfacce precise se disponibili */
export interface SessioneNotturna { [key: string]: unknown }
export interface Transazione { [key: string]: unknown }
export interface Grafico { [key: string]: unknown }
export interface Accesso { [key: string]: unknown }

interface AmlState {
  sessioniNotturne: SessioneNotturna[];
  transazioni: Transazione[];
  grafici: Grafico[];
  accessi: Accesso[];

  /** setters */
  setSessioni: (s: SessioneNotturna[]) => void;
  setTransazioni: (t: Transazione[]) => void;
  setGrafici: (g: Grafico[]) => void;
  setAccessi: (a: Accesso[]) => void;
}

/**
 * Uno store Zustand unico che contiene i dati necessari alle quattro view AML.
 * È persistito in localStorage così da essere disponibile anche dopo refresh.
 */
export const useAmlStore = create<AmlState>()(
  persist(
    (set) => ({
      sessioniNotturne: [],
      transazioni:      [],
      grafici:          [],
      accessi:          [],

      setSessioni:  (sessioni)    => set({ sessioniNotturne: sessioni }),
      setTransazioni: (transazioni) => set({ transazioni }),
      setGrafici:     (grafici)     => set({ grafici }),
      setAccessi:     (accessi)     => set({ accessi }),
    }),
    {
      name: 'toppery-aml-store',
    }
  )
);
