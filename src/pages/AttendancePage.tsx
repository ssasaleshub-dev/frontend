import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Users,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Building2,
  MapPin,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2,
  UserCheck,
  Briefcase,
  Fingerprint,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { SkeletonBlock, SkeletonCircle } from '../components/common/SkeletonLoader';
import { isAdmin as checkIsAdmin, getDisplayName, getRoleBadgeInfo } from '../utils/rbac';
import attendanceService, {
  StaffAttendanceRecord,
  AttendanceAdminSummary,
} from '../services/api/attendanceService';
import adminService from '../services/api/adminService';
import { useBiometricAttendance } from '../hooks/useBiometricAttendance';
import { BiometricRegisterButton } from '../components/biometrics/BiometricRegisterButton';
import { BiometricSuccessModal } from '../components/biometrics/BiometricSuccessModal';
import { PhoneApprovalSheet } from '../components/biometrics/PhoneApprovalSheet';
import attendanceVerificationService, {
  AttendanceVerification,
  describeRequestSource,
} from '../services/api/attendanceVerificationService';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { formatIndianTime } from '../utils/dateTimeUtils';
import { extractLocationFromNote } from '../utils/locationUtils';
import type { User } from '../types';

export default function AttendancePage() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const isAdmin = checkIsAdmin(user);
  const displayName = getDisplayName(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const currentUserId = user?.login || (user?.id ? String(user.id) : '');

  // Live IST Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');

  // Personal punch state
  const [myTodayRecord, setMyTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [selectedMode, setSelectedMode] = useState<'OFFICE' | 'REMOTE' | 'FIELD'>('OFFICE');
  const [punchNote, setPunchNote] = useState<string>('');
  const [liveDuration, setLiveDuration] = useState<string>('');

  // Admin Roster state
  const [rosterRecords, setRosterRecords] = useState<StaffAttendanceRecord[]>([]);
  const [adminSummary, setAdminSummary] = useState<AttendanceAdminSummary | null>(null);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH'>('TODAY');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Live IST Clock ticking
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateFormatted(
        now.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute date range based on dateFilter
  const dateRange = useMemo(() => {
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().substring(0, 10);

    if (dateFilter === 'TODAY') {
      const d = formatYMD(today);
      return { from: d, to: d };
    }
    if (dateFilter === 'YESTERDAY') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = formatYMD(y);
      return { from: d, to: d };
    }
    if (dateFilter === 'LAST_7') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      return { from: formatYMD(past), to: formatYMD(today) };
    }
    // THIS_MONTH
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatYMD(firstDay), to: formatYMD(today) };
  }, [dateFilter]);

  // Load personal today's punch (Staff / Counselors Only)
  const loadMyToday = async () => {
    if (!currentUserId || isAdmin) return;
    try {
      const res = await attendanceService.getTodayAttendance(currentUserId);
      setMyTodayRecord(res);
      if (res?.workMode && ['OFFICE', 'REMOTE', 'FIELD'].includes(res.workMode)) {
        setSelectedMode(res.workMode as 'OFFICE' | 'REMOTE' | 'FIELD');
      }

      // Re-sync the registered fingerprint (state lives in useBiometricAttendance)
      refreshBiometric();
    } catch (err) {
      console.warn('Failed loading my attendance:', err);
    }
  };

  // Load Admin Data (Roster + Summary + Users list)
  const loadAdminData = async () => {
    // Roster and summary are admin-only endpoints (the server answers 403 for staff), so
    // staff accounts never request them.
    if (!isAdmin) return;
    setLoadingRoster(true);
    try {
      const [records, summary, usersList] = await Promise.all([
        attendanceService.getAllAttendanceAdmin(
          dateRange.from,
          dateRange.to,
          staffFilter !== 'ALL' ? staffFilter : undefined
        ),
        attendanceService.getAdminSummary(dateRange.to),
        isAdmin ? adminService.getUsers(0, 100).catch(() => []) : Promise.resolve([]),
      ]);
      setRosterRecords(records);
      setAdminSummary(summary);
      if (Array.isArray(usersList) && usersList.length > 0) {
        setSystemUsers(usersList);
      }
    } catch (err) {
      console.warn('Failed loading admin attendance:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    loadMyToday();
    loadAdminData();

    const handleUpdate = () => {
      loadMyToday();
      loadAdminData();
    };

    window.addEventListener('ssa_attendance_updated', handleUpdate);
    window.addEventListener('app:pull-to-refresh', handleUpdate);
    return () => {
      window.removeEventListener('ssa_attendance_updated', handleUpdate);
      window.removeEventListener('app:pull-to-refresh', handleUpdate);
    };
  }, [currentUserId, isAdmin, dateRange, staffFilter]);

  // Live timer for personal shift
  useEffect(() => {
    if (!myTodayRecord?.checkInTime || myTodayRecord?.checkOutTime) {
      setLiveDuration('');
      return;
    }

    const calcDuration = () => {
      const start = new Date(myTodayRecord.checkInTime!).getTime();
      const diffMs = Math.max(0, Date.now() - start);
      const totalSec = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setLiveDuration(
        `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      );
    };

    calcDuration();
    const timer = setInterval(calcDuration, 1000);
    return () => clearInterval(timer);
  }, [myTodayRecord]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Enterprise Custom Hook for Biometric Flow
  const {
    biometricCred,
    enrollingBiometric,
    punching,
    successModal: checkInSuccessModal,
    closeSuccessModal,
    handleRegisterBiometric,
    handleBiometricCheckIn,
    refreshBiometric,
    phoneApproval,
    cancelPhoneApproval,
  } = useBiometricAttendance({
    userId: currentUserId,
    userName: displayName,
    userRole: badgeInfo.displayText,
    workMode: selectedMode,
    note: punchNote,
    showToast,
    onSuccess: (result) => {
      setMyTodayRecord(result);
      setPunchNote('');
      loadAdminData();
    },
  });

  const navigate = useNavigate();
  const isNativeApp = Capacitor.isNativePlatform();
  const hasUsableFingerprint = Boolean(
    (biometricCred?.isLocked || biometricCred?.status === 'LOCKED') && biometricCred?.publicKey
  );

  // In the app: surface a web check-in that is waiting for this phone's approval (in case the
  // push notification was missed)
  const [pendingWebRequest, setPendingWebRequest] = useState<AttendanceVerification | null>(null);
  useEffect(() => {
    if (!isNativeApp || isAdmin || !currentUserId) return;
    let active = true;
    const check = () =>
      attendanceVerificationService
        .getPending()
        .then((p) => active && setPendingWebRequest(p && p.source === 'WEB' ? p : null))
        .catch(() => {});
    check();
    const timer = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isNativeApp, isAdmin, currentUserId]);

  // Check-out progress (check-in progress is tracked by the biometric hook)
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const isPunchBusy = punching || checkingOut;

  // Check In
  const handleCheckIn = async () => {
    await handleBiometricCheckIn();
  };

  // Check Out
  const handleCheckOut = async () => {
    if (!currentUserId) return;
    const confirmed = await showConfirm({
      title: 'Clock Out',
      message: 'Are you ready to clock out and end your shift?',
      confirmText: 'Clock Out',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    setCheckingOut(true);
    try {
      const result = await attendanceService.checkOut({
        userId: currentUserId,
        note: punchNote.trim(),
      });
      setMyTodayRecord(result);
      setPunchNote('');
      showToast('Shift completed and checked out.');
      loadAdminData();
    } catch (err: any) {
      showAlert({ title: 'Attendance', message: `Check-out failed: ${err?.message || 'Server error'}` });
    } finally {
      setCheckingOut(false);
    }
  };

  // Filtered Roster for Table (Excludes Administrator Accounts)
  const filteredRoster = useMemo(() => {
    return rosterRecords.filter((rec) => {
      // Exclude admin / administrator accounts from staff roster table
      const lowerUserId = (rec.userId || '').toLowerCase().trim();
      const lowerRole = (rec.userRole || '').toLowerCase().trim();
      const lowerName = (rec.userName || '').toLowerCase().trim();
      if (
        lowerUserId === 'admin' ||
        lowerUserId === 'administrator' ||
        lowerRole === 'admin' ||
        lowerRole === 'administrator' ||
        lowerName.includes('administrator') ||
        systemUsers.some(
          (u) =>
            u.login?.toLowerCase() === lowerUserId &&
            (u.login?.toLowerCase() === 'admin' || u.authorities?.includes('ROLE_ADMIN'))
        )
      ) {
        return false;
      }

      // Staff filter
      if (staffFilter !== 'ALL' && rec.userId !== staffFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'WORKING' && (!rec.checkInTime || rec.checkOutTime)) {
          return false;
        }
        if (statusFilter !== 'WORKING' && rec.status !== statusFilter) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (rec.userName || '').toLowerCase().includes(q);
        const userMatch = (rec.userId || '').toLowerCase().includes(q);
        const roleMatch = (rec.userRole || '').toLowerCase().includes(q);
        const noteMatch = ((rec.checkInNote || '') + (rec.checkOutNote || '')).toLowerCase().includes(q);
        if (!nameMatch && !userMatch && !roleMatch && !noteMatch) return false;
      }
      return true;
    });
  }, [rosterRecords, staffFilter, statusFilter, searchQuery, systemUsers]);

  // Export full register to CSV
  const handleExportCSV = () => {
    if (filteredRoster.length === 0) {
      showAlert({ title: 'Export', message: 'No attendance records available for this filter to export.', icon: 'info' });
      return;
    }
    const headers = [
      'Date',
      'Staff Name',
      'Login Handle',
      'Assigned Department',
      'Work Mode',
      'Check In (IST)',
      'Check Out (IST)',
      'Total Duration',
      'Status',
      'Check-in Location',
      'Check In Note',
      'Check Out Note',
      'Device Info',
    ];
    const rows = filteredRoster.map((r) => {
      const loc = extractLocationFromNote(r.checkInNote);
      return [
        r.attendanceDate,
        `"${r.userName || r.userId}"`,
        r.userId,
        `"${r.userRole || 'Counselor'}"`,
        r.workMode,
        r.checkInTime ? formatIndianTime(r.checkInTime, { includeSeconds: true }) : '-',
        r.checkOutTime ? formatIndianTime(r.checkOutTime, { includeSeconds: true }) : '-',
        r.totalHoursFormatted || `${r.totalMinutes || 0}m`,
        r.status,
        `"${loc.locationText || '-'}"`,
        `"${loc.userNote || ''}"`,
        `"${r.checkOutNote || ''}"`,
        `"${r.deviceInfo || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SSA_Enterprise_Attendance_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCheckedIn = Boolean(myTodayRecord?.checkInTime);
  const isCheckedOut = Boolean(myTodayRecord?.checkOutTime);
  const isWorkingNow = isCheckedIn && !isCheckedOut;

  const formatPunchTime = (iso?: string) => {
    if (!iso) return '-';
    return formatIndianTime(iso, { includeSeconds: true, fallback: iso });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Mobile Header / Back Navigation */}
      <div className="md:hidden flex items-center justify-between pb-1 pt-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 active:scale-95 transition-all cursor-pointer py-1"
        >
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
        <span className="text-xs font-bold text-slate-800">Staff Attendance &amp; Roster</span>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-22 sm:bottom-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
          <CheckCircle2 size={18} className="text-[#34c759]" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* App: a web check-in is waiting for this phone's fingerprint approval */}
      {pendingWebRequest && !isAdmin && (
        <button
          type="button"
          onClick={() => navigate(`/attendance/verify/${pendingWebRequest.id}`)}
          className="w-full text-left bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:bg-blue-100"
        >
          <div className="w-10 h-10 rounded-xl bg-white text-[#007aff] flex items-center justify-center shrink-0">
            <Fingerprint size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Check-in waiting for your approval</p>
            <p className="text-xs text-slate-600 truncate">
              Requested from {describeRequestSource(pendingWebRequest.requestedFrom)} · tap to review
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        </button>
      )}

      {/* Top Banner: Personal Shift Punch Bar (Counselors & Staff Only - Hidden for Admin) */}
      {!isAdmin && (
        <div className="bg-white rounded-3xl border border-black/[0.06] p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            {/* Identity & Status */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#007aff] flex items-center justify-center font-bold shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">{displayName}</h2>
                  {isWorkingNow ? (
                    <span className="text-xs font-semibold text-emerald-700">
                      On Duty {liveDuration && `• ${liveDuration}`}
                    </span>
                  ) : isCheckedOut ? (
                    <span className="text-xs font-medium text-slate-500">
                      Shift Completed {myTodayRecord?.totalHoursFormatted && `(${myTodayRecord.totalHoursFormatted})`}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      Not Checked In
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentDateFormatted} • <span className="font-mono font-semibold text-slate-700">{currentTime} IST</span>
                </p>
              </div>
            </div>

            {/* Actions: Register Office Fingerprint & Check In */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              {/* Enterprise Reusable Biometric Hardware Registration Button */}
              {isNativeApp ? (
                <BiometricRegisterButton
                  credential={biometricCred}
                  isLoading={enrollingBiometric}
                  onRegister={handleRegisterBiometric}
                  disabled={isPunchBusy}
                />
              ) : (
                !hasUsableFingerprint && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <Fingerprint size={13} className="text-emerald-600" />
                    Register your fingerprint in the SSA Android app to check in
                  </span>
                )
              )}

              {!isCheckedIn ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={isPunchBusy}
                  className="px-4 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {punching ? <Loader2 size={13} className="animate-spin" /> : <Clock size={14} />}
                  <span>Check In for Today</span>
                </button>
              ) : isWorkingNow ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={isPunchBusy}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {checkingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={14} />}
                  <span>Check Out</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Today's shift logged ({myTodayRecord?.totalHoursFormatted})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin KPI Overview Cards (MNC Level) */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Present</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {adminSummary?.totalPresent ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Checked in today</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">On Duty Now</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block">
              {adminSummary?.currentlyWorking ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Active on shift</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Checked Out</span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">
              {adminSummary?.completedCheckout ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Shift completed</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Late Arrivals</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">
              {adminSummary?.lateCount ?? 0}
            </span>
            <span className="text-[10px] text-amber-500 mt-0.5 block">After 09:30 AM</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Half Day</span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block">
              {adminSummary?.halfDayCount ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">&lt; 4 hours</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Overtime</span>
            <span className="text-xl font-bold text-purple-600 mt-1 block">
              {adminSummary?.overtimeCount ?? 0}
            </span>
            <span className="text-[10px] text-purple-500 mt-0.5 block">9+ hours</span>
          </div>
        </div>
      )}

      {/* Main Roster & Register Card (Admin only: staff see their own shift status in the punch bar above) */}
      {isAdmin && (
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-xs overflow-hidden">
        {/* Table Header & Filter Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Staff Attendance Register & Roster
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time corporate attendance logs across all counselors and departments
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 pt-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by staff name, login ID, or role..."
                className="w-full !pl-9.5 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Clear Search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Date Range Quick Selector */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 shrink-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === 'TODAY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('YESTERDAY')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === 'YESTERDAY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('LAST_7')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === 'LAST_7' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  dateFilter === 'THIS_MONTH' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
            </div>

            {/* Dynamic Staff Selector (Admin only - Counselors and Staff) */}
            {isAdmin && (
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="px-3 py-1.5 h-[34px] rounded-md border border-slate-300 bg-white text-xs text-slate-800 shadow-2xs hover:border-slate-400 focus:outline-none focus:border-blue-500 min-w-0 max-w-full sm:max-w-[240px] truncate cursor-pointer"
              >
                <option value="ALL">All Staff Members</option>
                {systemUsers
                  .filter(
                    (u) =>
                      u.login?.toLowerCase() !== 'admin' &&
                      u.login?.toLowerCase() !== 'administrator' &&
                      !u.authorities?.includes('ROLE_ADMIN')
                  )
                  .map((u) => (
                    <option key={u.id || u.login} value={u.login}>
                      {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''} (@${u.login})` : u.login}
                    </option>
                  ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 h-[34px] rounded-md border border-slate-300 bg-white text-xs text-slate-800 shadow-2xs hover:border-slate-400 focus:outline-none focus:border-blue-500 min-w-0 max-w-full sm:max-w-[180px] truncate cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="WORKING">Currently On Duty</option>
              <option value="PRESENT">On-Time Present</option>
              <option value="LATE">Late Arrival</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="OVERTIME">Overtime</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Work Mode</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Check-in Location</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loadingRoster ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-fadeIn">
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-24 h-4 rounded" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-28 h-4 rounded" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-20 h-5 rounded-md" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-16 h-4 rounded" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-16 h-4 rounded" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-14 h-4 rounded" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-20 h-5 rounded-full" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-24 h-5 rounded-full" /></td>
                    <td className="py-3.5 px-4"><SkeletonBlock className="w-32 h-4 rounded" /></td>
                  </tr>
                ))
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No attendance records found for this period.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((rec, idx) => {
                  const isStaffWorkingNow = Boolean(rec.checkInTime && !rec.checkOutTime);
                  const locInfo = extractLocationFromNote(rec.checkInNote);
                  return (
                    <tr key={rec.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      {/* Staff Member */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {(rec.userName?.[0] || rec.userId?.[0] || 'S').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight">
                              {rec.userName || rec.userId}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>@{rec.userId}</span>
                              {rec.userRole && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500">{rec.userRole}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {rec.attendanceDate}
                      </td>

                      {/* Work Mode */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                          {rec.workMode === 'REMOTE' ? 'Work From Home' : rec.workMode === 'FIELD' ? 'Field Duty' : 'In Office'}
                        </span>
                      </td>

                      {/* Punch In */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        {formatPunchTime(rec.checkInTime)}
                      </td>

                      {/* Punch Out */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        {formatPunchTime(rec.checkOutTime)}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {isStaffWorkingNow ? (
                          <span className="text-emerald-600 font-semibold">
                            In Progress
                          </span>
                        ) : (
                          rec.totalHoursFormatted || (rec.totalMinutes ? `${rec.totalMinutes}m` : '-')
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isStaffWorkingNow ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            On Duty
                          </span>
                        ) : rec.status === 'LATE' ? (
                          <span className="text-xs font-medium text-amber-700">
                            Late Arrival
                          </span>
                        ) : rec.status === 'HALF_DAY' ? (
                          <span className="text-xs font-medium text-indigo-700">
                            Half Day
                          </span>
                        ) : rec.status === 'OVERTIME' ? (
                          <span className="text-xs font-medium text-purple-700">
                            Overtime
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">
                            Present
                          </span>
                        )}
                      </td>

                      {/* Check-in Location */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {locInfo.locationText ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-0">
                            <MapPin size={13} className="text-rose-500 shrink-0" />
                            <span className="truncate font-medium text-slate-800" title={locInfo.locationText}>
                              {locInfo.locationText}
                            </span>
                            {locInfo.coords && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${locInfo.coords.lat},${locInfo.coords.lon}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#007aff] hover:underline font-semibold shrink-0 ml-1 inline-flex items-center"
                                title="Open in Google Maps"
                              >
                                Map ↗
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500" title={[locInfo.userNote, rec.checkOutNote].filter(Boolean).join(' | ')}>
                        {[locInfo.userNote, rec.checkOutNote].filter(Boolean).join(' | ') || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Web: waiting for fingerprint approval on the registered phone */}
      <PhoneApprovalSheet expiresAt={phoneApproval?.expiresAt ?? null} onCancel={cancelPhoneApproval} />

      {/* Enterprise Reusable Biometric Confirmation Modal */}
      <BiometricSuccessModal
        isOpen={Boolean(checkInSuccessModal?.isOpen)}
        onClose={closeSuccessModal}
        userName={displayName}
        userId={currentUserId}
        timestamp={checkInSuccessModal?.timestamp || ''}
        deviceId={checkInSuccessModal?.deviceName}
      />
    </div>
  );
}

