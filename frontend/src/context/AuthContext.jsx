import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const publicPaths = ['/login', '/forgot-password'];
    if (publicPaths.includes(window.location.pathname)) {
      setLoading(false);
      return;
    }
    api.get('/auth/me').then((res) => setUser(res.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login: async (loginId, password) => {
      const res = await api.post('/auth/login', { loginId, password });
      setUser(res.data.user);
      return res.data.user;
    },
    logout: async () => {
      await api.post('/auth/logout');
      setUser(null);
    },
    refresh: async () => {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
