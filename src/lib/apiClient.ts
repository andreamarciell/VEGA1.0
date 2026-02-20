/**
 * API Client utility for making authenticated requests to /api/v1/* endpoints
 * Automatically includes Clerk JWT token in Authorization header
 */

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean; // Set to true to skip adding auth token
}

/**
 * Wrapper around fetch that automatically adds Clerk JWT token
 * to all requests to /api/v1/* endpoints
 */
export async function apiClient(
  url: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  const { skipAuth = false, headers = {}, ...restOptions } = options;

  // Check if this is an API v1 request
  const isApiV1Request = url.startsWith('/api/v1/') || url.includes('/api/v1/');

  // Prepare headers
  const requestHeaders = new Headers(headers);

  // Add Authorization header for API v1 requests
  if (isApiV1Request && !skipAuth) {
    try {
      // Get Clerk token and organization ID from global Clerk object
      const clerk = (window as any).Clerk;
      if (clerk?.session) {
        const token = await clerk.session.getToken();
        if (token) {
          requestHeaders.set('Authorization', `Bearer ${token}`);
          
          // Get organization ID and add as custom header if available
          const orgId = clerk.organization?.id;
          if (orgId) {
            requestHeaders.set('X-Organization-Id', orgId);
          }
        } else {
          console.warn('No Clerk token available for API request:', url);
        }
      } else {
        console.warn('Clerk session not available for API request:', url);
        // Don't proceed with request if Clerk is not ready
        throw new Error('Clerk session not available');
      }
    } catch (error) {
      console.error('Error getting Clerk token:', error);
      // Continue without token - backend will return 401
    }
  }

  // Make the request
  return fetch(url, {
    ...restOptions,
    headers: requestHeaders,
  });
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: (url: string, options?: ApiClientOptions) =>
    apiClient(url, { ...options, method: 'GET' }),

  post: (url: string, body?: unknown, options?: ApiClientOptions) =>
    apiClient(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: (url: string, body?: unknown, options?: ApiClientOptions) =>
    apiClient(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (url: string, body?: unknown, options?: ApiClientOptions) =>
    apiClient(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (url: string, options?: ApiClientOptions) =>
    apiClient(url, { ...options, method: 'DELETE' }),
};

/**
 * Parse JSON from response and throw if not ok
 */
export async function apiResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error((error as { message?: string }).message ?? (error as { error?: string }).error ?? 'Request failed');
  }
  return response.json();
}
