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
  VaultEntry,
  VaultTreeNode,
  VaultBreadcrumb,
  CalendarEvent,
  VaultPage,
  VaultPageTreeNode,
  VaultPageBreadcrumb,
  CreateVaultPageInput,
  UpdateVaultPageInput,
  VaultBlock,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  MoveVaultBlockInput,
  BatchBlockOperation,
} from './lib/api-client';

// Also re-export additional types from the types file
export type {
  VaultContentType,
  VaultSource,
  CreateVaultInput,
  VaultSearchParams,
  VaultBlockType,
  VaultBlockContent,
  TextBlockContent,
  HeadingBlockContent,
  TodoBlockContent,
  CalloutBlockContent,
  CodeBlockContent,
  ImageBlockContent,
  FileBlockContent,
  BookmarkBlockContent,
} from './lib/types';
