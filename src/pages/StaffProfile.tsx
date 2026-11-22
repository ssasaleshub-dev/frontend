import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Camera,
  Loader2,
  LogOut,
  User,
  ShieldCheck,
  Fingerprint,
  Lock,
  Mail,
  KeyRound,
  Edit3,
  Save,
  X,
  Copy,
  Check,
  Users,
  Briefcase,
  GraduationCap,
  Building2,
  Sparkles,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { getDisplayName, getRoleBadgeInfo, isAdmin as checkIsAdmin } from '../utils/rbac';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import { useBiometricAttendance } from '../hooks/useBiometricAttendance';
import { BiometricRegisterButton } from '../components/biometrics/BiometricRegisterButton';
import { BiometricSuccessModal } from '../components/biometrics/BiometricSuccessModal';
import fileService from '../services/api/fileService';
import authService from '../services/api/authService';
import { formatIndianTime } from '../utils/dateTimeUtils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffProfile() {
  const { user, updateUserAvatar, updateUserProfile, logout } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const isAdmin = checkIsAdmin(user);

  const displayName = getDisplayName(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const userInitial = (displayName?.[0] || user?.login?.[0] || 'S').toUpperCase();
  const userId = user?.login || (user?.id ? String(user.id) : '');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedUsername, setCopiedUsername] = useState(false);

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Attendance & Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(true);
  const [punching, setPunching] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Keep edit fields in sync if user changes
  useEffect(() => {
    if (user) {
      setEditFirstName(user.firstName || '');
      setEditLastName(user.lastName || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleCopyUsername = () => {
    if (!userId) return;
    navigator.clipboard?.writeText(userId);
    setCopiedUsername(true);
    showToast(`Copied @${userId} to clipboard`);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const loadAttendance = async () => {
    if (!userId) return;
    setLoadingAttendance(true);
    try {
      const [today, records] = await Promise.all([
        attendanceService.getTodayAttendance(userId).catch(() => null),
        attendanceService.getMyHistory(userId).catch(() => []),
      ]);
      if (today) setTodayRecord(today);
      if (Array.isArray(records)) setHistory(records);
    } catch (err) {
      console.warn('Failed loading attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    loadAttendance();

    const handleUpdate = () => loadAttendance();
    window.addEventListener('ssa_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
  }, [userId]);

  // Biometric Flow Hook
  const {
    biometricCred,
    enrollingBiometric,
    punching: punchingBiometric,
    successModal: checkInSuccessModal,
    closeSuccessModal,
    handleRegisterBiometric,
    handleBiometricCheckIn,
  } = useBiometricAttendance({
    userId,
    userName: displayName,
    userRole: badgeInfo.displayText,
    workMode: 'OFFICE',
    showToast,
    onSuccess: (res) => {
      setTodayRecord(res);
      loadAttendance();
    },
  });

  const handleCheckIn = async () => {
    await handleBiometricCheckIn();
  };

  const handleCheckOut = async () => {
    if (!userId) return;
    setPunching(true);
    try {
      const res = await attendanceService.checkOut({ userId });
      setTodayRecord(res);
      showToast('Checked out successfully!');
      loadAttendance();
    } catch (err: any) {
      showAlert({ title: 'Profile', message: `Check-out failed: ${err?.message || 'Server error'}` });
    } finally {
      setPunching(false);
    }
  };

  // Avatar Photo Upload
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert({ title: 'Invalid File', message: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await fileService.uploadFile(file, 'avatars');
      if (res?.url) {
        await updateUserAvatar(res.url);
        showToast('Profile photo updated successfully.');
      }
    } catch (err: any) {
      showAlert({ title: 'Profile', message: `Upload failed: ${err?.message || 'Server error'}` });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
        });
      } else {
        await authService.updateAccount({
          ...user,
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
        });
      }
      setIsEditingProfile(false);
      showToast('Profile details updated successfully.');
    } catch (err: any) {
      showAlert({ title: 'Profile Update', message: err?.message || 'Failed to update profile details.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showAlert({ title: 'Password', message: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 4) {
      showAlert({ title: 'Password', message: 'New password must be at least 4 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: 'Password', message: 'New passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      showToast('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      showAlert({
        title: 'Change Password Failed',
        message: err?.response?.data?.message || err?.message || 'Incorrect current password or server rejected update.'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Date map of attendance records
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, StaffAttendanceRecord>();
    history.forEach((rec) => {
      if (rec.attendanceDate) {
        map.set(rec.attendanceDate, rec);
      }
    });
    if (todayRecord?.attendanceDate) {
      map.set(todayRecord.attendanceDate, todayRecord);
    }
    return map;
  }, [history, todayRecord]);

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const prevMonthDaysCount = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      record?: StaffAttendanceRecord;
    }> = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDaysCount - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().substring(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
        record: attendanceByDate.get(dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysCount; d++) {
      const curDate = new Date(year, month, d);
      const yyyy = curDate.getFullYear();
      const mm = String(curDate.getMonth() + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: curDate.getDay() === 0 || curDate.getDay() === 6,
        record: attendanceByDate.get(dateStr),
      });
    }

    // Next month padding to fill grid
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().substring(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
        record: attendanceByDate.get(dateStr),
      });
    }

    return days;
  }, [year, month, attendanceByDate, todayStr]);

  const isCheckedIn = Boolean(todayRecord?.checkInTime);
  const isCheckedOut = Boolean(todayRecord?.checkOutTime);
  const isWorkingNow = isCheckedIn && !isCheckedOut;

  const formatTime = (iso?: string) => {
    if (!iso) return '-';
    return formatIndianTime(iso, { fallback: iso });
  };

  return (
    <div className="max-w-2xl mx-auto px-3.5 sm:px-6 py-4 pb-28 space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. Hero Profile Card ── */}
      <div className="bg-white rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden">
        {/* Banner Cover */}
        <div className="h-28 sm:h-32 bg-gradient-to-r from-blue-600/15 via-indigo-100/50 to-slate-100 relative p-3 sm:p-4 flex items-start justify-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Account
          </span>
        </div>

        {/* Profile Info Area */}
        <div className="px-5 sm:px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
            {/* Avatar with Camera Upload */}
            <div className="relative inline-block self-start">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl ring-4 ring-white shadow-md bg-white overflow-hidden flex items-center justify-center border border-black/[0.06]">
                {avatarUploading ? (
                  <Loader2 size={24} className="animate-spin text-[#007aff]" />
                ) : user?.imageUrl ? (
                  <img src={user.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-200 via-slate-100 to-white text-slate-700 text-3xl font-bold flex items-center justify-center">
                    {userInitial}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title="Update profile picture"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white shadow-md flex items-center justify-center cursor-pointer transition active:scale-95 border-2 border-white"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Quick Action in Header */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                {isEditingProfile ? (
                  <>
                    <X size={13} />
                    <span>Cancel Edit</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={13} />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User Name & Badges */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {displayName}
            </h1>
            <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
              <button
                type="button"
                onClick={handleCopyUsername}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-lg transition"
                title="Click to copy username"
              >
                <span>@{userId}</span>
                {copiedUsername ? <Check size={12} className="text-emerald-600" /> : <Copy size={11} />}
              </button>

              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  <ShieldCheck size={13} />
                  Administrator
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Briefcase size={13} />
                  {badgeInfo.displayText}
                </span>
              )}
            </div>
          </div>

          {/* Admin Fast Shortcut to User Directory */}
          {isAdmin && (
            <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-tight">Staff Management Directory</p>
                  <p className="text-[11px] text-slate-500 truncate">Manage staff accounts, access roles, and permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/users')}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-200 text-xs font-semibold transition active:scale-95 shrink-0 shadow-2xs"
              >
                View Staff →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Personal Information Card ── */}
      <div className="bg-white rounded-3xl border border-black/[0.08] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <User size={16} className="text-[#007aff]" />
            <h2>Personal Information</h2>
          </div>
          {!isEditingProfile && (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="text-xs font-semibold text-[#007aff] hover:underline flex items-center gap-1"
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="e.g. Kavin"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="e.g. M"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="name@ssaconsultancy.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-400">Full Name</p>
              <p className="font-semibold text-slate-900 mt-0.5">{displayName}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-400">Email Address</p>
              <p className="font-semibold text-slate-900 mt-0.5 truncate">{user?.email || 'Not configured'}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-400">Login Username</p>
              <p className="font-semibold text-slate-900 mt-0.5 font-mono">@{userId}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-medium text-slate-400">Assigned Department</p>
              <p className="font-semibold text-slate-900 mt-0.5">{badgeInfo.deskTitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Shift & Duty Attendance Hub ── */}
      <div className="bg-white rounded-3xl border border-black/[0.08] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Clock size={16} className="text-[#007aff]" />
            <h2>Duty & Shift Attendance</h2>
          </div>
          <BiometricRegisterButton
            credential={biometricCred}
            isLoading={enrollingBiometric}
            onRegister={handleRegisterBiometric}
            disabled={punching || punchingBiometric}
          />
        </div>

        {/* Live Duty Card */}
        {isWorkingNow ? (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">Currently On Duty</p>
                <p className="text-xs text-slate-500">
                  Checked in since {formatTime(todayRecord?.checkInTime)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={punching}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 shadow-2xs"
            >
              {punching ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
              <span>Check Out</span>
            </button>
          </div>
        ) : isCheckedOut ? (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-900">Shift Completed Today</span>
            </div>
            <span className="text-slate-600 font-mono font-semibold">{todayRecord?.totalHoursFormatted}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={punching}
            className="w-full py-3 rounded-2xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {punching ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
            <span>Check In for Today</span>
          </button>
        )}

        {/* Attendance Calendar Grid */}
        <div className="pt-2">
          {/* Month Header */}
          <div className="flex items-center justify-between pb-2.5 mb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentMonthDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft size={15} />
              </button>
              <h3 className="text-xs font-bold text-slate-900 px-1">
                {MONTH_NAMES[month]} {year}
              </h3>
              <button
                type="button"
                onClick={() => setCurrentMonthDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="Next month"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentMonthDate(new Date());
                setSelectedDateStr(new Date().toISOString().substring(0, 10));
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Today
            </button>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400 py-1">
            {WEEKDAYS.map((w, idx) => (
              <div key={w} className={idx === 0 || idx === 6 ? 'text-slate-300' : ''}>
                {w}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 mt-0.5">
            {calendarDays.map((d, index) => {
              const rec = d.record;
              const hasCheckedIn = Boolean(rec?.checkInTime);
              const isSelected = d.dateStr === selectedDateStr;
              const isLate = rec?.status === 'LATE';

              return (
                <button
                  key={`${d.dateStr}-${index}`}
                  type="button"
                  onClick={() => setSelectedDateStr(d.dateStr)}
                  className={`h-10 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                    isSelected
                      ? 'ring-2 ring-[#007aff] bg-blue-50/50'
                      : 'hover:bg-slate-50'
                  } ${!d.isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  <span
                    className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full leading-none ${
                      d.isToday
                        ? 'bg-[#007aff] text-white font-bold'
                        : d.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {d.dayNumber}
                  </span>

                  <div className="h-1.5 flex items-center justify-center mt-0.5">
                    {hasCheckedIn ? (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isLate ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    ) : d.isWeekend && d.isCurrentMonth && !d.isToday ? (
                      <span className="text-[8px] text-slate-300 leading-none">·</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. Security & Password Card ── */}
      <div className="bg-white rounded-3xl border border-black/[0.08] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Lock size={16} className="text-[#007aff]" />
            <h2>Security & Password</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="text-xs font-semibold text-[#007aff] hover:underline flex items-center gap-1"
          >
            <KeyRound size={12} />
            <span>{showPasswordSection ? 'Hide' : 'Change Password'}</span>
          </button>
        </div>

        {showPasswordSection ? (
          <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                {passwordLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs">
            <div>
              <p className="font-semibold text-slate-900">Account Password</p>
              <p className="text-slate-500 text-[11px] mt-0.5">Protected with high-security hash encryption</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordSection(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Update
            </button>
          </div>
        )}
      </div>

      {/* ── 5. App Version & Sign Out Card ── */}
      <div className="bg-white rounded-3xl border border-black/[0.08] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Application</span>
          <span className="font-mono font-medium">SSA CRM v1.0.36</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-[#ff3b30] border border-red-200/80 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut size={15} />
          <span>Log Out of Account</span>
        </button>
      </div>

      {/* Biometric Confirmation Modal */}
      <BiometricSuccessModal
        isOpen={Boolean(checkInSuccessModal?.isOpen)}
        onClose={closeSuccessModal}
        userName={displayName}
        userId={userId}
        timestamp={checkInSuccessModal?.timestamp || ''}
        deviceId={checkInSuccessModal?.deviceName}
      />
    </div>
  );
}
