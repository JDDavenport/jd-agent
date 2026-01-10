import { createClient } from '@jd-agent/api-client';

// Get API URL from environment or use empty for same-origin
const getApiBaseUrl = (): string => {
  // Vite environment variable (set during build)
  if (import.meta.env.VITE_API_URL) {
    // Remove trailing slash if present (api-client paths start with /)
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  // Default to empty - paths in api-client already include /api prefix
  return '';
};

export const api = createClient(getApiBaseUrl());
