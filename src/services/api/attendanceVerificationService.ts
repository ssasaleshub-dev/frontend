import axiosClient from './axiosClient';
import type { StaffAttendanceRecord } from './attendanceService';

/** A one-time check-in request that the registered phone must approve with a fingerprint. */
export interface AttendanceVerification {
  id: number;
  action: 'CHECK_IN' | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | string;
  source: 'WEB' | 'APP' | string;
  workMode?: string;
  requestedFrom?: string;
  createdAt: string;
  expiresAt: string;
  /** Present only while PENDING: the exact text the phone signs. */
  signedMessage?: string;
}

const BASE = '/api/attendance/verification';

export const attendanceVerificationService = {
  /** Starts a check-in. From the web, the server also pushes an approval request to the phone. */
  start(params: { source: 'WEB' | 'APP'; workMode?: string; note?: string }): Promise<AttendanceVerification> {
    return axiosClient.post(BASE, params);
  },

  get(id: number | string): Promise<AttendanceVerification> {
    return axiosClient.get(`${BASE}/${id}`);
  },

  /** Newest open request for the logged-in user, or null. */
  async getPending(): Promise<AttendanceVerification | null> {
    const res = await axiosClient.get<AttendanceVerification | ''>(`${BASE}/pending`);
    return res && typeof res === 'object' ? res : null;
  },

  approve(id: number | string, signature: string, deviceId: string): Promise<StaffAttendanceRecord> {
    return axiosClient.post(`${BASE}/${id}/approve`, { signature, deviceId });
  },

  reject(id: number | string): Promise<AttendanceVerification> {
    return axiosClient.post(`${BASE}/${id}/reject`);
  },
};

/** Short, readable description of where a web request came from (from its User-Agent). */
export function describeRequestSource(userAgent?: string): string {
  if (!userAgent) return 'a web browser';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'a browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'Mac'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

export default attendanceVerificationService;
