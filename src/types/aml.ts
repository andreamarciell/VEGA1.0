
export interface MovementsData {
  totAll?: number;
  months?: string[];
  all?: Record<string, number>;
  perMonth?: Record<string, Record<string, number>>;
}

export interface TransactionResults {
  depositData?: MovementsData;
  withdrawData?: MovementsData;
  cardData?: any[];
  includeCard?: boolean;
}

export interface Grafico {
  month: string;
  depositi: number;
  prelievi: number;
}

export interface SessioneNotturna {
  nSessions: number;
}

export interface AccessResult {
  ip: string;
  date: string;
  isp?: string;
  country?: string;
}
