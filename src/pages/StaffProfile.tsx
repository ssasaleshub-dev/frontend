import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Camera,
  Loader2,
  RefreshCw,
  LogOut,
  User,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getRoleBadgeInfo } from '../utils/rbac';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import fileService from '../services/api/fileService';
import { formatIndianTime } from '../utils/dateTimeUtils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffProfile() {
  const { user, updateUserAvatar } = useAuth();
  const displayName = getDisplayName(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const userInitial = (displayName?.[0] || 'S').toUpperCase();
  const userId = user?.login || (user?.id ? String(user.id) : '');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Attendance Data
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [punching, setPunching] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const loadAttendance = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [today, records] = await Promise.all([
        attendanceService.getTodayAttendance(userId),
        attendanceService.getMyHistory(userId),
      ]);
      setTodayRecord(today);
      setHistory(records);
    } catch (err) {
      console.warn('Failed loading attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();

    const handleUpdate = () => loadAttendance();
    window.addEventListener('ssa_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
  }, [userId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Simple One-Click Check-In (No forms, no notes)
  const handleCheckIn = async () => {
    if (!userId) return;
    setPunching(true);
    try {
      const res = await attendanceService.checkIn({
        userId,
        userName: displayName,
        userRole: badgeInfo.displayText,
        workMode: 'OFFICE',
      });
      setTodayRecord(res);
      showToast('Checked in successfully!');
      loadAttendance();
    } catch (err: any) {
      alert(`Check-in failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Simple One-Click Check-Out (No forms, no notes)
  const handleCheckOut = async () => {
    if (!userId) return;
    setPunching(true);
    try {
      const res = await attendanceService.checkOut({ userId });
      setTodayRecord(res);
      showToast('Checked out successfully!');
      loadAttendance();
    } catch (err: any) {
      alert(`Check-out failed: ${err?.message || 'Server error'}`);
    } finally {
      setPunching(false);
    }
  };

  // Profile photo change
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const res = await fileService.uploadFile(file, 'avatars');
      if (res?.url) {
        await updateUserAvatar(res.url);
        showToast('Profile photo updated.');
      }
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || 'Server error'}`);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Date map of attendance records
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, StaffAttendanceRecord>();
    history.forEach((rec) => {
      if (rec.attendanceDate) {
        map.set(rec.attendanceDate, rec);
      }
    });
    // Ensure today's optimistic record is also mapped
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

    const todayStr = new Date().toISOString().substring(0, 10);

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
  }, [year, month, attendanceByDate]);

  // Monthly summary stats
  const monthlyStats = useMemo(() => {
    let presentDays = 0;
    let lateDays = 0;
    let totalMinutes = 0;

    attendanceByDate.forEach((rec, dateStr) => {
      if (dateStr.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
        if (rec.checkInTime) {
          presentDays++;
          if (rec.status === 'LATE') lateDays++;
          totalMinutes += rec.totalMinutes || 0;
        }
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return {
      presentDays,
      lateDays,
      totalHours: `${hours}h ${mins}m`,
    };
  }, [attendanceByDate, year, month]);

  const isCheckedIn = Boolean(todayRecord?.checkInTime);
  const isCheckedOut = Boolean(todayRecord?.checkOutTime);
  const isWorkingNow = isCheckedIn && !isCheckedOut;

  const formatTime = (iso?: string) => {
    if (!iso) return '-';
    return formatIndianTime(iso, { fallback: iso });
  };

  const selectedRecord = attendanceByDate.get(selectedDateStr);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1d1d1f] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-white/10">
          <CheckCircle2 size={16} className="text-[#34c759]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Staff Profile Header Card */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                {avatarUploading ? (
                  <Loader2 size={18} className="animate-spin text-[#007aff]" />
                ) : user?.imageUrl ? (
                  <img src={user.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-500">{userInitial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title="Change Photo"
                className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-[#007aff] text-white shadow hover:bg-[#0062cc]"
              >
                <Camera size={11} />
              </button>
            </div>

            <div>
              <h1 className="text-base font-bold text-slate-900">{displayName}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Login: <strong className="text-slate-800">@{userId}</strong>
                {user?.email && <> • <span>{user.email}</span></>}
              </p>
            </div>
          </div>

          {/* Simple Today Action Strip */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            {isWorkingNow ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/[0.08] text-emerald-950 text-xs font-medium shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                  <span className="font-semibold text-emerald-900 tracking-tight">On Duty</span>
                  <span className="text-[11px] text-emerald-700/80 font-mono pl-1 border-l border-emerald-600/20">
                    Since {formatTime(todayRecord?.checkInTime)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={punching}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {punching ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  <span>Punch Out</span>
                </button>
              </div>
            ) : isCheckedOut ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Today's Shift Completed ({todayRecord?.totalHoursFormatted})</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={punching}
                className="px-4 py-2 rounded-xl bg-[#007aff] hover:bg-[#0062cc] text-white text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                {punching ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                <span>Check In for Today</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Attendance Calendar */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        {/* Month Navigation & Stats Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonthDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-sm font-bold text-slate-900 min-w-36 text-center">
                {MONTH_NAMES[month]} {year}
              </h2>
              <button
                type="button"
                onClick={() => setCurrentMonthDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCurrentMonthDate(new Date())}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Today
            </button>
          </div>

          {/* Quick Summary Badges */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Present: <strong>{monthlyStats.presentDays}</strong> days
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Late: <strong>{monthlyStats.lateDays}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Clock size={12} className="text-[#007aff]" />
              Total Hours: <strong>{monthlyStats.totalHours}</strong>
            </span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-3 sm:p-5">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {WEEKDAYS.map((w, idx) => (
              <div key={w} className={`py-1.5 ${idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-700'}`}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((d, index) => {
              const rec = d.record;
              const hasCheckedIn = Boolean(rec?.checkInTime);
              const isSelected = d.dateStr === selectedDateStr;

              return (
                <button
                  key={`${d.dateStr}-${index}`}
                  type="button"
                  onClick={() => setSelectedDateStr(d.dateStr)}
                  className={`min-h-18 sm:min-h-20 p-1.5 sm:p-2 rounded-xl text-left border flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'ring-2 ring-[#007aff] border-[#007aff]'
                      : 'border-slate-100 hover:border-slate-300'
                  } ${
                    !d.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : d.isToday
                      ? 'bg-blue-50/40 border-blue-200'
                      : 'bg-white'
                  }`}
                >
                  {/* Day Number Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        d.isToday
                          ? 'w-5 h-5 rounded-full bg-[#007aff] text-white flex items-center justify-center'
                          : d.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {d.dayNumber}
                    </span>

                    {/* Status on Day */}
                    {hasCheckedIn && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            rec?.status === 'LATE' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span className={rec?.status === 'LATE' ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                          {rec?.status === 'LATE' ? 'Late' : 'Present'}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Day Timing / Hours */}
                  <div className="mt-1">
                    {hasCheckedIn ? (
                      <div className="text-[10px] font-semibold text-slate-700 font-mono truncate">
                        {rec?.totalHoursFormatted || `${formatTime(rec?.checkInTime)}`}
                      </div>
                    ) : d.isWeekend ? (
                      <span className="text-[10px] text-slate-400 font-medium">Off</span>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-medium">-</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
