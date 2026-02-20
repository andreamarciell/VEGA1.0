import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api, apiResponse } from '@/lib/apiClient';

export interface TenantFeatures {
  text_wizard?: boolean;
}

export function useTenantFeatures(): {
  features: TenantFeatures | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { getToken } = useAuth();
  const [features, setFeatures] = useState<TenantFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/v1/tenant/features', getToken);
      if (response.status === 401 || response.status === 403) {
        setFeatures({ text_wizard: false });
        return;
      }
      const data = await apiResponse<{ features: TenantFeatures }>(response);
      setFeatures(data.features ?? { text_wizard: false });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load features'));
      setFeatures({ text_wizard: false });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return { features, loading, error, refetch: fetchFeatures };
}
