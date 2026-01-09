import { createClient } from '@jd-agent/api-client';

// Base URL is empty - paths in api-client already include /api prefix
export const api = createClient('');
