import { useState, useEffect, useCallback } from 'react';
import biometricService, { StaffBiometricCredential } from '../services/biometricService';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import { useAlert } from '../context/AlertContext';
import { formatIndianTime } from '../utils/dateTimeUtils';

export interface UseBiometricAttendanceParams {
  userId: string;
  userName?: string;
  userRole?: string;
  workMode?: 'OFFICE' | 'REMOTE' | 'FIELD';
  note?: string;
  onSuccess?: (record: StaffAttendanceRecord) => void;
  showToast?: (message: string) => void;
}

export interface UseBiometricAttendanceReturn {
  biometricCred: Partial<StaffBiometricCredential> | null;
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
  userRole,
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

  // Flow 2: Daily Work Check-In with Biometric Verification
  const handleBiometricCheckIn = useCallback(async (): Promise<StaffAttendanceRecord | null> => {
    if (!userId) return null;
    setPunching(true);
    try {
      // 1. Open native biometric scanner prompt
      const bio = await biometricService.verifyFingerprintForCheckIn({
        userId,
      });

      // 2. Call backend check-in endpoint with stored deviceId and biometricKeyId
      const result = await attendanceService.checkIn({
        userId,
        userName,
        userRole,
        workMode,
        note: note.trim(),
        deviceId: bio.deviceId,
        biometricKeyId: bio.biometricKeyId,
        deviceInfo: bio.deviceInfo,
      });

      // 3. HTTP 201 Response Handling: Show green confirmation screen with check-in timestamp
      const timeFormatted = result.checkInTime
        ? formatIndianTime(result.checkInTime, { includeSeconds: true })
        : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

      setSuccessModal({
        isOpen: true,
        timestamp: timeFormatted,
        deviceName: bio.deviceId,
      });

      if (showToast) {
        showToast('Checked in successfully via office biometric sensor!');
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err: any) {
      // 4. HTTP 403 Response Handling: Display the exact server error message to the user
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Check-in failed';
      showAlert({
        title: 'Attendance Blocked',
        message: errorMsg,
      });
      return null;
    } finally {
      setPunching(false);
    }
  }, [userId, userName, userRole, workMode, note, showAlert, showToast, onSuccess]);

  const closeSuccessModal = useCallback(() => {
    setSuccessModal(null);
  }, []);

  return {
    biometricCred,
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
