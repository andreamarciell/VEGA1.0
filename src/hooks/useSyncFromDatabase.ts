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
    risk_level: 'Low' | 'Medium' | 'High' | 'Elevato' | null;
    risk_score: number | null;
  } | null;
}

export function useSyncFromDatabase() {
  const setSyncData = useAmlStore(state => state.setSyncData);
  const setSyncState = useAmlStore(state => state.setSyncState);

  const syncFromDatabase = async (accountId: string): Promise<SyncResponse | null> => {
    setSyncState('loading');
    
    try {
      const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '';
      const url = `${baseUrl}/.netlify/functions/syncFromDatabase?account_id=${encodeURIComponent(accountId)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data: SyncResponse = await response.json();
      
      // Popola lo store
      setSyncData(data.transactions, data.accessResults, data.accountId);
      
      toast.success(`Dati sincronizzati per account ${accountId}`);
      return data;
    } catch (error) {
      console.error('Error syncing from database:', error);
      setSyncState('error');
      toast.error(error instanceof Error ? error.message : 'Errore durante la sincronizzazione');
      return null;
    }
  };

  return { syncFromDatabase };
}
