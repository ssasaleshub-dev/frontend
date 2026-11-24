import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Fingerprint, Loader2, Check } from 'lucide-react';
import type { StaffAttendanceRecord } from '../../services/api/attendanceService';
import type { StaffBiometricCredential } from '../../services/biometricService';
import { formatIndianTime } from '../../utils/dateTimeUtils';

export interface AttendanceCardProps {
  todayRecord: StaffAttendanceRecord | null;
  history: StaffAttendanceRecord[];
  credential: Partial<StaffBiometricCredential> | null;
  isNativeApp: boolean;
  enrolling: boolean;
  checkingIn: boolean;
  checkingOut: boolean;
  onRegister: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Local YYYY-MM-DD (attendance dates are stored as IST calendar dates). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatElapsed = (fromIso?: string | null, now = Date.now()): string => {
  if (!fromIso) return '';
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Dot colour for a day on the calendar. */
const dayDot = (rec?: StaffAttendanceRecord): string | null => {
  if (!rec?.checkInTime) return null;
  const s = (rec.status || '').toUpperCase();
  if (s === 'LATE') return 'bg-[#ff9500]';
  if (s === 'HALF_DAY') return 'bg-[#af52de]';
  return 'bg-[#34c759]';
};

type FingerprintState = 'ready' | 'pending' | 'redo' | 'none';

const fingerprintState = (cred: Partial<StaffBiometricCredential> | null): FingerprintState => {
  if (!cred) return 'none';
  const locked = Boolean(cred.isLocked || cred.status === 'LOCKED');
  if (locked && cred.publicKey) return 'ready';
  if (locked && !cred.publicKey) return 'redo';
  if (cred.status === 'PENDING_APPROVAL') return 'pending';
  return 'none';
};

/**
 * Today's attendance: fingerprint status, check in / out, and a month calendar of attended days.
 */
export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  todayRecord,
  history,
  credential,
  isNativeApp,
  enrolling,
  checkingIn,
  checkingOut,
  onRegister,
  onCheckIn,
  onCheckOut,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [monthDate, setMonthDate] = useState(() => new Date());

  const isOnDuty = Boolean(todayRecord?.checkInTime && !todayRecord?.checkOutTime);
  const isDone = Boolean(todayRecord?.checkOutTime);
  const fp = fingerprintState(credential);
  const busy = checkingIn || checkingOut;

  // Keep the "on duty for" time fresh
  useEffect(() => {
    if (!isOnDuty) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [isOnDuty]);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const todayKey = ymd(new Date());

  const cells = useMemo(() => {
    const byDate = new Map<string, StaffAttendanceRecord>();
    history.forEach((r) => r.attendanceDate && byDate.set(r.attendanceDate, r));
    if (todayRecord?.attendanceDate) byDate.set(todayRecord.attendanceDate, todayRecord);

    const lead = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const out: Array<{ day: number; key: string; rec?: StaffAttendanceRecord } | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) {
      const key = ymd(new Date(year, month, d));
      out.push({ day: d, key, rec: byDate.get(key) });
    }
    return out;
  }, [history, todayRecord, year, month]);

  const daysPresent = useMemo(
    () => cells.filter((c) => c && c.rec?.checkInTime).length,
    [cells]
  );

  // ── Fingerprint row text ──
  let fpDetail: string;
  let fpAction: string | null = null;
  if (fp === 'ready') {
    fpDetail = isNativeApp ? 'Ready on this phone' : 'Ready · check-ins are approved on your phone';
  } else if (fp === 'pending') {
    fpDetail = 'Waiting for admin approval';
    fpAction = isNativeApp ? 'Redo' : null;
  } else if (fp === 'redo') {
    fpDetail = 'Needs to be set up again';
    fpAction = isNativeApp ? 'Set up' : null;
  } else {
    fpDetail = isNativeApp ? 'Not set up' : 'Set up in the SSA app on your phone';
    fpAction = isNativeApp ? 'Set up' : null;
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-[15px] font-semibold text-[#1c1c1e]">Attendance</h3>
        <span className="text-[13px] text-[#8e8e93]">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* Today */}
      <div className="px-5 pb-4">
        {isOnDuty ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] text-[#248a3d] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#34c759]" />
                On duty
              </div>
              <p className="mt-0.5 text-[24px] leading-7 font-semibold text-[#1c1c1e] tabular-nums tracking-tight">
                {formatElapsed(todayRecord?.checkInTime, now)}
              </p>
              <p className="text-[13px] text-[#8e8e93]">Since {formatIndianTime(todayRecord?.checkInTime)}</p>
            </div>
            <button
              type="button"
              onClick={onCheckOut}
              disabled={busy}
              className="shrink-0 h-11 px-5 rounded-xl bg-[#f2f2f7] text-[15px] font-semibold text-[#ff3b30] active:bg-[#e5e5ea] disabled:opacity-50 cursor-pointer"
            >
              {checkingOut ? <Loader2 size={18} className="animate-spin" /> : 'Check out'}
            </button>
          </div>
        ) : isDone ? (
          <div>
            <div className="flex items-center gap-1.5 text-[13px] text-[#8e8e93] font-medium">
              <Check size={14} className="text-[#34c759]" strokeWidth={3} />
              Shift complete
            </div>
            <p className="mt-0.5 text-[28px] leading-8 font-semibold text-[#1c1c1e] tabular-nums tracking-tight">
              {todayRecord?.totalHoursFormatted || '—'}
            </p>
            <p className="text-[13px] text-[#8e8e93] tabular-nums">
              {formatIndianTime(todayRecord?.checkInTime)} – {formatIndianTime(todayRecord?.checkOutTime)}
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={onCheckIn}
              disabled={busy || fp !== 'ready'}
              className="w-full h-12 rounded-xl bg-[#007aff] active:bg-[#0062cc] text-white text-[16px] font-semibold flex items-center justify-center gap-2 disabled:bg-[#c7c7cc] disabled:cursor-not-allowed cursor-pointer"
            >
              {checkingIn ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} />}
              {checkingIn ? (isNativeApp ? 'Verifying…' : 'Waiting for your phone…') : 'Check in'}
            </button>
            {fp === 'ready' && !isNativeApp && (
              <p className="mt-2 text-center text-[12px] text-[#8e8e93]">You'll confirm it with your fingerprint on your phone</p>
            )}
            {fp === 'pending' && (
              <p className="mt-2 text-center text-[12px] text-[#f59e0b] font-medium">
                ⏳ Device registered · Awaiting Admin approval in Biometric Approvals
              </p>
            )}
            {fp === 'redo' && (
              <p className="mt-2 text-center text-[12px] text-[#ef4444] font-medium">
                Fingerprint needs to be re-enrolled
              </p>
            )}
            {fp === 'none' && (
              <p className="mt-2 text-center text-[12px] text-[#8e8e93]">Set up your fingerprint to check in</p>
            )}
          </div>
        )}
      </div>

      {/* Fingerprint row (iOS Settings style) */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-black/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-[#f2f2f7] flex items-center justify-center shrink-0">
          <Fingerprint size={18} className={fp === 'ready' ? 'text-[#34c759]' : 'text-[#8e8e93]'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-[#1c1c1e] leading-5">Fingerprint</p>
          <p className="text-[12px] text-[#8e8e93] leading-4 truncate">{fpDetail}</p>
        </div>
        {fpAction && (
          <button
            type="button"
            onClick={onRegister}
            disabled={enrolling || busy}
            className="shrink-0 text-[15px] text-[#007aff] font-medium disabled:opacity-50 cursor-pointer"
          >
            {enrolling ? <Loader2 size={16} className="animate-spin" /> : fpAction}
          </button>
        )}
        {fp === 'ready' && <Check size={18} className="text-[#34c759] shrink-0" strokeWidth={2.5} />}
      </div>

      {/* Calendar */}
      <div className="px-4 pt-3 pb-4 border-t border-black/[0.06]">
        <div className="flex items-center justify-between px-1 mb-2">
          <div>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">
              {MONTHS[month]} {year}
            </p>
            <p className="text-[12px] text-[#8e8e93]">
              {daysPresent} day{daysPresent === 1 ? '' : 's'} attended
            </p>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthDate(new Date(year, month - 1, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#007aff] active:bg-[#f2f2f7] cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonthDate(new Date(year, month + 1, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#007aff] active:bg-[#f2f2f7] cursor-pointer"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-[#8e8e93] mb-1">
          {WEEKDAY_LETTERS.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const isToday = c.key === todayKey;
            const dot = dayDot(c.rec);
            return (
              <div key={c.key} className="flex flex-col items-center h-11">
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-[15px] tabular-nums ${
                    isToday ? 'bg-[#007aff] text-white font-semibold' : 'text-[#1c1c1e]'
                  }`}
                >
                  {c.day}
                </span>
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${dot || 'bg-transparent'}`} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-[#8e8e93]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
            On time
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]" />
            Late
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#af52de]" />
            Half day
          </span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCard;
