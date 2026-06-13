import React, { createContext, useContext, useState, useCallback } from 'react';
import { AuthUser } from '../types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('disa_token');
    const raw = localStorage.getItem('disa_user');
    return { token, user: raw ? (JSON.parse(raw) as AuthUser) : null };
  });

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem('disa_token', token);
    localStorage.setItem('disa_user', JSON.stringify(user));
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('disa_token');
    localStorage.removeItem('disa_user');
    setState({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
