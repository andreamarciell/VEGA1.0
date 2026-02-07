import { useAmlStore } from '@/store/amlStore';
import { toast } from 'sonner';

interface SyncResponse {
  transactions: any[];
  accessResults: any[];
  accountId: string;
  profile?: {
    account_id: string;
    nick: string;
    first_name: string;
    last_name: string;
  } | null;
}

export function useSyncFromDatabase() {
  const setSyncData = useAmlStore(state => state.setSyncData);
  const setSyncState = useAmlStore(state => state.setSyncState);

  const syncFromDatabase = async (accountId: string, retryCount = 0): Promise<SyncResponse | null> => {
    setSyncState('loading');
    
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 60000; // 60 secondi per BigQuery (più lungo del default)
    
    try {
      const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '';
      const url = `${baseUrl}/api/v1/sync?account_id=${encodeURIComponent(accountId)}`;
      
      // Crea un AbortController per il timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        const data: SyncResponse = await response.json();
        
        // Popola lo store
        setSyncData(data.transactions, data.accessResults, data.accountId);
        
        toast.success(`Dati sincronizzati per account ${accountId}`);
        return data;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Se è un timeout o errore di rete e abbiamo ancora retry disponibili
        if (
          (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout') || fetchError.message?.includes('network')) &&
          retryCount < MAX_RETRIES
        ) {
          console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} for syncFromDatabase...`);
          // Attendi prima di riprovare (backoff esponenziale)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return syncFromDatabase(accountId, retryCount + 1);
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error('Error syncing from database:', error);
      setSyncState('error');
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Errore durante la sincronizzazione';
      
      // Messaggio più specifico per timeout
      if (error instanceof Error && (error.message.includes('timeout') || error.name === 'AbortError')) {
        toast.error('Timeout: BigQuery potrebbe richiedere più tempo. Riprova.');
      } else {
        toast.error(errorMessage);
      }
      return null;
    }
  };

  return { syncFromDatabase };
}
