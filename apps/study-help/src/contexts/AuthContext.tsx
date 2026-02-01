import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  institutionId: string | null;
  institutionName?: string | null;
  emailVerified: boolean;
  canvasConnected: boolean;
  canvasUserId?: string | null;
  lastLoginAt?: string | null;
  lastSyncAt?: string | null;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, institutionId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// API base URL - adjust based on environment
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// API helper with credentials (cookies)
async function authFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/study-help/auth${endpoint}`, {
    ...options,
    credentials: 'include', // Important: send/receive cookies
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    },
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || 'Authentication failed');
  }

  return json.data;
}

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize - check if we have a valid session (cookie-based)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user - server will check the session cookie
        const { user } = await authFetch<{ user: User }>('/me');
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error) {
        // No valid session
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));

    try {
      const { user } = await authFetch<{ user: User; expiresAt: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(s => ({ ...s, isLoading: false }));
      throw error;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string, institutionId?: string) => {
    setState(s => ({ ...s, isLoading: true }));

    try {
      const { user } = await authFetch<{ user: User; expiresAt: string }>('/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, institutionId }),
      });

      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(s => ({ ...s, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch('/logout', {
        method: 'POST',
      }).catch(() => {
        // Ignore errors - we're logging out anyway
      });
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const { user } = await authFetch<{ user: User }>('/me');
      setState(s => ({ ...s, user }));
    } catch (error) {
      // Session might be invalid, log out
      await logout();
    }
  }, [state.isAuthenticated, logout]);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to get just the current user (or null)
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

// Hook that throws if user is not authenticated (use in protected routes)
export function useRequiredUser(): User {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    throw new Error('User must be authenticated');
  }
  return user;
}
