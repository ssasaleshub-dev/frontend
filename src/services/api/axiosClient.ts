import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../../config/constants';

export interface CustomAxiosInstance {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  interceptors: any;
  [key: string]: any;
}

const instance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use((config) => {
  const token =
    localStorage.getItem(STORAGE_KEYS.ID_TOKEN) ||
    localStorage.getItem(STORAGE_KEYS.TOKEN) ||
    localStorage.getItem('id_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
        localStorage.removeItem('id_token');
        localStorage.removeItem(STORAGE_KEYS.USER);
        window.location.href = '/login';
      }
    }
    const status = error.response?.status;
    const errData = error.response?.data;

    // Check if error is due to backend server down, network failure, or Cloudflare origin timeout
    const rawMsg = String(
      (typeof errData === 'string' ? errData : '') ||
      errData?.detail ||
      errData?.message ||
      error.message ||
      ''
    );

    const isServerDown =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      (typeof status === 'number' && status >= 500 && status <= 599) ||
      rawMsg.toLowerCase().includes('cloudflare') ||
      rawMsg.toLowerCase().includes('tcp connection') ||
      rawMsg.toLowerCase().includes('tcp handshake') ||
      rawMsg.toLowerCase().includes('network error') ||
      rawMsg.toLowerCase().includes('origin server') ||
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('econnrefused') ||
      rawMsg.toLowerCase().includes('etimedout') ||
      rawMsg.toLowerCase().includes('gateway') ||
      rawMsg.toLowerCase().includes('service unavailable');

    const message = isServerDown
      ? 'Server is down. Please contact support team.'
      : errData?.detail || errData?.message || error.message || 'Request failed';

    const customError: any = new Error(message);
    customError.status = status;
    customError.response = error.response;
    customError.data = errData;
    customError.isServerDown = isServerDown;
    return Promise.reject(customError);
  }
);

const inFlightGets = new Map<string, Promise<any>>();
const originalGet = instance.get.bind(instance);

(instance as any).get = function <T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const key = `${url}?${JSON.stringify(config?.params || {})}`;
  if (inFlightGets.has(key)) {
    return inFlightGets.get(key) as Promise<T>;
  }

  const promise = originalGet(url, config).finally(() => {
    inFlightGets.delete(key);
  });

  inFlightGets.set(key, promise);
  return promise as Promise<T>;
};

const axiosClient = instance as unknown as CustomAxiosInstance;
export default axiosClient;
