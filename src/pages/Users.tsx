import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  Briefcase,
  GraduationCap,
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
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const hasLoadedRef = useRef<boolean>(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');
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
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const openCreateModal = () => {
    setFormData(initialFormState);
    setModalError('');
    setShowPassword(false);
    setShowAddModal(true);
  };

  const openEditModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setFormData({
      login: targetUser.login || '',
      firstName: targetUser.firstName || '',
      lastName: targetUser.lastName || '',
      email: targetUser.email || '',
      password: '',
      authorities: targetUser.authorities?.length ? targetUser.authorities : [USER_ROLES.GENERAL_USER],
      activated: targetUser.activated !== undefined ? targetUser.activated : true,
      langKey: targetUser.langKey || 'en',
    });
    setModalError('');
    setShowPassword(false);
  };

  const handleSelectPrimaryRole = (role: string) => {
    // When selecting a primary role, keep it as the assigned authority
    setFormData((prev) => ({
      ...prev,
      authorities: [role],
    }));
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      await adminService.createUser(formData);
      setShowAddModal(false);
      setSuccessMessage(`User "${formData.login}" was successfully created.`);
      await fetchUsers();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create user. Please verify user details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setModalError('');
    setSubmitting(true);

    try {
      await adminService.updateUser({
        ...editingUser,
        login: formData.login,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        authorities: formData.authorities,
        activated: formData.activated,
        langKey: formData.langKey,
      });
      setEditingUser(null);
      setSuccessMessage(`User "${formData.login}" was successfully updated.`);
      await fetchUsers();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setSubmitting(true);
    try {
      await adminService.deleteUser(deletingUser.login);
      setSuccessMessage(`User "${deletingUser.login}" has been deleted.`);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(`Failed to delete user: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to render role badge in table
  const getDepartmentBadge = (authorities: string[] = []) => {
    if (authorities.includes(USER_ROLES.ADMIN)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-white border border-slate-900">
          <ShieldCheck size={12} className="text-slate-300" />
          <span>Admin</span>
        </span>
      );
    }
    if (authorities.includes(USER_ROLES.WORK_VISA_COUNSELOR)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Briefcase size={12} className="text-emerald-700" />
          <span>Work Visa Counselor</span>
        </span>
      );
    }
    if (authorities.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <GraduationCap size={12} className="text-indigo-700" />
          <span>Study Visa Counselor</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <UserIcon size={12} className="text-slate-500" />
        <span>General Counselor</span>
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
        (u.email || '').toLowerCase().includes(query);

      const matchRole =
        roleFilter === 'ALL' ||
        (roleFilter === USER_ROLES.ADMIN && u.authorities?.includes(USER_ROLES.ADMIN)) ||
        (roleFilter === USER_ROLES.WORK_VISA_COUNSELOR && u.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR)) ||
        (roleFilter === USER_ROLES.STUDY_VISA_COUNSELOR && u.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) ||
        (roleFilter === USER_ROLES.GENERAL_USER &&
          u.authorities?.includes(USER_ROLES.GENERAL_USER) &&
          !u.authorities?.includes(USER_ROLES.ADMIN) &&
          !u.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR) &&
          !u.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.activated) ||
        (statusFilter === 'INACTIVE' && !u.activated);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.activated).length;
    const admins = users.filter((u) => u.authorities?.includes(USER_ROLES.ADMIN)).length;
    const workVisaCounselors = users.filter((u) => u.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR)).length;
    const studyVisaCounselors = users.filter((u) => u.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR)).length;
    return { total, active, admins, workVisaCounselors, studyVisaCounselors };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>Counselor & Team Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Work Visa counselors, Study Visa counselors, and system administrators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-medium shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh user directory"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium shadow-2xs transition-colors"
          >
            <UserPlus size={14} />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-md text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchUsers}
            className="px-2.5 py-1 bg-white border border-rose-300 rounded text-rose-800 hover:bg-rose-50 text-[11px] font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Department KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Team</span>
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-md">
              <UsersIcon size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.active} active accounts</p>
        </div>

        {/* Work Visa Counselors */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Work Visa Desk</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
              <Briefcase size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.workVisaCounselors}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Overseas employment counselors</p>
        </div>

        {/* Study Visa Counselors */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Study Visa Desk</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-800 rounded-md border border-indigo-200">
              <GraduationCap size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.studyVisaCounselors}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">University admissions counselors</p>
        </div>

        {/* Admins */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Administrators</span>
            <span className="p-1.5 bg-slate-100 text-slate-800 rounded-md">
              <ShieldCheck size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.admins}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Full access & user control</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search team members by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Department / Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-2xs"
          >
            <option value="ALL">All Roles & Desks</option>
            <option value={USER_ROLES.WORK_VISA_COUNSELOR}>Work Visa Counselors</option>
            <option value={USER_ROLES.STUDY_VISA_COUNSELOR}>Study Visa Counselors</option>
            <option value={USER_ROLES.ADMIN}>Administrators</option>
            <option value={USER_ROLES.GENERAL_USER}>General Counselors</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-2xs"
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
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline px-1 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* User Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Counselor / User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Department / Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-slate-500" />
                      <p className="text-xs">Loading user directory...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UsersIcon size={24} className="text-slate-300" />
                      <p className="font-medium text-slate-600">No users found</p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or clearing filters.'
                          : 'No user accounts found. Click "Create New User" to add a counselor.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isCurrent = currentUser?.login === item.login;
                  const displayName =
                    item.firstName || item.lastName
                      ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                      : item.login;
                  const initial = (displayName?.[0] || item.login?.[0] || 'U').toUpperCase();

                  return (
                    <tr
                      key={item.login || item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 bg-slate-100 text-slate-700 border border-slate-200">
                            {initial}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">{displayName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              @{item.login}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-600">
                        {item.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${item.email}`}
                              className="hover:underline hover:text-slate-900 truncate max-w-[200px]"
                            >
                              {item.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No email</span>
                        )}
                      </td>

                      {/* Department Badge */}
                      <td className="py-3 px-4">
                        {getDepartmentBadge(item.authorities)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {item.activated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-400 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <div>{item.createdBy || 'System'}</div>
                        {item.createdDate && (
                          <div className="text-[10px] text-slate-400">
                            {new Date(item.createdDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit User"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(item)}
                            disabled={isCurrent}
                            title={isCurrent ? "You cannot delete your own account" : "Delete User"}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
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
      </div>

      {/* CREATE NEW USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-900 text-white rounded-md">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Create New Team Member</h3>
                  <p className="text-[11px] text-slate-500">
                    Add a new counselor or administrator to the Visa CRM
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4 text-xs">
              {/* Login / Username */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Username (Login) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. counselor_work1 or priya"
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      login: e.target.value.toLowerCase().replace(/\s+/g, ''),
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lowercase letters, digits, and dots or underscores only.
                </p>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="Praveen"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="Kumar"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="counselor@visaconsultancy.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-slate-700">Initial Password</label>
                  <span className="text-[10px] text-slate-400">(Optional / min 4 chars)</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank for system default"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Department & Role Selector */}
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Assigned Department / Role <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USER_ROLE_CONFIG.map((roleOpt) => {
                    const isSelected = formData.authorities?.includes(roleOpt.value);
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleSelectPrimaryRole(roleOpt.value)}
                        className={`p-3 rounded-md border text-left transition-colors flex flex-col justify-between ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            {roleOpt.value === USER_ROLES.WORK_VISA_COUNSELOR && (
                              <Briefcase size={13} className="text-emerald-700" />
                            )}
                            {roleOpt.value === USER_ROLES.STUDY_VISA_COUNSELOR && (
                              <GraduationCap size={13} className="text-indigo-700" />
                            )}
                            {roleOpt.value === USER_ROLES.ADMIN && (
                              <ShieldCheck size={13} className="text-slate-800" />
                            )}
                            {roleOpt.value === USER_ROLES.GENERAL_USER && (
                              <UserIcon size={13} className="text-slate-600" />
                            )}
                            <span>{roleOpt.label}</span>
                          </span>
                          {isSelected && <Check size={13} className="text-slate-900 font-bold" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Activated Switch */}
              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900 text-xs">Active Account</p>
                  <p className="text-[10px] text-slate-500">Allow this user to sign in immediately</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.activated}
                  onChange={(e) => setFormData({ ...formData, activated: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? 'Creating...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-md">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Edit Counselor: @{editingUser.login}
                  </h3>
                  <p className="text-[11px] text-slate-500">Update account profile and department</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Department & Role Selection */}
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Assigned Department / Role <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USER_ROLE_CONFIG.map((roleOpt) => {
                    const isSelected = formData.authorities?.includes(roleOpt.value);
                    return (
                      <button
                        key={roleOpt.value}
                        type="button"
                        onClick={() => handleSelectPrimaryRole(roleOpt.value)}
                        className={`p-3 rounded-md border text-left transition-colors flex flex-col justify-between ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            {roleOpt.value === USER_ROLES.WORK_VISA_COUNSELOR && (
                              <Briefcase size={13} className="text-emerald-700" />
                            )}
                            {roleOpt.value === USER_ROLES.STUDY_VISA_COUNSELOR && (
                              <GraduationCap size={13} className="text-indigo-700" />
                            )}
                            {roleOpt.value === USER_ROLES.ADMIN && (
                              <ShieldCheck size={13} className="text-slate-800" />
                            )}
                            {roleOpt.value === USER_ROLES.GENERAL_USER && (
                              <UserIcon size={13} className="text-slate-600" />
                            )}
                            <span>{roleOpt.label}</span>
                          </span>
                          {isSelected && <Check size={13} className="text-slate-900 font-bold" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{roleOpt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Activated Switch */}
              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900 text-xs">Account Active</p>
                  <p className="text-[10px] text-slate-500">Enable or disable login access</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.activated}
                  onChange={(e) => setFormData({ ...formData, activated: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 flex items-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3 text-slate-900">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                <Trash2 size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Delete User Account</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-slate-900 font-mono">@{deletingUser.login}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-4 py-1.5 rounded-md font-medium bg-rose-600 hover:bg-rose-700 text-white text-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
