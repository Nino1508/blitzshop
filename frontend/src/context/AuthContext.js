import React, { createContext, useContext, useState, useEffect } from 'react';

// Detectar entorno automáticamente
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://blitzshop-backend.onrender.com';

// Create context
const AuthContext = createContext();

// Claves únicas para este proyecto
const STORAGE_KEYS = {
  TOKEN: 'ecommerce-jwt-token',
  USER: 'ecommerce-user-data',
  USER_ID: 'ecommerce-user-id'
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.access_token);
        
        // Guardar en localStorage con claves únicas
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
        
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.access_token);
        
        // Guardar en localStorage con claves únicas
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
        
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    
    // Limpiar localStorage
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
  };

  // Update user data (for profile updates)
  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUserData));
  };

  // Make updateUser globally accessible for NotificationSettings
  window.updateUserContext = updateUser;

  // Check if user is admin
  const isAdmin = () => {
    return user && user.is_admin;
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!user && !!token;
  };

  // Get current auth token
  const getAuthToken = () => {
    return token;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,  
    isAdmin,
    isAuthenticated,
    getAuthToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
