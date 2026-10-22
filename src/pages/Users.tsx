import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserPlus,
  RefreshCw,
  Mail,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Users as UsersIcon,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import adminService, { type CreateUserData } from '../services/api/adminService';
import { useAuth } from '../context/AuthContext';
import { USER_ROLE_CONFIG, USER_ROLES } from '../config/constants';
import type { User } from '../types';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string>('');
  const hasLoadedRef = useRef<boolean>(false);

  // Pagination state (default: page=0, size=20, sort=id,desc)
  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    login?: string;
    email?: string;
    password?: string;
    authorities?: string;
  }>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form state
  const initialFormState: CreateUserData = {
    login: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    authorities: [USER_ROLES.WORK_VISA_COUNSELOR],
    activated: true,
    langKey: 'en',
  };

  const [formData, setFormData] = useState<CreateUserData>(initialFormState);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await adminService.getUsers(0, 100, 'id,desc');
      const list = Array.isArray(res) ? res : res?.content || [];
      setUsers(list);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to load user directory. Please verify your administrative permissions.'
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchUsers();
    }
  }, [fetchUsers]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const openCreateModal = () => {
    setFormData(initialFormState);
    setModalError('');
    setFieldErrors({});
    setShowPassword(false);
    setShowAddModal(true);
  };

  const openEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    const existingRoles = targetUser.authorities?.length
      ? targetUser.authorities
      : [USER_ROLES.WORK_VISA_COUNSELOR];
    setFormData({
      login: targetUser.login || '',
      firstName: targetUser.firstName || '',
      lastName: targetUser.lastName || '',
      email: targetUser.email || '',
      password: '',
      authorities: existingRoles,
      activated: targetUser.activated !== undefined ? targetUser.activated : true,
      langKey: targetUser.langKey || 'en',
    });
    setModalError('');
    setFieldErrors({});
    setShowPassword(false);
  };

  const handleSelectRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      authorities: [role],
    }));
    if (fieldErrors.authorities) {
      setFieldErrors((prev) => ({ ...prev, authorities: undefined }));
    }
  };

  // Client-side validation helper
  const validateForm = (isCreate: boolean = true): boolean => {
    const errors: { login?: string; email?: string; password?: string; authorities?: string } = {};

    const cleanLogin = (formData.login || '').trim().toLowerCase();
    if (!cleanLogin) {
      errors.login = 'Username is required.';
    } else if (cleanLogin.length < 1 || cleanLogin.length > 50) {
      errors.login = 'Username must be between 1 and 50 characters.';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(cleanLogin)) {
      errors.login = 'Only letters, numbers, dot, underscore, and dash are allowed.';
    }

    const cleanEmail = (formData.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      errors.email = 'Email address is required.';
    } else if (cleanEmail.length < 5 || cleanEmail.length > 254) {
      errors.email = 'Email must be between 5 and 254 characters.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Please enter a valid email format (e.g. name@domain.com).';
    }

    if (isCreate && formData.password && formData.password.length > 0) {
      if (formData.password.length < 4 || formData.password.length > 100) {
        errors.password = 'Password must be between 4 and 100 characters.';
      }
    }

    if (!formData.authorities || formData.authorities.length === 0) {
      errors.authorities = 'Please select a role for this user.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError('');

    if (!validateForm(true)) {
      return;
    }

    setSubmitting(true);

    try {
      const payload: CreateUserData = {
        login: formData.login.trim().toLowerCase(),
        firstName: formData.firstName?.trim() || '',
        lastName: formData.lastName?.trim() || '',
        email: formData.email.trim().toLowerCase(),
        activated: formData.activated !== undefined ? formData.activated : true,
        langKey: 'en',
        authorities: formData.authorities && formData.authorities.length > 0
          ? formData.authorities
          : [USER_ROLES.WORK_VISA_COUNSELOR],
      };

      if (formData.password && formData.password.trim().length > 0) {
        payload.password = formData.password.trim();
      }

      await adminService.createUser(payload);

      setShowAddModal(false);
      setSuccessToast('User created successfully');
      setFormData(initialFormState);
      setFieldErrors({});
      await fetchUsers();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const errorMsg = String(err?.message || '').toLowerCase();
      const errorKey = String(err?.data?.errorKey || '').toLowerCase();
      const detail = String(err?.data?.detail || '').toLowerCase();
      const title = String(err?.data?.title || '').toLowerCase();

      if (status === 403) {
        setModalError('Access Denied: Only administrators can create staff accounts');
      } else if (
        status === 400 &&
        (errorKey.includes('userexists') ||
          detail.includes('login') ||
          title.includes('login') ||
          errorMsg.includes('userexists') ||
          errorMsg.includes('login already in use') ||
          errorMsg.includes('loginalreadyusedexception'))
      ) {
        setFieldErrors((prev) => ({ ...prev, login: 'Username already in use' }));
        setModalError('Username already in use. Please choose a different username.');
      } else if (
        status === 400 &&
        (errorKey.includes('emailexists') ||
          detail.includes('email') ||
          title.includes('email') ||
          errorMsg.includes('emailexists') ||
          errorMsg.includes('email already') ||
          errorMsg.includes('emailalreadyusedexception'))
      ) {
        setFieldErrors((prev) => ({ ...prev, email: 'Email already registered' }));
        setModalError('Email already registered. Please provide an unregistered email address.');
      } else {
        setModalError(
          err?.message ||
            'Failed to create user. Please review the inputs and try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setModalError('');

    if (!validateForm(false)) {
      return;
    }

    setSubmitting(true);

    try {
      await adminService.updateUser({
        ...editingUser,
        login: formData.login.trim().toLowerCase(),
        firstName: formData.firstName?.trim() || '',
        lastName: formData.lastName?.trim() || '',
        email: formData.email.trim().toLowerCase(),
        authorities: formData.authorities,
        activated: formData.activated,
        langKey: formData.langKey || 'en',
      });
      setEditingUser(null);
      setSuccessToast(`User "${formData.login}" updated successfully`);
      await fetchUsers();
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 403) {
        setModalError('Access Denied: Only administrators can update staff accounts');
      } else {
        setModalError(err?.message || 'Failed to update user.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setSubmitting(true);
    try {
      await adminService.deleteUser(deletingUser.login);
      setSuccessToast(`User "${deletingUser.login}" deleted successfully`);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(`Failed to delete user: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to get role name
  const getRoleName = (authorities: string[] = []) => {
    if (authorities.includes(USER_ROLES.ADMIN)) return 'Admin';
    if (authorities.includes(USER_ROLES.WORK_VISA_COUNSELOR)) return 'Work Visa Staff';
    if (authorities.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) return 'Study Visa Staff';
    if (authorities.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION))
      return 'Domestic College Admission Staff';
    return 'Staff';
  };

  // Paginated slice
  const paginatedUsers = useMemo(() => {
    const startIndex = page * pageSize;
    return users.slice(startIndex, startIndex + pageSize);
  }, [users, page, pageSize]);

  const totalPages = Math.ceil(users.length / pageSize) || 1;

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.activated).length;
    const admins = users.filter((u) => u.authorities?.includes(USER_ROLES.ADMIN)).length;
    const workVisa = users.filter((u) =>
      u.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR)
    ).length;
    const studyVisa = users.filter((u) =>
      u.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR)
    ).length;
    const domesticCollege = users.filter((u) =>
      u.authorities?.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION)
    ).length;
    return { total, active, admins, workVisa, studyVisa, domesticCollege };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* iOS Floating Success Toast */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#1c1c1e]/90 text-white backdrop-blur-md shadow-2xl text-xs font-medium transition-all">
          <CheckCircle2 size={16} className="text-[#34c759]" />
          <span>{successToast}</span>
          <button
            onClick={() => setSuccessToast('')}
            className="ml-2 text-white/60 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ios-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold text-[#1c1c1e] flex items-center gap-2">
            <span>User Management & Staff Accounts</span>
          </h2>
          <p className="text-xs text-[#8e8e93] mt-0.5">
            Administer staff roles, Work Visa, Study Visa, and Domestic College Admission team members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="ios-btn-gray text-xs"
            title="Refresh user list"
          >
            <RefreshCw
              size={13}
              className={loading ? 'animate-spin text-[#007aff]' : 'text-[#8e8e93]'}
            />
            <span>Refresh</span>
          </button>

          <button onClick={openCreateModal} className="ios-btn-primary text-xs">
            <UserPlus size={14} />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchUsers}
            className="px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-rose-800 hover:bg-rose-50 text-[11px] font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Apple HIG KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Users */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#8e8e93]">Total Staff</span>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.total}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">{stats.active} active</p>
        </div>

        {/* Work Visa Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#8e8e93]">Work Visa Staff</span>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.workVisa}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Overseas jobs</p>
        </div>

        {/* Study Visa Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#8e8e93]">Study Visa Staff</span>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.studyVisa}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">University desks</p>
        </div>

        {/* Domestic College Admission Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-[#8e8e93]">College Admission</span>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.domesticCollege}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Domestic admissions</p>
        </div>

        {/* Admins */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-[#8e8e93]">Administrators</span>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.admins}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Full access</p>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f2f2f7]/60 border-b border-[rgba(60,60,67,0.1)] text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider">
                <th className="py-3 px-4 w-16">ID</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(60,60,67,0.06)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8e8e93]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-[#007aff]" />
                      <p className="text-xs font-medium">Loading user directory...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8e8e93]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UsersIcon size={24} className="text-[#c7c7cc]" />
                      <p className="font-semibold text-[#1c1c1e]">No users found</p>
                      <p className="text-[11px] text-[#8e8e93] max-w-sm">
                        No staff accounts configured. Click "Create New User" to add one.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((item) => {
                  const isCurrent = currentUser?.login === item.login;
                  const fullName =
                    item.firstName || item.lastName
                      ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                      : '—';
                  const initial = (item.firstName?.[0] || item.login?.[0] || 'U').toUpperCase();

                  return (
                    <tr
                      key={item.login || item.id}
                      className="hover:bg-[#f2f2f7]/50 transition-colors"
                    >
                      {/* ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-[#8e8e93]">
                        #{item.id ?? '—'}
                      </td>

                      {/* Username */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.login}
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-[rgba(60,60,67,0.1)]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] uppercase shrink-0 bg-slate-100 text-slate-700 border border-[rgba(60,60,67,0.1)]">
                              {initial}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-[#1c1c1e] font-mono text-xs">
                              @{item.login}
                            </span>
                            {isCurrent && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-[#1c1c1e] rounded text-[9px] font-medium">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4 text-[#1c1c1e] font-medium">
                        {fullName}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-[#3c3c43]">
                        {item.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-[#8e8e93] shrink-0" />
                            <a
                              href={`mailto:${item.email}`}
                              className="hover:underline hover:text-[#007aff] truncate max-w-[200px]"
                            >
                              {item.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-[#c7c7cc] italic">No email</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4 text-[#1c1c1e]">
                        {getRoleName(item.authorities)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={item.activated ? 'text-[#1c1c1e]' : 'text-[#8e8e93]'}>
                          {item.activated ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit User"
                            className="p-1.5 text-[#3c3c43] hover:text-[#007aff] hover:bg-white rounded-lg border border-[rgba(60,60,67,0.1)] transition-colors shadow-2xs"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(item)}
                            disabled={isCurrent}
                            title={
                              isCurrent
                                ? 'You cannot delete your own account'
                                : 'Delete User'
                            }
                            className="p-1.5 text-[#8e8e93] hover:text-[#ff3b30] hover:bg-white rounded-lg border border-[rgba(60,60,67,0.1)] transition-colors shadow-2xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Strip */}
        <div className="p-3 bg-[#f2f2f7]/40 border-t border-[rgba(60,60,67,0.08)] flex items-center justify-between text-xs text-[#8e8e93]">
          <div>
            Showing{' '}
            <span className="font-semibold text-[#1c1c1e]">
              {users.length === 0 ? 0 : page * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-[#1c1c1e]">
              {Math.min((page + 1) * pageSize, users.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-[#1c1c1e]">{users.length}</span> users
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="ios-btn-gray p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-medium text-[#1c1c1e] text-[11px]">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              className="ios-btn-gray p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE NEW USER MODAL (Zoho CRM Modal & Field UI) */}
      {showAddModal && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Create Staff User
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner */}
            {modalError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Order Information
            </div>

            <form onSubmit={handleCreateUser} className="text-xs">
              {/* Username (Login) (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Username / Login">
                  Username (Login)
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={formData.login}
                    onChange={(e) => {
                      const clean = e.target.value.toLowerCase().replace(/\s+/g, '');
                      setFormData({ ...formData, login: clean });
                      if (fieldErrors.login) {
                        setFieldErrors((prev) => ({ ...prev, login: undefined }));
                      }
                    }}
                    className={`ios-input ios-input-required w-full font-mono ${
                      fieldErrors.login ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                    }`}
                  />
                  {fieldErrors.login && (
                    <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      <span>{fieldErrors.login}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Work Email (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Customer Email">
                  Customer Email
                </label>
                <div className="flex-1">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    className={`ios-input ios-input-required w-full ${
                      fieldErrors.email ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* First Name */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="First Name">
                  First Name
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Last Name">
                  Last Name
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Password">
                  Password
                </label>
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    className={`ios-input w-full pr-8 ${
                      fieldErrors.password ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {fieldErrors.password && (
                    <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Role Assignment Dropdown */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Role Assignment">
                  Product / Role
                </label>
                <div className="flex-1">
                  <select
                    value={formData.authorities?.[0] || USER_ROLES.WORK_VISA_COUNSELOR}
                    onChange={(e) => handleSelectRole(e.target.value)}
                    className={`zoho-select font-medium ${
                      fieldErrors.authorities ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                    }`}
                  >
                    {USER_ROLE_CONFIG.map((roleOpt) => (
                      <option key={roleOpt.value} value={roleOpt.value}>
                        {roleOpt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time (Compound Input matching screenshot) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="zoho-btn-done"
                >
                  {submitting ? 'Creating...' : 'Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL (Zoho CRM Modal & Field UI) */}
      {editingUser && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Edit User: @{editingUser.login}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Order Information
            </div>

            <form onSubmit={handleUpdateUser} className="text-xs">
              {/* User Login */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="User Login">
                  User ID
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    value={editingUser.login}
                    className="ios-input w-full font-mono text-slate-700 opacity-90 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Customer Email */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Customer Email">
                  Customer Email
                </label>
                <div className="flex-1">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="ios-input ios-input-required w-full"
                  />
                </div>
              </div>

              {/* First Name */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="First Name">
                  First Name
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Last Name">
                  Last Name
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Role Selection Dropdown */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Role Assignment">
                  Product / Role
                </label>
                <div className="flex-1">
                  <select
                    value={formData.authorities?.[0] || USER_ROLES.WORK_VISA_COUNSELOR}
                    onChange={(e) => handleSelectRole(e.target.value)}
                    className="zoho-select font-medium"
                  >
                    {USER_ROLE_CONFIG.map((roleOpt) => (
                      <option key={roleOpt.value} value={roleOpt.value}>
                        {roleOpt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="zoho-btn-done"
                >
                  {submitting ? 'Saving...' : 'Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md flex items-center justify-center p-4">
          <div className="ios-glass-modal max-w-sm w-full p-6 border border-white/60">
            <div className="flex items-center gap-3 mb-3 text-[#1c1c1e]">
              <div className="w-9 h-9 rounded-xl bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center border border-[#ff3b30]/20">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e]">Delete Staff User</h3>
                <p className="text-[11px] text-[#8e8e93]">Permanent account removal</p>
              </div>
            </div>
            <p className="text-xs text-[#3c3c43] mb-4 leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-[#1c1c1e] font-mono">@{deletingUser.login}</strong>? This
              action calls <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">DELETE /api/admin/users/{deletingUser.login}</code> and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(60,60,67,0.1)]">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="ios-btn-gray text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-4 py-2 rounded-full font-semibold bg-[#ff3b30] hover:bg-[#e0352b] text-white text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-red-500/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
