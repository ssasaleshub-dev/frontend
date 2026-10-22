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
   * Default: page=0, size=20, sort=id,desc as per Admin API specification
   */
  getUsers: (page: number = 0, size: number = 20, sort: string = 'id,desc'): Promise<User[]> =>
    axiosClient.get(API_ENDPOINTS.ADMIN_USERS, {
      params: { page, size, sort },
    }),

  /**
   * Fetch a single user by login username
   */
  getUser: (login: string): Promise<User> =>
    axiosClient.get(`${API_ENDPOINTS.ADMIN_USERS}/${encodeURIComponent(login)}`),

  /**
   * Create a new user (Admin API: POST /api/admin/users)
   * If password is provided, user can log in immediately. If omitted, backend generates a random password.
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
          : ['ROLE_WORK_VISA'],
    };

    if (userData.password && userData.password.trim().length > 0) {
      payload.password = userData.password.trim();
    }

    return axiosClient.post(API_ENDPOINTS.ADMIN_USERS, payload);
  },

  /**
   * Update an existing user (Admin API: PUT /api/admin/users)
   */
  updateUser: (userData: Partial<User>): Promise<User> => {
    const payload: Record<string, any> = {
      ...userData,
      login: userData.login?.trim().toLowerCase(),
      email: userData.email?.trim().toLowerCase(),
    };
    if (userData.firstName !== undefined) payload.firstName = userData.firstName?.trim();
    if (userData.lastName !== undefined) payload.lastName = userData.lastName?.trim();
    return axiosClient.put(API_ENDPOINTS.ADMIN_USERS, payload);
  },

  /**
   * Delete a user by username (DELETE /api/admin/users/{login})
   */
  deleteUser: (login: string): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.ADMIN_USERS}/${encodeURIComponent(login)}`),

  /**
   * Get available authority roles (GET /api/authorities with fallback)
   */
  getAuthorities: async (): Promise<string[]> => {
    try {
      return await axiosClient.get(API_ENDPOINTS.AUTHORITIES);
    } catch {
      return await axiosClient.get(API_ENDPOINTS.ADMIN_USER_AUTHORITIES);
    }
  },

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
