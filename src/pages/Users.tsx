import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  Briefcase,
  GraduationCap,
  School,
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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  // Helper to render role badge in table with iOS capsule badge styling
  const getDepartmentBadge = (authorities: string[] = []) => {
    if (authorities.includes(USER_ROLES.ADMIN)) {
      return (
        <span className="ios-badge ios-badge-indigo">
          <ShieldCheck size={12} />
          <span>Admin</span>
        </span>
      );
    }
    if (authorities.includes(USER_ROLES.WORK_VISA_COUNSELOR)) {
      return (
        <span className="ios-badge ios-badge-blue">
          <Briefcase size={12} />
          <span>Work Visa Staff</span>
        </span>
      );
    }
    if (authorities.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) {
      return (
        <span className="ios-badge ios-badge-green">
          <GraduationCap size={12} />
          <span>Study Visa Staff</span>
        </span>
      );
    }
    if (authorities.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION)) {
      return (
        <span className="ios-badge ios-badge-orange">
          <School size={12} />
          <span>Domestic College Admission Staff</span>
        </span>
      );
    }
    return (
      <span className="ios-badge ios-badge-gray">
        <UserIcon size={12} />
        <span>Staff Desk</span>
      </span>
    );
  };

  // Filtered and searched list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        (u.login || '').toLowerCase().includes(query) ||
        (u.firstName || '').toLowerCase().includes(query) ||
        (u.lastName || '').toLowerCase().includes(query) ||
        (u.email || '').toLowerCase().includes(query) ||
        String(u.id || '').includes(query);

      const matchRole =
        roleFilter === 'ALL' ||
        (roleFilter === USER_ROLES.ADMIN && u.authorities?.includes(USER_ROLES.ADMIN)) ||
        (roleFilter === USER_ROLES.WORK_VISA_COUNSELOR &&
          u.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR)) ||
        (roleFilter === USER_ROLES.STUDY_VISA_COUNSELOR &&
          u.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) ||
        (roleFilter === USER_ROLES.DOMESTIC_COLLEGE_ADMISSION &&
          u.authorities?.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.activated) ||
        (statusFilter === 'INACTIVE' && !u.activated);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Paginated slice
  const paginatedUsers = useMemo(() => {
    const startIndex = page * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, page, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;

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
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8e8e93]">Total Staff</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <UsersIcon size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.total}</p>
          <p className="text-[10px] text-[#34c759] font-medium mt-0.5">{stats.active} active</p>
        </div>

        {/* Work Visa Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8e8e93]">Work Visa Staff</span>
            <div className="w-7 h-7 rounded-lg bg-[#007aff]/10 text-[#007aff] flex items-center justify-center">
              <Briefcase size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.workVisa}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Overseas jobs</p>
        </div>

        {/* Study Visa Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8e8e93]">Study Visa Staff</span>
            <div className="w-7 h-7 rounded-lg bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
              <GraduationCap size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.studyVisa}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">University desks</p>
        </div>

        {/* Domestic College Admission Staff */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8e8e93]">College Admission</span>
            <div className="w-7 h-7 rounded-lg bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center">
              <School size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.domesticCollege}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Domestic admissions</p>
        </div>

        {/* Admins */}
        <div className="ios-card ios-card-hover p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8e8e93]">Administrators</span>
            <div className="w-7 h-7 rounded-lg bg-[#5856d6]/10 text-[#5856d6] flex items-center justify-center">
              <ShieldCheck size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-[#1c1c1e] mt-2">{stats.admins}</p>
          <p className="text-[10px] text-[#8e8e93] mt-0.5">Full access</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="ios-card p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by ID, username, name, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full pl-9 pr-3 py-2 bg-[rgba(118,118,128,0.08)] border border-[rgba(60,60,67,0.1)] rounded-xl text-xs text-[#1c1c1e] placeholder-[#8e8e93] focus:outline-none focus:bg-white focus:border-[#007aff] transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 bg-white border border-[rgba(60,60,67,0.15)] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:border-[#007aff] shadow-2xs"
          >
            <option value="ALL">All Roles</option>
            <option value={USER_ROLES.WORK_VISA_COUNSELOR}>Work Visa Staff</option>
            <option value={USER_ROLES.STUDY_VISA_COUNSELOR}>Study Visa Staff</option>
            <option value={USER_ROLES.DOMESTIC_COLLEGE_ADMISSION}>
              Domestic College Admission Staff
            </option>
            <option value={USER_ROLES.ADMIN}>Administrators</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 bg-white border border-[rgba(60,60,67,0.15)] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:border-[#007aff] shadow-2xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setPage(0);
              }}
              className="text-xs text-[#007aff] hover:underline px-1 py-1 font-medium"
            >
              Reset
            </button>
          )}
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
                <th className="py-3 px-4">Role Badge</th>
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
                        {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or clearing filters.'
                          : 'No staff accounts configured. Click "Create New User" to add one.'}
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
                          <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] uppercase shrink-0 bg-slate-100 text-slate-700 border border-[rgba(60,60,67,0.1)]">
                            {initial}
                          </div>
                          <div>
                            <span className="font-semibold text-[#1c1c1e] font-mono text-xs">
                              @{item.login}
                            </span>
                            {isCurrent && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-[#007aff]/10 text-[#007aff] rounded-full text-[9px] font-semibold">
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

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {getDepartmentBadge(item.authorities)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {item.activated ? (
                          <span className="ios-badge ios-badge-green">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="ios-badge ios-badge-gray">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e93]" />
                            <span>Inactive</span>
                          </span>
                        )}
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
              {filteredUsers.length === 0 ? 0 : page * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-[#1c1c1e]">
              {Math.min((page + 1) * pageSize, filteredUsers.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-[#1c1c1e]">{filteredUsers.length}</span> users
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

      {/* CREATE NEW USER MODAL (Apple iOS HIG Frosted Glass) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="ios-glass-modal max-w-lg w-full p-6 my-6 border border-white/60">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(60,60,67,0.1)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#007aff] text-white flex items-center justify-center shadow-md">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c1e]">Create New Staff User</h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Configure credentials, desk role, and login authorization
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-[rgba(118,118,128,0.12)] flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[rgba(118,118,128,0.2)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Error Banner */}
            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4 text-xs">
              {/* Username (Login) */}
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1">
                  Username (Login) <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. staff_work1 or rahul.sharma"
                  value={formData.login}
                  onChange={(e) => {
                    const clean = e.target.value.toLowerCase().replace(/\s+/g, '');
                    setFormData({ ...formData, login: clean });
                    if (fieldErrors.login) {
                      setFieldErrors((prev) => ({ ...prev, login: undefined }));
                    }
                  }}
                  className={`w-full ios-input font-mono ${
                    fieldErrors.login ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                  }`}
                />
                {fieldErrors.login ? (
                  <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{fieldErrors.login}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-[#8e8e93] mt-1">
                    1–50 characters. Letters, numbers, dot, underscore, dash only (automatically lowercased).
                  </p>
                )}
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">
                    First Name <span className="text-[10px] text-[#8e8e93] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="Rahul"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">
                    Last Name <span className="text-[10px] text-[#8e8e93] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="Sharma"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1">
                  Email Address <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="rahul.work@company.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  className={`w-full ios-input ${
                    fieldErrors.email ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                  }`}
                />
                {fieldErrors.email ? (
                  <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{fieldErrors.email}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-[#8e8e93] mt-1">
                    Must be a valid, unique email address (5–254 characters).
                  </p>
                )}
              </div>

              {/* Temporary Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-[#1c1c1e]">
                    Temporary Password
                  </label>
                  <span className="text-[10px] text-[#8e8e93]">Optional (min 4 characters)</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank for auto-generated password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    className={`w-full ios-input pr-10 ${
                      fieldErrors.password ? 'border-[#ff3b30] ring-1 ring-[#ff3b30]' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8e8e93] hover:text-[#1c1c1e]"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{fieldErrors.password}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-[#8e8e93] mt-1">
                    If provided, user can log in immediately. If omitted, backend generates a random password.
                  </p>
                )}
              </div>

              {/* Role Assignment (4 System Roles) */}
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1.5">
                  Role Assignment <span className="text-[#ff3b30]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USER_ROLE_CONFIG.map((roleOpt) => {
                    const isSelected = formData.authorities?.includes(roleOpt.value);
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleSelectRole(roleOpt.value)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#007aff] bg-[#007aff]/5 ring-1 ring-[#007aff]'
                            : 'border-[rgba(60,60,67,0.12)] hover:border-[rgba(60,60,67,0.25)] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[#1c1c1e] text-xs flex items-center gap-1.5">
                            {roleOpt.value === USER_ROLES.WORK_VISA_COUNSELOR && (
                              <Briefcase size={13} className="text-[#007aff]" />
                            )}
                            {roleOpt.value === USER_ROLES.STUDY_VISA_COUNSELOR && (
                              <GraduationCap size={13} className="text-[#34c759]" />
                            )}
                            {roleOpt.value === USER_ROLES.DOMESTIC_COLLEGE_ADMISSION && (
                              <School size={13} className="text-[#ff9500]" />
                            )}
                            {roleOpt.value === USER_ROLES.ADMIN && (
                              <ShieldCheck size={13} className="text-[#5856d6]" />
                            )}
                            <span>{roleOpt.label}</span>
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#007aff] text-white flex items-center justify-center">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-[#8e8e93] leading-snug">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.authorities && (
                  <p className="text-[11px] text-[#ff3b30] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{fieldErrors.authorities}</span>
                  </p>
                )}
              </div>

              {/* Status Activated iOS Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[rgba(118,118,128,0.06)] border border-[rgba(60,60,67,0.08)]">
                <div>
                  <p className="font-semibold text-[#1c1c1e] text-xs">Account Status (Activated)</p>
                  <p className="text-[10px] text-[#8e8e93]">
                    Enables login immediately upon creation
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.activated}
                  onClick={() =>
                    setFormData({ ...formData, activated: !formData.activated })
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.activated ? 'bg-[#34c759]' : 'bg-[#e5e5ea]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      formData.activated ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(60,60,67,0.1)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ios-btn-gray"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ios-btn-primary disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>Create Staff User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL (Apple iOS HIG Frosted Glass) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="ios-glass-modal max-w-lg w-full p-6 my-6 border border-white/60">
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(60,60,67,0.1)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                  <Edit2 size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1c1c1e]">
                    Edit User: @{editingUser.login}
                  </h3>
                  <p className="text-[11px] text-[#8e8e93]">
                    Update personal profile, assigned role, or active status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-7 h-7 rounded-full bg-[rgba(118,118,128,0.12)] flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[rgba(118,118,128,0.2)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">First Name</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">Last Name</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1">
                  Email Address <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full ios-input"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1.5">
                  Role Assignment <span className="text-[#ff3b30]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USER_ROLE_CONFIG.map((roleOpt) => {
                    const isSelected = formData.authorities?.includes(roleOpt.value);
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleSelectRole(roleOpt.value)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#007aff] bg-[#007aff]/5 ring-1 ring-[#007aff]'
                            : 'border-[rgba(60,60,67,0.12)] hover:border-[rgba(60,60,67,0.25)] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[#1c1c1e] text-xs flex items-center gap-1.5">
                            {roleOpt.value === USER_ROLES.WORK_VISA_COUNSELOR && (
                              <Briefcase size={13} className="text-[#007aff]" />
                            )}
                            {roleOpt.value === USER_ROLES.STUDY_VISA_COUNSELOR && (
                              <GraduationCap size={13} className="text-[#34c759]" />
                            )}
                            {roleOpt.value === USER_ROLES.DOMESTIC_COLLEGE_ADMISSION && (
                              <School size={13} className="text-[#ff9500]" />
                            )}
                            {roleOpt.value === USER_ROLES.ADMIN && (
                              <ShieldCheck size={13} className="text-[#5856d6]" />
                            )}
                            <span>{roleOpt.label}</span>
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#007aff] text-white flex items-center justify-center">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-[#8e8e93] leading-snug">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Activated iOS Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[rgba(118,118,128,0.06)] border border-[rgba(60,60,67,0.08)]">
                <div>
                  <p className="font-semibold text-[#1c1c1e] text-xs">Account Status (Activated)</p>
                  <p className="text-[10px] text-[#8e8e93]">Enable or disable login access</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.activated}
                  onClick={() =>
                    setFormData({ ...formData, activated: !formData.activated })
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.activated ? 'bg-[#34c759]' : 'bg-[#e5e5ea]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      formData.activated ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(60,60,67,0.1)]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="ios-btn-gray"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ios-btn-primary disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
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
