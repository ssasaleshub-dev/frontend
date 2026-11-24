import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import biometricService, { StaffBiometricCredential } from '../services/biometricService';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import attendanceVerificationService from '../services/api/attendanceVerificationService';
import { useAlert } from '../context/AlertContext';
import { formatIndianTime } from '../utils/dateTimeUtils';
import { captureExactLocation } from '../utils/locationUtils';

export interface UseBiometricAttendanceParams {
  userId: string;
  userName?: string;
  userRole?: string;
  workMode?: 'OFFICE' | 'REMOTE' | 'FIELD';
  note?: string;
  onSuccess?: (record: StaffAttendanceRecord) => void;
  showToast?: (message: string) => void;
}

/** A web check-in waiting for approval on the registered phone. */
export interface PhoneApprovalState {
  challengeId: number;
  expiresAt: string;
}

export interface UseBiometricAttendanceReturn {
  biometricCred: Partial<StaffBiometricCredential> | null;
  /** Set while a web check-in waits for fingerprint approval on the phone. */
  phoneApproval: PhoneApprovalState | null;
  cancelPhoneApproval: () => Promise<void>;
  enrollingBiometric: boolean;
  punching: boolean;
  successModal: { isOpen: boolean; timestamp: string; deviceName?: string } | null;
  closeSuccessModal: () => void;
  handleRegisterBiometric: () => Promise<void>;
  handleBiometricCheckIn: () => Promise<StaffAttendanceRecord | null>;
  refreshBiometric: () => Promise<void>;
}

/**
 * Enterprise MNC-Grade Custom Hook for Biometric Attendance & Device Locking
 * Decouples biometric state, hardware binding, and check-in workflows.
 */
export function useBiometricAttendance({
  userId,
  userName,
  workMode = 'OFFICE',
  note = '',
  onSuccess,
  showToast,
}: UseBiometricAttendanceParams): UseBiometricAttendanceReturn {
  const { showAlert } = useAlert();

  const [biometricCred, setBiometricCred] = useState<Partial<StaffBiometricCredential> | null>(() => {
    if (!userId) return null;
    return biometricService.getStoredBiometric(userId);
  });
  const [enrollingBiometric, setEnrollingBiometric] = useState<boolean>(false);
  const [punching, setPunching] = useState<boolean>(false);
  const [phoneApproval, setPhoneApproval] = useState<PhoneApprovalState | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    timestamp: string;
    deviceName?: string;
  } | null>(null);

  // Sync user credentials from backend
  const refreshBiometric = useCallback(async () => {
    if (!userId) return;
    const local = biometricService.getStoredBiometric(userId);
    if (local) setBiometricCred(local);

    try {
      const remoteCreds = await biometricService.getUserCredentials(userId);
      if (Array.isArray(remoteCreds) && remoteCreds.length > 0) {
        setBiometricCred(remoteCreds[remoteCreds.length - 1]);
      }
    } catch {
      // offline / fallback
    }
  }, [userId]);

  useEffect(() => {
    refreshBiometric();
  }, [refreshBiometric]);

  // Flow 1: First-Time Biometric Registration
  const handleRegisterBiometric = useCallback(async () => {
    if (!userId) return;
    setEnrollingBiometric(true);
    try {
      const enrolled = await biometricService.registerOfficeFingerprint({
        userId,
        userName,
      });
      setBiometricCred(enrolled);
      showAlert({
        title: 'Office Fingerprint Registered',
        message: 'Fingerprint registered successfully! Awaiting Admin approval and lock before you can check in.',
        icon: 'success',
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const raw = err?.response?.data?.detail || err?.response?.data?.message || err?.message || '';
      let msg = raw || 'Biometric enrollment failed';
      if (/cancel/i.test(raw)) {
        msg = 'Fingerprint setup was cancelled.';
      } else if (status === 403) {
        msg = 'Permission denied. Please verify your staff account permissions.';
      }
      showAlert({
        title: 'Biometric Enrollment',
        message: msg,
      });
    } finally {
      setEnrollingBiometric(false);
    }
  }, [userId, userName, showAlert]);

  const announceSuccess = useCallback(
    (result: StaffAttendanceRecord, deviceName?: string) => {
      const timeFormatted = result.checkInTime
        ? formatIndianTime(result.checkInTime, { includeSeconds: true })
        : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      setSuccessModal({ isOpen: true, timestamp: timeFormatted, deviceName });
      if (showToast) showToast('Checked in with fingerprint verification.');
      if (onSuccess) onSuccess(result);
    },
    [showToast, onSuccess]
  );

  // Flow 2: Daily check-in with fingerprint verification.
  // - In the Android app: the phone signs a one-time server challenge right here.
  // - On the web: the server pushes an approval request to the registered phone and this page
  //   waits until it is approved, declined, or expires.
  const handleBiometricCheckIn = useCallback(async (): Promise<StaffAttendanceRecord | null> => {
    if (!userId) return null;
    setPunching(true);
    cancelledRef.current = false;
    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Show the native fingerprint prompt IMMEDIATELY with ZERO delay!
        const unlockPromise = biometricService.unlockAttendanceKey({
          userId,
          title: 'Check in',
          subtitle: 'Scan your fingerprint to record your attendance',
        });
        unlockPromise.catch(() => {}); // handled below

        // 2. Fetch one-time challenge from server in parallel while user scans finger
        // Non-blocking location capture (max 400ms or cached) so server request starts instantly
        let gpsLocation = '';
        try {
          gpsLocation = await Promise.race([
            captureExactLocation(600).catch(() => ''),
            new Promise<string>((r) => setTimeout(() => r(''), 350)),
          ]);
        } catch {}

        const noteWithGps = [gpsLocation ? `📍 ${gpsLocation}` : '', note.trim()].filter(Boolean).join(' | ');

        let challenge;
        try {
          challenge = await attendanceVerificationService.start({ source: 'APP', workMode, note: noteWithGps });
          if (!challenge.signedMessage) throw new Error('Check-in request could not be started.');
        } catch (startErr) {
          // The server refused (e.g. fingerprint not approved yet): close the prompt right away
          await biometricService.cancelUnlock();
          throw startErr;
        }

        let unlocked;
        try {
          unlocked = await unlockPromise;
        } catch (unlockErr) {
          // Cancelled or failed scan: drop the unused code instead of leaving it pending
          attendanceVerificationService.reject(challenge.id).catch(() => {});
          throw unlockErr;
        }

        const signature = await biometricService.signWithUnlockedKey(challenge.signedMessage);
        const result = await attendanceVerificationService.approve(challenge.id, signature, unlocked.deviceId);
        announceSuccess(result, biometricCred?.deviceName || unlocked.deviceId);
        return result;
      }

      // Web: approval happens on the phone
      const gpsLocation = await captureExactLocation(1000).catch(() => '');
      const noteWithGps = [gpsLocation ? `📍 ${gpsLocation}` : '', note.trim()].filter(Boolean).join(' | ');
      const challenge = await attendanceVerificationService.start({ source: 'WEB', workMode, note: noteWithGps });
      setPhoneApproval({ challengeId: challenge.id, expiresAt: challenge.expiresAt });

      const deadline = new Date(challenge.expiresAt).getTime() + 5000;
      while (!cancelledRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1000));
        if (cancelledRef.current) break;
        let verification;
        try {
          verification = await attendanceVerificationService.get(challenge.id);
        } catch {
          continue; // transient network error: keep waiting until the deadline
        }
        const status = verification?.status;
        if (status === 'APPROVED') {
          // Immediately close the waiting sheet so UI transitions cleanly
          setPhoneApproval(null);
          attendanceService.invalidateTodayCache(userId);

          // Force fresh fetch from server
          let record = await attendanceService.getTodayAttendance(userId, true);
          if (!record?.checkInTime) {
            // Brief 400ms pause if server DB write is completing
            await new Promise((r) => setTimeout(r, 400));
            record = await attendanceService.getTodayAttendance(userId, true);
          }

          // Fallback optimistic record if server response was delayed
          if (!record || !record.checkInTime) {
            record = {
              userId,
              userName: userName || userId,
              userRole: userRole || 'STAFF',
              attendanceDate: new Date().toLocaleDateString('en-CA'),
              checkInTime: new Date().toISOString(),
              workMode: workMode || 'OFFICE',
              status: 'PRESENT',
              totalMinutes: 0,
              totalHoursFormatted: 'In Progress',
              isCheckedIn: true,
            };
            attendanceService.saveLocalRecord(userId, record);
          }

          announceSuccess(record, 'Approved on your phone');
          attendanceService.broadcastUpdate();
          return record;
        }
        if (status === 'REJECTED') {
          showAlert({ title: 'Check-in Declined', message: 'The check-in was declined on your phone.' });
          return null;
        }
        if (status === 'EXPIRED') break;
      }
      if (!cancelledRef.current) {
        showAlert({
          title: 'Check-in Not Approved',
          message: 'The request expired before it was approved on your phone. Please try again.',
        });
      }
      return null;
    } catch (err: any) {
      const status = err?.response?.status;
      const rawDetail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        '';

      let errorTitle = 'Check-in Blocked';
      let errorMsg = rawDetail || 'Check-in failed';

      if (
        status === 403 ||
        /403|approved|approval|not approved|unauthorized|forbidden|no approved fingerprint/i.test(rawDetail)
      ) {
        errorTitle = 'Device Awaiting Admin Approval';
        errorMsg =
          'Your fingerprint is registered on this device, but requires Administrator approval before you can check in.\n\nPlease ask an Administrator to approve and lock this device under Biometric Approvals.';
      } else if (status === 401) {
        errorTitle = 'Session Expired';
        errorMsg = 'Your session has expired. Please sign in again to record attendance.';
      } else if (/cancel|user.*cancel/i.test(rawDetail)) {
        errorTitle = 'Fingerprint Cancelled';
        errorMsg = 'Fingerprint scan was cancelled. Please tap Check In again when ready.';
      }

      showAlert({
        title: errorTitle,
        message: errorMsg,
      });
      return null;
    } finally {
      setPhoneApproval(null);
      setPunching(false);
    }
  }, [userId, workMode, note, showAlert, announceSuccess, biometricCred?.deviceName]);

  /** Stops waiting and declines the pending web request. */
  const cancelPhoneApproval = useCallback(async () => {
    cancelledRef.current = true;
    const pending = phoneApproval;
    setPhoneApproval(null);
    if (pending) {
      await attendanceVerificationService.reject(pending.challengeId).catch(() => {});
    }
  }, [phoneApproval]);

  const closeSuccessModal = useCallback(() => {
    setSuccessModal(null);
  }, []);

  return {
    biometricCred,
    phoneApproval,
    cancelPhoneApproval,
    enrollingBiometric,
    punching,
    successModal,
    closeSuccessModal,
    handleRegisterBiometric,
    handleBiometricCheckIn,
    refreshBiometric,
  };
}

export default useBiometricAttendance;
