import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';
import type { User } from '../../types';

export interface CreateUserData {
  login: string;
  email: string;
  firstName?: string;
  lastName?: string;
  activated?: boolean;
  authorities?: string[];
  langKey?: string;
  password?: string;
}

export const adminService = {
  /**
   * Fetch all users with optional pagination and sorting
   */
  getUsers: (page: number = 0, size: number = 50, sort: string = 'id,asc'): Promise<User[]> =>
    axiosClient.get(API_ENDPOINTS.ADMIN_USERS, {
      params: { page, size, sort },
    }),

  /**
   * Fetch a single user by login username
   */
  getUser: (login: string): Promise<User> =>
    axiosClient.get(`${API_ENDPOINTS.ADMIN_USERS}/${encodeURIComponent(login)}`),

  /**
   * Create a new user (Admin API)
   */
  createUser: (userData: CreateUserData): Promise<User> => {
    const payload: Record<string, any> = {
      login: userData.login?.trim().toLowerCase(),
      firstName: userData.firstName?.trim() || '',
      lastName: userData.lastName?.trim() || '',
      email: userData.email?.trim().toLowerCase(),
      activated: userData.activated !== undefined ? userData.activated : true,
      langKey: userData.langKey || 'en',
      authorities:
        userData.authorities && userData.authorities.length > 0
          ? userData.authorities
          : ['ROLE_USER'],
    };

    if (userData.password) {
      payload.password = userData.password;
    }

    return axiosClient.post(API_ENDPOINTS.ADMIN_USERS, payload);
  },

  /**
   * Update an existing user (Admin API)
   */
  updateUser: (userData: Partial<User>): Promise<User> => {
    return axiosClient.put(API_ENDPOINTS.ADMIN_USERS, {
      ...userData,
      login: userData.login?.trim().toLowerCase(),
      email: userData.email?.trim().toLowerCase(),
    });
  },

  /**
   * Delete a user by username
   */
  deleteUser: (login: string): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.ADMIN_USERS}/${encodeURIComponent(login)}`),

  /**
   * Get available authority roles (e.g. ROLE_ADMIN, ROLE_USER)
   */
  getAuthorities: (): Promise<string[]> =>
    axiosClient.get(API_ENDPOINTS.ADMIN_USER_AUTHORITIES),

  /**
   * Public registration endpoint (Fallback or direct sign up)
   */
  registerUser: ({
    login,
    email,
    password,
    langKey = 'en',
  }: {
    login: string;
    email: string;
    password?: string;
    langKey?: string;
  }): Promise<any> =>
    axiosClient.post(API_ENDPOINTS.REGISTER, {
      login: login?.trim().toLowerCase(),
      email: email?.trim().toLowerCase(),
      password,
      langKey,
    }),
};

export default adminService;
