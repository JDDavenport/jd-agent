import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setClerkTokenGetter } from '../api';

/**
 * Invisible component that wires up the Clerk session token
 * to the API layer so all fetch calls include the Bearer token.
 */
export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  return <>{children}</>;
}
