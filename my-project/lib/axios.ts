import axios from 'axios';
import toast from 'react-hot-toast';

const instance = axios.create({
  baseURL: 'http://localhost:5000/api',
  // baseURL: 'https://89q8wp9g-5000.inc1.devtunnels.ms/api',
  // baseURL: 'https://tasksb.vercel.app/api',
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => {
    // toast.success('API call successful!');
    return response;
  },
  (error) => {
    // toast.error(error.response?.data?.message || 'Something went wrong!');
    return Promise.reject(error);
  }
);

export default instance;
