import axiosClient from './axiosClient';
import { API_ENDPOINTS, STORAGE_KEYS } from '../../config/constants';

export const authService = {
  async login(username, password, rememberMe = true) {
    const res = await axiosClient.post(API_ENDPOINTS.AUTHENTICATE, {
      username,
      password,
      rememberMe,
    });

    const token = res?.id_token || res?.token || (typeof res === 'string' ? res : null);
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      
      // Fetch full user profile from /api/account
      try {
        const account = await axiosClient.get(API_ENDPOINTS.ACCOUNT);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(account));
        return { token, user: account };
      } catch {
        const fallbackUser = { login: username, username };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(fallbackUser));
        return { token, user: fallbackUser };
      }
    }
    throw new Error('Authentication failed: No token received');
  },

  async getAccount() {
    return await axiosClient.get(API_ENDPOINTS.ACCOUNT);
  },

  async updateAccount(data) {
    return await axiosClient.post(API_ENDPOINTS.ACCOUNT, data);
  },

  async changePassword(currentPassword, newPassword) {
    return await axiosClient.post(API_ENDPOINTS.CHANGE_PASSWORD, { currentPassword, newPassword });
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  getToken: () => localStorage.getItem(STORAGE_KEYS.TOKEN),
  getUser: () => {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
};

export default authService;
