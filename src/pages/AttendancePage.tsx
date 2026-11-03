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
  ChevronRight,
  Shield,
  Loader2,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isAdmin as checkIsAdmin, getDisplayName, getRoleBadgeInfo } from '../utils/rbac';
import attendanceService, {
  StaffAttendanceRecord,
  AttendanceAdminSummary,
} from '../services/api/attendanceService';
import adminService from '../services/api/adminService';
import type { User } from '../types';

export default function AttendancePage() {
  const { user } = useAuth();
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
  const [punching, setPunching] = useState<boolean>(false);
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

  // Load personal today's punch
  const loadMyToday = async () => {
    if (!currentUserId) return;
    try {
      const res = await attendanceService.getTodayAttendance(currentUserId);
      setMyTodayRecord(res);
      if (res?.workMode && ['OFFICE', 'REMOTE', 'FIELD'].includes(res.workMode)) {
        setSelectedMode(res.workMode as 'OFFICE' | 'REMOTE' | 'FIELD');
      }
    } catch (err) {
      console.warn('Failed loading my attendance:', err);
    }
  };

  // Load Admin Data (Roster + Summary + Users list)
  const loadAdminData = async () => {
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
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
  }, [currentUserId, dateRange, staffFilter]);

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

  // Check In
  const handleCheckIn = async () => {
    if (!currentUserId) return;
    setPunching(true);
    try {
      const result = await attendanceService.checkIn({
        userId: currentUserId,
        userName: displayName,
        userRole: badgeInfo.displayText,
        workMode: selectedMode,
        note: punchNote.trim(),
      });
      setMyTodayRecord(result);
      setPunchNote('');
      showToast('Checked in successfully!');
      loadAdminData();
    } catch (err: any) {
      alert(`Check-in failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Check Out
  const handleCheckOut = async () => {
    if (!currentUserId) return;
    if (!confirm('Are you ready to clock out and end your shift?')) return;
    setPunching(true);
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
      alert(`Check-out failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Filtered Roster for Table
  const filteredRoster = useMemo(() => {
    return rosterRecords.filter((rec) => {
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
  }, [rosterRecords, staffFilter, statusFilter, searchQuery]);

  // Export full register to CSV
  const handleExportCSV = () => {
    if (filteredRoster.length === 0) {
      alert('No attendance records available for this filter to export.');
      return;
    }
    const headers = [
      'Date',
      'Staff Name',
      'Login Handle',
      'Assigned Desk',
      'Work Mode',
      'Check In (IST)',
      'Check Out (IST)',
      'Total Duration',
      'Status',
      'Check In Note',
      'Check Out Note',
      'Device Info',
    ];
    const rows = filteredRoster.map((r) => [
      r.attendanceDate,
      `"${r.userName || r.userId}"`,
      r.userId,
      `"${r.userRole || 'Counselor'}"`,
      r.workMode,
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      r.totalHoursFormatted || `${r.totalMinutes || 0}m`,
      r.status,
      `"${r.checkInNote || ''}"`,
      `"${r.checkOutNote || ''}"`,
      `"${r.deviceInfo || ''}"`,
    ]);

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
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
          <CheckCircle2 size={18} className="text-[#34c759]" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner: Personal Shift Punch Bar */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Identity & Status */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#007aff] flex items-center justify-center font-bold shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">{displayName}</h2>
                <span className="text-xs text-slate-500 font-medium">({badgeInfo.displayText})</span>
                {isWorkingNow ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Working: {liveDuration || 'On Duty'}
                  </span>
                ) : isCheckedOut ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Shift Ended ({myTodayRecord?.totalHoursFormatted})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Not Punched In
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentDateFormatted} • <span className="font-mono font-semibold text-slate-700">{currentTime} IST</span>
              </p>
            </div>
          </div>

          {/* Punch Actions */}
          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            {!isCheckedIn ? (
              <>
                <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('OFFICE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === 'OFFICE'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('REMOTE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === 'REMOTE'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    WFH
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('FIELD')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedMode === 'FIELD'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Field
                  </button>
                </div>

                <input
                  type="text"
                  value={punchNote}
                  onChange={(e) => setPunchNote(e.target.value)}
                  placeholder="Morning note (optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 flex-1 lg:w-48"
                />

                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={punching}
                  className="px-4 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  {punching ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Check In</span>
                </button>
              </>
            ) : isWorkingNow ? (
              <>
                <input
                  type="text"
                  value={punchNote}
                  onChange={(e) => setPunchNote(e.target.value)}
                  placeholder="Wrap-up summary (optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 flex-1 lg:w-56"
                />

                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={punching}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  {punching ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={14} />}
                  <span>Check Out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Today's shift logged ({myTodayRecord?.totalHoursFormatted})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin KPI Overview Cards (MNC Level) */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Present</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {adminSummary?.totalPresent ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Punched today</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">Working Now</span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
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

      {/* Main Roster & Register Card */}
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-xs overflow-hidden">
        {/* Table Header & Filter Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAdmin ? 'Staff Attendance Register & Roster' : 'My Shift Records'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Real-time corporate attendance logs across all counselors and departments'
                  : 'Daily logs of shift punches and duration'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                title="Export filtered records to CSV"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={loadAdminData}
                disabled={loadingRoster}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <RefreshCw size={13} className={loadingRoster ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by staff name, login ID, or desk..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
              />
            </div>

            {/* Date Range Quick Selector */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilter === 'TODAY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('YESTERDAY')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilter === 'YESTERDAY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('LAST_7')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilter === 'LAST_7' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilter === 'THIS_MONTH' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
            </div>

            {/* Dynamic Staff Selector (Admin only) */}
            {isAdmin && (
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 shrink-0"
              >
                <option value="ALL">All Staff Members</option>
                {systemUsers.map((u) => (
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
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 shrink-0"
            >
              <option value="ALL">All Statuses</option>
              <option value="WORKING">Currently Working</option>
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
                <th className="py-3 px-4">Punch In</th>
                <th className="py-3 px-4">Punch Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loadingRoster ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 size={22} className="animate-spin mx-auto text-[#007aff] mb-2" />
                    Loading attendance records...
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No attendance records found for this period.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((rec, idx) => {
                  const isStaffWorkingNow = Boolean(rec.checkInTime && !rec.checkOutTime);
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
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            In Progress
                          </span>
                        ) : (
                          rec.totalHoursFormatted || (rec.totalMinutes ? `${rec.totalMinutes}m` : '-')
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isStaffWorkingNow ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            On Duty
                          </span>
                        ) : rec.status === 'LATE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Late Arrival
                          </span>
                        ) : rec.status === 'HALF_DAY' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Half Day
                          </span>
                        ) : rec.status === 'OVERTIME' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Overtime
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            On-Time Present
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500" title={[rec.checkInNote, rec.checkOutNote].filter(Boolean).join(' | ')}>
                        {[rec.checkInNote, rec.checkOutNote].filter(Boolean).join(' | ') || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
