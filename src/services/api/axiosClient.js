import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../../config/constants';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        window.location.href = '/login';
      }
    }
    const errData = error.response?.data;
    const message = errData?.detail || errData?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

const inFlightGets = new Map();
const originalGet = axiosClient.get.bind(axiosClient);

axiosClient.get = function (url, config = {}) {
  const key = `${url}?${JSON.stringify(config?.params || {})}`;
  if (inFlightGets.has(key)) {
    return inFlightGets.get(key);
  }

  const promise = originalGet(url, config).finally(() => {
    inFlightGets.delete(key);
  });

  inFlightGets.set(key, promise);
  return promise;
};

export default axiosClient;
