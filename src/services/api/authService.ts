import axiosClient from './axiosClient';
import { API_ENDPOINTS, STORAGE_KEYS, USER_ROLES } from '../../config/constants';
import type { User } from '../../types';

export const TEST_ACCOUNTS: Record<string, { pass: string; user: User }> = {
  admin: {
    pass: 'admin',
    user: {
      id: 1,
      login: 'admin',
      firstName: 'Admin',
      lastName: 'Administrator',
      email: 'admin@localhost',
      activated: true,
      authorities: [USER_ROLES.ADMIN, USER_ROLES.GENERAL_USER],
    },
  },
  work_staff: {
    pass: 'admin',
    user: {
      id: 2,
      login: 'work_staff',
      firstName: 'Work',
      lastName: 'Staff',
      email: 'workstaff@localhost',
      activated: true,
      authorities: [USER_ROLES.WORK_VISA_COUNSELOR, USER_ROLES.GENERAL_USER],
    },
  },
  study_staff: {
    pass: 'admin',
    user: {
      id: 3,
      login: 'study_staff',
      firstName: 'Study',
      lastName: 'Staff',
      email: 'studystaff@localhost',
      activated: true,
      authorities: [USER_ROLES.STUDY_VISA_COUNSELOR, USER_ROLES.GENERAL_USER],
    },
  },
  other_staff: {
    pass: 'admin',
    user: {
      id: 4,
      login: 'other_staff',
      firstName: 'Other',
      lastName: 'Staff',
      email: 'otherstaff@localhost',
      activated: true,
      authorities: [USER_ROLES.OTHER_VISA_COUNSELOR, USER_ROLES.GENERAL_USER],
    },
  },
};

export const authService = {
  async login(username: string, password: string, rememberMe: boolean = true): Promise<{ token: string; user: User }> {
    const cleanUsername = username?.trim().toLowerCase();
    try {
      const res: any = await axiosClient.post(API_ENDPOINTS.AUTHENTICATE, {
        username: cleanUsername,
        password,
        rememberMe,
      });

      const token = res?.id_token || res?.token || (typeof res === 'string' ? res : null);
      if (token) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.ID_TOKEN, token);
        localStorage.setItem('id_token', token);

        try {
          const account = await axiosClient.get<User>(API_ENDPOINTS.ACCOUNT);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(account));
          return { token, user: account };
        } catch {
          // If account fetch fails but credentials match known test account, use proper role authority
          const testAcc = TEST_ACCOUNTS[cleanUsername];
          const fallbackUser: User = testAcc ? testAcc.user : { login: cleanUsername, authorities: [USER_ROLES.GENERAL_USER] };
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(fallbackUser));
          return { token, user: fallbackUser };
        }
      }
      throw new Error('Authentication failed: No token received');
    } catch (err: any) {
      // Offline fallback for development testing when Spring Boot backend is not yet started
      const testAcc = TEST_ACCOUNTS[cleanUsername];
      if (testAcc && (password === testAcc.pass || password === 'admin')) {
        const mockToken = `mock-bearer-token-${cleanUsername}-${Date.now()}`;
        localStorage.setItem(STORAGE_KEYS.TOKEN, mockToken);
        localStorage.setItem(STORAGE_KEYS.ID_TOKEN, mockToken);
        localStorage.setItem('id_token', mockToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(testAcc.user));
        return { token: mockToken, user: testAcc.user };
      }
      throw err;
    }
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
