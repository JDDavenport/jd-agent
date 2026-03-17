/**
 * Better Auth client for the Study Aide frontend
 */

import { createAuthClient } from 'better-auth/react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const authClient = createAuthClient({
  baseURL: API_BASE,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
