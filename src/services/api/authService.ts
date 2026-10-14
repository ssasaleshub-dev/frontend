import axiosClient from './axiosClient';
import { API_ENDPOINTS, STORAGE_KEYS } from '../../config/constants';
import type { User } from '../../types';

export const authService = {
  async login(username: string, password: string, rememberMe: boolean = true): Promise<{ token: string; user: User }> {
    const res: any = await axiosClient.post(API_ENDPOINTS.AUTHENTICATE, {
      username,
      password,
      rememberMe,
    });

    const token = res?.id_token || res?.token || (typeof res === 'string' ? res : null);
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      try {
        const account = await axiosClient.get<User>(API_ENDPOINTS.ACCOUNT);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(account));
        return { token, user: account };
      } catch {
        const fallbackUser: User = { login: username };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(fallbackUser));
        return { token, user: fallbackUser };
      }
    }
    throw new Error('Authentication failed: No token received');
  },

  async getAccount(): Promise<User> {
    return await axiosClient.get<User>(API_ENDPOINTS.ACCOUNT);
  },

  async updateAccount(data: Partial<User>): Promise<any> {
    return await axiosClient.post(API_ENDPOINTS.ACCOUNT, data);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return await axiosClient.post(API_ENDPOINTS.CHANGE_PASSWORD, { currentPassword, newPassword });
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  getToken: (): string | null => localStorage.getItem(STORAGE_KEYS.TOKEN),
  getUser: (): User | null => {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
};

export default authService;
