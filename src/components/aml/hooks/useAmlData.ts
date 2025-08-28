import { useAmlStore, TransactionResults } from '@/store/amlStore';
import { useTransactionsStore } from '@/components/aml/TransactionsTab';
import { usePaymentsStore } from '@/components/aml/PaymentsTab';

/**
 * Hook che raccoglie, normalizza e mette in un unico
 * oggetto tutti i dati destinati all'esportazione JSON.
 *
 * - Sessioni Notturne    ➜ useAmlStore + localStorage
 * - Accessi              ➜ useAmlStore  
 * - Transazioni          ➜ useTransactionsStore + localStorage
 * - Grafici (Games)      ➜ useAmlStore + computed from transactions
 */
export default function useAmlData() {
  /* ---------- Slice "core" già presenti ---------- */
  const transactionResults = useAmlStore(state => state.transactionResults);
  const accessResults      = useAmlStore(state => state.accessResults);
  const advancedAnalysis  = useAmlStore(state => state.advancedAnalysis);
  /* ---------- Slice extra: grafici + sessioniNotturne ---------- */
  const { grafici: graficiExtra, sessioniNotturne: sessioniNotturneExtra } =
    useAmlStore(s => ({ grafici: s.grafici, sessioniNotturne: s.sessioniNotturne }));
  
  /* ---------- Nuove slice dedicate a export ---------- */
  const transactionsResult = useTransactionsStore(state => state.result);
  const paymentsResult = usePaymentsStore(state => state.result);

  /* ---------- Get data from localStorage as fallback ---------- */
  const getLocalStorageData = () => {
    try {
      const amlTransactions = localStorage.getItem('amlTransactions');
      const amlResults = localStorage.getItem('amlResults');
      const amlAccessResults = localStorage.getItem('aml_access_results');
      
      return {
        transactions: amlTransactions ? JSON.parse(amlTransactions) : [],
        results: amlResults ? JSON.parse(amlResults) : null,
        accessResults: amlAccessResults ? JSON.parse(amlAccessResults) : []
      };
    } catch (e) {
      return { transactions: [], results: null, accessResults: [] };
    }
  };

  const localStorageData = getLocalStorageData();

  // Debug logging to see what data is available
  console.log('Export Debug - Zustand stores:', {
    transactionResults: !!transactionResults,
    accessResults: !!accessResults,
    transactionsResult: !!transactionsResult,
    paymentsResult: !!paymentsResult,
    sessioniNotturneExtra: sessioniNotturneExtra.length,
    graficiExtra: graficiExtra.length
  });

  console.log('Export Debug - localStorage:', {
    transactions: localStorageData.transactions.length,
    results: !!localStorageData.results,
    accessResults: localStorageData.accessResults.length
  });

  /* ---------- Normalizzazione / fallback ---------- */
  const sessioni = sessioniNotturneExtra.length
    ? sessioniNotturneExtra
    : computeSessioni(accessResults || localStorageData.accessResults);

  const grafici = graficiExtra.length
    ? graficiExtra
    : computeGrafici(transactionResults as any);

  // Extract games data from transactions
  const gamesData = computeGamesData(transactionResults, localStorageData.transactions);

  return {
    sessioniNotturne: sessioni,
    accessi: accessResults || localStorageData.accessResults,
    transazioni: {
      deposits: transactionsResult?.deposit ? {
        methods: transactionsResult.deposit.methods,
        totalAmount: transactionsResult.deposit.totAll
      } : null,
      withdrawals: transactionsResult?.withdraw ? {
        methods: transactionsResult.withdraw.methods,
        totalAmount: transactionsResult.withdraw.totAll
      } : null,
      cards: transactionsResult?.cards ? {
        methods: transactionsResult.cards.cards.map(card => ({
          pan: card.pan,
          bin: card.bin,
          holder: card.name,
          type: card.type,
          product: card.prod,
          country: card.ctry,
          bank: card.bank,
          approved: card.app,
          declined: card.dec,
          nDeclined: card.nDec,
          percentage: card.perc,
          reasons: card.reasons
        })),
        totalApproved: transactionsResult.cards.summary.app,
        totalDeclined: transactionsResult.cards.summary.dec
      } : null
    },
    grafici: {
      monthly: grafici,
      games: gamesData
    },
    analisiAvanzata: advancedAnalysis,
  };
}


// -----------------------------------------------------------------------------
// Helper per derivare i dataset "Grafici" e "Sessioni Notturne" anche quando
// l’utente non ha ancora aperto le rispettive tab. In questo modo i dati vengono
// sempre inclusi nell’esportazione JSON.
// -----------------------------------------------------------------------------
function computeGrafici(transactionResults?: TransactionResults | null) {
  if (!transactionResults) return [];
  const dep = transactionResults.depositData;
  const wit = transactionResults.withdrawData;

  const sumObj = (obj?: Record<string, number>) =>
    obj ? Object.values(obj).reduce((a, b) => a + (b || 0), 0) : 0;

  const monthsSet = new Set<string>([
    ...(dep?.months ?? []),
    ...(wit?.months ?? []),
  ]);

  return Array.from(monthsSet).sort().map(month => ({
    month,
    depositi: sumObj(dep?.perMonth?.[month]),
    prelievi: sumObj(wit?.perMonth?.[month]),
  }));
}

function computeSessioni(accessResults?: any[] | null) {
  return (accessResults ?? [])
    .filter(r => (r as any)?.nSessions > 0)
    .map(r => ({
      ip: (r as any).ip,
      country: (r as any).country,
      isp: (r as any).isp,
      nSessions: (r as any).nSessions,
    }));
}

function computeGamesData(transactionResults?: TransactionResults | null, fallbackTransactions?: any[]) {
  // Get transactions from localStorage or from the results
  let allTx: any[] = [];
  
  if (fallbackTransactions && fallbackTransactions.length > 0) {
    allTx = fallbackTransactions;
  } else {
    const amlTransactions = localStorage.getItem('amlTransactions');
    
    if (amlTransactions) {
      try {
        const parsed = JSON.parse(amlTransactions);
        allTx = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        allTx = [];
      }
    } else if (transactionResults?.transactions?.length > 0) {
      allTx = [...transactionResults.transactions];
    }
  }

  if (allTx.length === 0) return [];

  // Games categorization logic
  const normalizeCausale = (causale: string) => {
    if (!causale) return '';
    const lc = causale.toLowerCase().trim();
    
    // Session Slot: distinguish Live versions
    if (lc.startsWith('session slot') || lc.startsWith('sessione slot')) {
      return lc.includes('(live') ? 'Session Slot (Live)' : 'Session Slot';
    }
    
    // Bingo
    if (lc.includes('bingo')) {
      return 'Bingo';
    }
    
    // Poker
    if (lc.includes('poker')) {
      return 'Poker';
    }
    
    // Gratta e Vinci
    if (lc.includes('gratta') || lc.includes('vinci')) {
      return 'Gratta e Vinci';
    }
    
    // Casino Live
    if (lc.includes('casino live') || lc.includes('casino live')) {
      return 'Casino Live';
    }
    
    // Other games
    if (lc.includes('slot') || lc.includes('gioco')) {
      return 'Other Games';
    }
    
    return causale;
  };

  // Categorize transactions by game type
  const gameCategories: Record<string, { count: number; totalAmount: number; transactions: any[] }> = {};
  
  allTx.forEach(tx => {
    const gameType = normalizeCausale(tx.causale);
    const amount = Number(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
    
    if (!gameCategories[gameType]) {
      gameCategories[gameType] = { count: 0, totalAmount: 0, transactions: [] };
    }
    
    gameCategories[gameType].count++;
    gameCategories[gameType].totalAmount += amount;
    gameCategories[gameType].transactions.push({
      date: tx.data || tx.date || tx.Data,
      causale: tx.causale || tx.Causale,
      amount: amount,
      rawAmount: tx.importo_raw ?? tx.importoRaw ?? tx.amountRaw ?? tx.amount_str ?? tx.amountStr ?? amount
    });
  });

  // Convert to array format
  return Object.entries(gameCategories).map(([gameType, data]) => ({
    gameType,
    count: data.count,
    totalAmount: data.totalAmount,
    transactions: data.transactions
  }));
}