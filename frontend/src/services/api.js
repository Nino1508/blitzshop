// frontend/src/services/api.js

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token JWT a todas las requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ecommerce-jwt-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar responses y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('ecommerce-jwt-token');
      localStorage.removeItem('ecommerce-user-data');
      localStorage.removeItem('ecommerce-user-id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;