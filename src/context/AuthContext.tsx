import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import authService from '../services/api/authService';
import type { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [loading, setLoading] = useState<boolean>(false);
  const hasFetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (token && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      authService.getAccount()
        .then((account) => {
          if (account) {
            setUser(account);
            localStorage.setItem('ssa_user', JSON.stringify(account));
          }
        })
        .catch(() => {
          // Keep cached user on network blip
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string, rememberMe: boolean = true) => {
    hasFetchedRef.current = true;
    const data = await authService.login(username, password, rememberMe);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    authService.logout();
    hasFetchedRef.current = false;
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: Boolean(token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
