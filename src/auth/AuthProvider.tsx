import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authBackend } from './backend';
import { AuthError, type AuthUser } from './types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return authBackend.onAuthStateChanged((u) => {
      setUser(u);
      setStatus(u ? 'signedIn' : 'signedOut');
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      busy,
      error,
      clearError: () => setError(null),
      signIn: async (email, password) => {
        setBusy(true);
        setError(null);
        try {
          await authBackend.signIn(email, password);
        } catch (e) {
          setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
          throw e;
        } finally {
          setBusy(false);
        }
      },
      signUp: async (email, password, name) => {
        setBusy(true);
        setError(null);
        try {
          await authBackend.signUp(email, password, name);
        } catch (e) {
          setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
          throw e;
        } finally {
          setBusy(false);
        }
      },
      signOut: () => authBackend.signOut(),
    }),
    [status, user, busy, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
