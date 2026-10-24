import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredToken, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { schoolLogin, schoolLogout, schoolSession, type SchoolAuthUser } from '../api/auth';

export type SchoolRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

export type SchoolSession = {
  name: string;
  email: string;
  role: SchoolRole;
  school: string;
};

type AuthContextValue = {
  session: SchoolSession | null;
  token: string | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toSession(user: SchoolAuthUser): SchoolSession {
  const role = (user.role || 'ADMIN').toUpperCase() as SchoolRole;
  return {
    name: user.fullName,
    email: user.email,
    role: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT'].includes(role) ? role : 'ADMIN',
    school: user.school || 'School',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const existing = getStoredToken();
    setAuthToken(existing);
    return existing;
  });
  const [session, setSession] = useState<SchoolSession | null>(null);
  const [booting, setBooting] = useState(() => Boolean(getStoredToken()));

  const expire = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setSession(null);
    setBooting(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(expire);
    return () => setUnauthorizedHandler(null);
  }, [expire]);

  useEffect(() => {
    if (!getStoredToken()) return;
    schoolSession()
      .then((response) => {
        setToken(response.token);
        setSession(toSession(response.user));
      })
      .catch(() => {
        setAuthToken(null);
        setToken(null);
        setSession(null);
      })
      .finally(() => setBooting(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      token,
      booting,
      async login(email: string, password: string) {
        const response = await schoolLogin(email, password);
        setToken(response.token);
        setSession(toSession(response.user));
      },
      async logout() {
        try {
          await schoolLogout();
        } finally {
          setToken(null);
          setSession(null);
          setAuthToken(null);
        }
      },
    }),
    [booting, session, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
