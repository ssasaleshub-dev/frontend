import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import authService from '../services/api/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => authService.getToken());
  const [user, setUser] = useState(() => authService.getUser());
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch account if we have a token and haven't fetched it yet this session
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

  const login = async (username, password, rememberMe = true) => {
    hasFetchedRef.current = true; // login already fetches account
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

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
