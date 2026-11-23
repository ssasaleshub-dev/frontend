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
      const errorMsg = err?.response?.data?.message || err?.message || 'Biometric enrollment failed';
      showAlert({
        title: 'Biometric Enrollment',
        message: errorMsg,
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
      // Capture exact GPS location
      const gpsLocation = await captureExactLocation().catch(() => '');
      const noteWithGps = [gpsLocation ? `📍 ${gpsLocation}` : '', note.trim()].filter(Boolean).join(' | ');

      if (Capacitor.isNativePlatform()) {
        // Show the fingerprint prompt immediately and fetch the one-time code from the server at
        // the same time, so the network wait happens while the finger is on the sensor.
        const unlockPromise = biometricService.unlockAttendanceKey({
          userId,
          title: 'Check in',
          subtitle: 'Scan your fingerprint to record your attendance',
        });
        unlockPromise.catch(() => {}); // handled below; avoid an unhandled rejection meanwhile

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
      const challenge = await attendanceVerificationService.start({ source: 'WEB', workMode, note: noteWithGps });
      setPhoneApproval({ challengeId: challenge.id, expiresAt: challenge.expiresAt });

      const deadline = new Date(challenge.expiresAt).getTime() + 5000;
      while (!cancelledRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        if (cancelledRef.current) break;
        let status: string;
        try {
          status = (await attendanceVerificationService.get(challenge.id)).status;
        } catch {
          continue; // transient network error: keep waiting until the deadline
        }
        if (status === 'APPROVED') {
          const record = await attendanceService.getTodayAttendance(userId);
          if (record) announceSuccess(record, 'Approved on your phone');
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
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Check-in failed';
      showAlert({
        title: 'Attendance Blocked',
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
