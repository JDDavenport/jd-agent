import axios, { type AxiosInstance } from 'axios';

// Get API URL from environment or use relative path for same-origin
const getApiBaseUrl = (): string => {
  // Vite environment variable (set during build)
  if (import.meta.env.VITE_API_URL) {
    const baseUrl = import.meta.env.VITE_API_URL;
    // Ensure the URL ends with /api for correct routing
    if (baseUrl.endsWith('/api')) {
      return baseUrl;
    }
    // Remove trailing slash if present and append /api
    return baseUrl.replace(/\/$/, '') + '/api';
  }
  // Default to relative path (works when API and UI are on same origin)
  return '/api';
};

const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap the data from the response
    if (response.data && response.data.success !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);

    // Extract error message from response
    const message = error.response?.data?.error?.message
      || error.response?.data?.message
      || error.message
      || 'Network error';

    throw new Error(message);
  }
);

export default apiClient;
