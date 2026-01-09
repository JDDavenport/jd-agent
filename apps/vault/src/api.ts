import { createClient } from '@jd-agent/api-client';

// Get API URL from environment or use relative path for same-origin
const getApiBaseUrl = (): string => {
  // Vite environment variable (set during build)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Default to empty string - paths in api-client already include /api prefix
  return '';
};

export const api = createClient(getApiBaseUrl());
