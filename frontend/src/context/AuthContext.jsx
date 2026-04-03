import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sessionStorage clears automatically when browser tab/window is closed
    const storedToken = sessionStorage.getItem('syncbeat_token');
    const storedUser  = sessionStorage.getItem('syncbeat_user');
    if (storedToken && storedUser) {
      try {
        // Verify the token is not expired by checking its payload
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          // Token expired — clear and force re-login
          sessionStorage.clear();
        }
      } catch {
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (tokenData, userData) => {
    sessionStorage.setItem('syncbeat_token', tokenData);
    sessionStorage.setItem('syncbeat_user', JSON.stringify(userData));
    setToken(tokenData);
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('syncbeat_token');
    sessionStorage.removeItem('syncbeat_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, token, login, logout, loading,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);