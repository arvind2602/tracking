import axios from 'axios';

/**
 * Centralized Axios instance for all API requests.
 * Base URL is read from the NEXT_PUBLIC_API_URL environment variable.
 * Falls back to production URL if not set.
 */
const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://tasksb.vercel.app/api',
});

/** Attach JWT token from localStorage to every outgoing request. */
instance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** Global response error handling — rejects with the original error. */
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        // Avoid redirecting if already on the login page to prevent loops
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
