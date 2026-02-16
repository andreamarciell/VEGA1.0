/**
 * API Client utility for making authenticated requests to the backend
 * Uses Clerk session tokens for authentication
 */

interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

/**
 * Get Clerk session token
 * This function should be called from React components that have access to Clerk hooks
 */
async function getClerkToken(): Promise<string | null> {
  try {
    // Try to get token from Clerk instance if available
    if (typeof window !== 'undefined' && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      if (clerk.session) {
        const token = await clerk.session.getToken();
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting Clerk token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 * @param url - The API endpoint URL
 * @param options - Request options
 * @param getToken - Optional function to get the auth token (from useAuth hook)
 * @returns Promise<Response>
 */
export async function apiRequest(
  url: string,
  options: ApiClientOptions = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const { method = 'GET', body, headers = {}, credentials = 'include' } = options;

  // Get authentication token
  let token: string | null = null;
  if (getToken) {
    token = await getToken();
  } else {
    token = await getClerkToken();
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authorization header if token is available
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Build request options
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials,
  };

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  // Make the request
  return fetch(url, requestOptions);
}

/**
 * API client with convenience methods
 * Usage: import { api } from '@/lib/apiClient';
 * Then: const response = await api.get('/api/v1/super-admin/tenants', getToken);
 */
export const api = {
  /**
   * GET request
   */
  get: async (url: string, getToken?: () => Promise<string | null>): Promise<Response> => {
    return apiRequest(url, { method: 'GET' }, getToken);
  },

  /**
   * POST request
   */
  post: async (
    url: string,
    body: any,
    getToken?: () => Promise<string | null>
  ): Promise<Response> => {
    return apiRequest(url, { method: 'POST', body }, getToken);
  },

  /**
   * PUT request
   */
  put: async (
    url: string,
    body: any,
    getToken?: () => Promise<string | null>
  ): Promise<Response> => {
    return apiRequest(url, { method: 'PUT', body }, getToken);
  },

  /**
   * PATCH request
   */
  patch: async (
    url: string,
    body: any,
    getToken?: () => Promise<string | null>
  ): Promise<Response> => {
    return apiRequest(url, { method: 'PATCH', body }, getToken);
  },

  /**
   * DELETE request
   */
  delete: async (url: string, getToken?: () => Promise<string | null>): Promise<Response> => {
    return apiRequest(url, { method: 'DELETE' }, getToken);
  },
};

/**
 * Helper function to parse JSON response and handle errors
 */
export async function apiResponse<T = any>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.message || error.error || 'Request failed');
  }
  return response.json();
}
