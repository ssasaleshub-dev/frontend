import axiosClient from './axiosClient';
import { API_ENDPOINTS, STORAGE_KEYS } from '../../config/constants';
import type { User } from '../../types';

export const authService = {
  async login(username: string, password: string, rememberMe: boolean = true): Promise<{ token: string; user: User }> {
    const cleanUsername = username?.trim().toLowerCase();
    const res: any = await axiosClient.post(API_ENDPOINTS.AUTHENTICATE, {
      username: cleanUsername,
      password,
      rememberMe,
    });

    const token = res?.id_token || res?.token || (typeof res === 'string' ? res : null);
    if (!token) {
      throw new Error('Authentication failed: No token received from server.');
    }

    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, token);
    localStorage.setItem('id_token', token);

    const account = await axiosClient.get<User>(API_ENDPOINTS.ACCOUNT);
    if (!account) {
      throw new Error('Could not fetch user account from server.');
    }

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(account));
    return { token, user: account };
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
    localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
    localStorage.removeItem('id_token');
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  getToken: (): string | null =>
    localStorage.getItem(STORAGE_KEYS.ID_TOKEN) ||
    localStorage.getItem(STORAGE_KEYS.TOKEN) ||
    localStorage.getItem('id_token'),

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
