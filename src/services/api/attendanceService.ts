/**
 * Staff Attendance Service (MNC-Grade Enterprise Tracking)
 * Supports Daily Login / Logout punches, Work Modes (Office, Remote, Field),
 * Automatic Duration Tracking, Offline Resilience, and Admin Roster Management.
 */

import axiosClient from './axiosClient';

export interface StaffAttendanceRecord {
  id?: number | string;
  userId: string;
  userName: string;
  userRole?: string;
  attendanceDate: string; // YYYY-MM-DD
  checkInTime?: string;   // ISO string
  checkOutTime?: string;  // ISO string
  workMode: 'OFFICE' | 'REMOTE' | 'FIELD' | string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'OVERTIME' | 'ON_DUTY' | string;
  totalMinutes?: number;
  totalHoursFormatted?: string; // e.g. "8h 30m"
  checkInNote?: string;
  checkOutNote?: string;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt?: string;
  updatedAt?: string;
  isCheckedIn?: boolean;
  isCheckedOut?: boolean;
  isWorkingNow?: boolean;
}

export interface AttendanceAdminSummary {
  date: string;
  totalPresent: number;
  currentlyWorking: number;
  completedCheckout: number;
  lateCount: number;
  halfDayCount: number;
  overtimeCount: number;
  averageHours: number;
}

const STORAGE_PREFIX = 'ssa_attendance_';

export const attendanceService = {
  /**
   * Check in (Login punch)
   */
  async checkIn(params: {
    userId: string;
    userName?: string;
    userRole?: string;
    workMode?: 'OFFICE' | 'REMOTE' | 'FIELD';
    note?: string;
  }): Promise<StaffAttendanceRecord> {
    const todayStr = new Date().toISOString().substring(0, 10);
    const nowIso = new Date().toISOString();

    const deviceInfo = typeof navigator !== 'undefined'
      ? `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} - ${navigator.platform}`
      : 'Web Client';

    const payload = {
      userId: params.userId,
      userName: params.userName || params.userId,
      userRole: params.userRole || 'STAFF',
      workMode: params.workMode || 'OFFICE',
      note: params.note || '',
      deviceInfo,
    };

    // Optimistic record
    const optimisticRecord: StaffAttendanceRecord = {
      id: `att_${Date.now()}`,
      userId: params.userId,
      userName: params.userName || params.userId,
      userRole: params.userRole || 'STAFF',
      attendanceDate: todayStr,
      checkInTime: nowIso,
      workMode: params.workMode || 'OFFICE',
      status: 'PRESENT',
      totalMinutes: 0,
      totalHoursFormatted: 'In Progress',
      checkInNote: params.note,
      deviceInfo,
    };

    // Save locally
    this.saveLocalRecord(params.userId, optimisticRecord);
    this.broadcastUpdate();

    try {
      const res = await axiosClient.post<StaffAttendanceRecord>('/api/attendance/check-in', payload);
      if (res && res.id) {
        this.saveLocalRecord(params.userId, res);
        this.broadcastUpdate();
        return res;
      }
    } catch (err) {
      console.warn('Backend attendance check-in synced to local storage:', err);
    }

    return optimisticRecord;
  },

  /**
   * Check out (Logout punch)
   */
  async checkOut(params: { userId: string; note?: string }): Promise<StaffAttendanceRecord> {
    const nowIso = new Date().toISOString();
    const existing = this.getLocalRecord(params.userId);

    let totalMinutes = 0;
    let totalFormatted = '8h 00m';

    if (existing?.checkInTime) {
      const diffMs = new Date(nowIso).getTime() - new Date(existing.checkInTime).getTime();
      totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const rem = totalMinutes % 60;
      totalFormatted = `${hours}h ${rem}m`;
    }

    const optimisticRecord: StaffAttendanceRecord = {
      ...(existing || {
        userId: params.userId,
        userName: params.userId,
        attendanceDate: new Date().toISOString().substring(0, 10),
        workMode: 'OFFICE',
        status: 'PRESENT',
      }),
      checkOutTime: nowIso,
      checkOutNote: params.note,
      totalMinutes,
      totalHoursFormatted: totalFormatted,
      status: totalMinutes < 240 ? 'HALF_DAY' : totalMinutes >= 540 ? 'OVERTIME' : (existing?.status || 'PRESENT'),
    };

    this.saveLocalRecord(params.userId, optimisticRecord);
    this.broadcastUpdate();

    try {
      const res = await axiosClient.post<StaffAttendanceRecord>('/api/attendance/check-out', {
        userId: params.userId,
        note: params.note || '',
      });
      if (res && res.id) {
        this.saveLocalRecord(params.userId, res);
        this.broadcastUpdate();
        return res;
      }
    } catch (err) {
      console.warn('Backend attendance check-out synced to local storage:', err);
    }

    return optimisticRecord;
  },

  /**
   * Get today's attendance for user
   */
  async getTodayAttendance(userId: string): Promise<StaffAttendanceRecord | null> {
    if (!userId) return null;

    try {
      const res = await axiosClient.get<StaffAttendanceRecord>('/api/attendance/today', {
        params: { userId },
      });
      if (res && res.attendanceDate) {
        this.saveLocalRecord(userId, res);
        return res;
      }
    } catch {
      // fallback
    }

    return this.getLocalRecord(userId);
  },

  /**
   * Get history for user
   */
  async getMyHistory(userId: string, fromDate?: string, toDate?: string): Promise<StaffAttendanceRecord[]> {
    if (!userId) return [];

    try {
      const res = await axiosClient.get<StaffAttendanceRecord[]>('/api/attendance/my-history', {
        params: { userId, fromDate, toDate },
      });
      if (Array.isArray(res)) {
        return res;
      }
    } catch {
      // fallback
    }

    const localToday = this.getLocalRecord(userId);
    return localToday ? [localToday] : [];
  },

  /**
   * Admin: Get all attendance records across staff
   */
  async getAllAttendanceAdmin(fromDate?: string, toDate?: string, userIdFilter?: string): Promise<StaffAttendanceRecord[]> {
    try {
      const res = await axiosClient.get<StaffAttendanceRecord[]>('/api/attendance/admin/all', {
        params: { fromDate, toDate, userIdFilter },
      });
      if (Array.isArray(res)) {
        return res;
      }
    } catch (err) {
      console.warn('Admin attendance roster fallback:', err);
    }
    return [];
  },

  /**
   * Admin: Get real-time summary statistics
   */
  async getAdminSummary(date?: string): Promise<AttendanceAdminSummary> {
    const fallbackDate = date || new Date().toISOString().substring(0, 10);
    try {
      const res = await axiosClient.get<AttendanceAdminSummary>('/api/attendance/admin/summary', {
        params: { date: fallbackDate },
      });
      if (res && typeof res.totalPresent === 'number') {
        return res;
      }
    } catch {
      // fallback
    }

    return {
      date: fallbackDate,
      totalPresent: 0,
      currentlyWorking: 0,
      completedCheckout: 0,
      lateCount: 0,
      halfDayCount: 0,
      overtimeCount: 0,
      averageHours: 0,
    };
  },

  // Local storage helpers
  saveLocalRecord(userId: string, record: StaffAttendanceRecord): void {
    if (typeof window === 'undefined') return;
    try {
      const today = new Date().toISOString().substring(0, 10);
      localStorage.setItem(`${STORAGE_PREFIX}${userId}_${today}`, JSON.stringify(record));
    } catch {
      // ignore
    }
  },

  getLocalRecord(userId: string): StaffAttendanceRecord | null {
    if (typeof window === 'undefined') return null;
    try {
      const today = new Date().toISOString().substring(0, 10);
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}_${today}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  broadcastUpdate(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ssa_attendance_updated'));
    }
  },
};

export default attendanceService;
