import axios, { type AxiosInstance } from 'axios';

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
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
