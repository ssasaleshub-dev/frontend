import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  MapPin,
  Laptop,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Calendar,
  LogOut,
  Camera,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Building2,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getRoleBadgeInfo } from '../utils/rbac';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import fileService from '../services/api/fileService';

export default function StaffProfile() {
  const { user, updateUserAvatar } = useAuth();
  const displayName = getDisplayName(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const userInitial = (displayName?.[0] || 'S').toUpperCase();

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Live IST Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');

  // Attendance state
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [punching, setPunching] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'OFFICE' | 'REMOTE' | 'FIELD'>('OFFICE');
  const [punchNote, setPunchNote] = useState<string>('');
  const [liveDuration, setLiveDuration] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  const userId = user?.login || (user?.id ? String(user.id) : '');

  // Clock ticking in IST (Asia/Kolkata)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const dateStr = now.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      setCurrentTime(timeStr);
      setCurrentDateFormatted(dateStr);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's record and user history
  const loadAttendanceData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [today, records] = await Promise.all([
        attendanceService.getTodayAttendance(userId),
        attendanceService.getMyHistory(userId),
      ]);
      setTodayRecord(today);
      if (today?.workMode && ['OFFICE', 'REMOTE', 'FIELD'].includes(today.workMode)) {
        setSelectedMode(today.workMode as 'OFFICE' | 'REMOTE' | 'FIELD');
      }
      setHistory(records);
    } catch (err) {
      console.warn('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();

    const handleUpdate = () => {
      loadAttendanceData();
    };

    window.addEventListener('ssa_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
  }, [userId]);

  // Live timer calculation when user is checked in and not checked out
  useEffect(() => {
    if (!todayRecord?.checkInTime || todayRecord?.checkOutTime) {
      setLiveDuration('');
      return;
    }

    const calcDuration = () => {
      const start = new Date(todayRecord.checkInTime!).getTime();
      const now = Date.now();
      const diffMs = Math.max(0, now - start);
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
  }, [todayRecord]);

  // Show temporary toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Check In handler
  const handleCheckIn = async () => {
    if (!userId) return;
    setPunching(true);
    try {
      const result = await attendanceService.checkIn({
        userId,
        userName: displayName,
        userRole: badgeInfo.displayText,
        workMode: selectedMode,
        note: punchNote.trim(),
      });
      setTodayRecord(result);
      setPunchNote('');
      triggerToast('Check-in confirmed. Have a productive day!');
      loadAttendanceData();
    } catch (err: any) {
      alert(`Check-in failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Check Out handler
  const handleCheckOut = async () => {
    if (!userId) return;
    if (!confirm('Are you ready to check out and wrap up your work shift for today?')) {
      return;
    }
    setPunching(true);
    try {
      const result = await attendanceService.checkOut({
        userId,
        note: punchNote.trim(),
      });
      setTodayRecord(result);
      setPunchNote('');
      triggerToast('Shift completed and check-out recorded.');
      loadAttendanceData();
    } catch (err: any) {
      alert(`Check-out failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Avatar upload handler
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const res = await fileService.uploadFile(file, 'avatars');
      if (res?.url) {
        await updateUserAvatar(res.url);
        triggerToast('Profile photo updated successfully.');
      }
    } catch (err: any) {
      alert(`Failed to upload photo: ${err?.message || 'Server error'}`);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Export personal records as CSV
  const handleExportCSV = () => {
    if (history.length === 0) {
      alert('No attendance records available to export.');
      return;
    }
    const headers = ['Date', 'Staff Name', 'Login ID', 'Work Mode', 'Check In', 'Check Out', 'Duration', 'Status', 'Notes'];
    const rows = history.map((r) => [
      r.attendanceDate,
      `"${r.userName || displayName}"`,
      r.userId,
      r.workMode,
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
      r.totalHoursFormatted || `${r.totalMinutes || 0}m`,
      r.status,
      `"${[r.checkInNote, r.checkOutNote].filter(Boolean).join(' | ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SSA_My_Attendance_${userId}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Computed summary metrics
  const summaryMetrics = useMemo(() => {
    const totalDays = history.length;
    const lateDays = history.filter((r) => r.status === 'LATE').length;
    const halfDays = history.filter((r) => r.status === 'HALF_DAY').length;
    const overtimeDays = history.filter((r) => r.status === 'OVERTIME').length;
    const totalMinutes = history.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
    const avgMinutes = totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0;
    const avgHoursFormatted = `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;
    const onTimeRate = totalDays > 0 ? Math.round(((totalDays - lateDays) / totalDays) * 100) : 100;

    return {
      totalDays,
      lateDays,
      halfDays,
      overtimeDays,
      avgHoursFormatted,
      onTimeRate,
    };
  }, [history]);

  const isCheckedIn = Boolean(todayRecord?.checkInTime);
  const isCheckedOut = Boolean(todayRecord?.checkOutTime);
  const isWorkingNow = isCheckedIn && !isCheckedOut;

  // Format timestamp helper
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10 animate-fade-in">
          <CheckCircle2 size={18} className="text-[#34c759]" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar with Upload button */}
            <div className="relative group shrink-0">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center shadow-xs">
                {avatarUploading ? (
                  <Loader2 size={24} className="text-[#007aff] animate-spin" />
                ) : user?.imageUrl ? (
                  <img src={user.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-500">{userInitial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title="Update Profile Photo"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-[#007aff] text-white shadow-md hover:bg-[#0062cc] transition-all"
              >
                <Camera size={13} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{displayName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {badgeInfo.displayText}
                </span>
                {isWorkingNow && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    On Duty
                  </span>
                )}
                {isCheckedOut && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Shift Completed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                <span>Login ID: <strong className="text-slate-800">@{user?.login}</strong></span>
                {user?.email && <span>Email: <strong className="text-slate-800">{user.email}</strong></span>}
                <span>Shift: <strong className="text-slate-800">General (09:00 AM – 06:00 PM IST)</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              onClick={loadAttendanceData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Shift Punch Desk (Left) + Policy / Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Shift Punch Card (Enterprise MNC Level) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-black/[0.06] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#007aff] flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Today's Attendance Punch</h2>
                  <p className="text-xs text-slate-500">{currentDateFormatted}</p>
                </div>
              </div>

              {/* Digital IST Clock */}
              <div className="text-right">
                <div className="text-base font-bold font-mono text-slate-900 tracking-tight">
                  {currentTime}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Standard Time (IST)</div>
              </div>
            </div>

            {/* Shift Status Overview */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 block">Check-In Time</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                  {formatPunchTime(todayRecord?.checkInTime)}
                </span>
                {todayRecord?.status === 'LATE' && (
                  <span className="text-[10px] text-amber-600 font-semibold mt-0.5 inline-block">
                    Late Arrival (After 09:30 AM)
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 block">Check-Out Time</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block font-mono">
                  {formatPunchTime(todayRecord?.checkOutTime)}
                </span>
                {isCheckedOut && (
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 inline-block">
                    Check-out Confirmed
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 block">Shift Duration</span>
                <span className="text-sm font-bold text-[#007aff] mt-1 block font-mono">
                  {isWorkingNow ? liveDuration || 'Calculating...' : todayRecord?.totalHoursFormatted || '0h 00m'}
                </span>
                {isWorkingNow && (
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 inline-block">
                    Live Working Counter
                  </span>
                )}
              </div>
            </div>

            {/* Punch Action Container */}
            <div className="mt-6 p-5 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/50 to-white">
              {!isCheckedIn ? (
                /* Step 1: Check In Form */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      Select Work Location / Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedMode('OFFICE')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                          selectedMode === 'OFFICE'
                            ? 'bg-[#007aff] text-white border-[#007aff] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 size={16} className="mb-1" />
                        <span>In Office</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMode('REMOTE')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                          selectedMode === 'REMOTE'
                            ? 'bg-[#007aff] text-white border-[#007aff] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Laptop size={16} className="mb-1" />
                        <span>Work From Home</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMode('FIELD')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                          selectedMode === 'FIELD'
                            ? 'bg-[#007aff] text-white border-[#007aff] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <MapPin size={16} className="mb-1" />
                        <span>Field Duty</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      Optional Morning Note / Plan
                    </label>
                    <input
                      type="text"
                      value={punchNote}
                      onChange={(e) => setPunchNote(e.target.value)}
                      placeholder="e.g. Starting candidate calls for study visa applicants"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={punching}
                    className="w-full py-3 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold tracking-wide shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    {punching ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>Punch In (Start Shift)</span>
                  </button>
                </div>
              ) : isWorkingNow ? (
                /* Step 2: Currently Working & Check Out Form */
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-800">
                        Shift In Progress ({todayRecord.workMode === 'REMOTE' ? 'Work From Home' : todayRecord.workMode === 'FIELD' ? 'Field Duty' : 'Office Desk'})
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-900">
                      {liveDuration}
                    </span>
                  </div>

                  {todayRecord.checkInNote && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-700">Check-in Note: </span>
                      {todayRecord.checkInNote}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      Wrap-up / End of Day Summary (Optional)
                    </label>
                    <input
                      type="text"
                      value={punchNote}
                      onChange={(e) => setPunchNote(e.target.value)}
                      placeholder="e.g. Conducted 16 counselor calls, 4 appointments booked"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={punching}
                    className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold tracking-wide shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    {punching ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <LogOut size={16} />
                    )}
                    <span>Punch Out (End Shift)</span>
                  </button>
                </div>
              ) : (
                /* Step 3: Shift Finished */
                <div className="text-center py-4 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={22} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Today's Shift Completed</h3>
                  <p className="text-xs text-slate-500">
                    You have logged <strong className="text-slate-800">{todayRecord?.totalHoursFormatted}</strong> of work today.
                  </p>
                  {todayRecord?.checkOutNote && (
                    <p className="text-xs italic text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 max-w-md mx-auto">
                      "{todayRecord.checkOutNote}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: MNC Shift Guidelines & Monthly Summary */}
        <div className="space-y-6">
          {/* Policy Card */}
          <div className="bg-white rounded-3xl border border-black/[0.06] p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <Briefcase size={14} className="text-[#007aff]" />
              <span>Shift & Punctuality Policy</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>Shift Start: <strong>09:00 AM IST</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>Grace Window: Check-in up to <strong>09:30 AM</strong> is on-time; punches after 09:30 AM are logged as <strong>Late</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span>Half-Day Threshold: Shifts under <strong>4 hours</strong> are counted as Half-Day.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Overtime: Total hours reaching <strong>9 hours or more</strong> qualify for Overtime.</span>
              </li>
            </ul>
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-white rounded-3xl border border-black/[0.06] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <TrendingUp size={14} className="text-[#007aff]" />
                <span>My Performance Summary</span>
              </h3>
              <button
                onClick={handleExportCSV}
                title="Download CSV Statement"
                className="text-[11px] font-semibold text-[#007aff] hover:underline inline-flex items-center gap-1"
              >
                <FileSpreadsheet size={13} />
                <span>Export</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-medium text-slate-500 block">Days Worked</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {summaryMetrics.totalDays}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-medium text-slate-500 block">Avg Daily Hours</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {summaryMetrics.avgHoursFormatted}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-medium text-slate-500 block">On-Time Arrival</span>
                <span className="text-base font-bold text-emerald-600 mt-0.5 block">
                  {summaryMetrics.onTimeRate}%
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-medium text-slate-500 block">Late Arrivals</span>
                <span className="text-base font-bold text-amber-600 mt-0.5 block">
                  {summaryMetrics.lateDays}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-3xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Personal Attendance Register</h3>
              <p className="text-xs text-slate-500">Record of daily punches, hours logged, and notes</p>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet size={13} className="text-emerald-600" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Work Mode</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Punctuality Status</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No attendance records logged yet. Check in today using the punch desk above!
                  </td>
                </tr>
              ) : (
                history.map((rec, idx) => (
                  <tr key={rec.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {rec.attendanceDate}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                        {rec.workMode === 'REMOTE' ? 'Work From Home' : rec.workMode === 'FIELD' ? 'Field Duty' : 'Office Desk'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {formatPunchTime(rec.checkInTime)}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {formatPunchTime(rec.checkOutTime)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {rec.totalHoursFormatted || (rec.totalMinutes ? `${rec.totalMinutes}m` : '-')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {rec.status === 'LATE' ? (
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
                    <td className="py-3 px-4 max-w-xs truncate text-slate-500" title={[rec.checkInNote, rec.checkOutNote].filter(Boolean).join(' | ')}>
                      {[rec.checkInNote, rec.checkOutNote].filter(Boolean).join(' | ') || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

