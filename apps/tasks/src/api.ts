import { createClient } from './lib/api-client';

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

// Re-export types for convenience
export type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Project,
  Section,
  CalendarEvent,
} from './lib/api-client';

// Also re-export additional types from the types file
export type {
  TaskStatus,
  TaskFilters,
  TaskSource,
  EnergyLevel,
} from './lib/types';
