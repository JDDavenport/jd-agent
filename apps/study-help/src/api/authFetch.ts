/**
 * Auth-aware fetch wrapper that automatically includes credentials (cookies)
 * in all API requests.
 */

// API base URL - adjust based on environment
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/**
 * Auth-aware fetch function that includes credentials (cookies)
 * and handles standard API response format.
 * 
 * Uses httpOnly cookies for authentication - no localStorage tokens needed.
 */
export async function authFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Important: send/receive cookies
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });

  // Handle 401 Unauthorized - session expired or invalid
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data as T;
}

/**
 * Hook-friendly version that can be used in components.
 * Creates a fetcher function for use with react-query or SWR.
 */
export function createAuthFetcher() {
  return <T>(endpoint: string, options?: RequestInit) => authFetch<T>(endpoint, options);
}

/**
 * GET request helper
 */
export function authGet<T>(endpoint: string): Promise<T> {
  return authFetch<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export function authPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return authFetch<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request helper
 */
export function authPut<T>(endpoint: string, body?: unknown): Promise<T> {
  return authFetch<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export function authDelete<T>(endpoint: string): Promise<T> {
  return authFetch<T>(endpoint, { method: 'DELETE' });
}
