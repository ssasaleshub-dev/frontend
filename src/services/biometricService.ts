/**
 * Fingerprint attendance.
 *
 * Fingerprints can only be verified by the SSA Android app. At registration the app creates a key
 * pair in the phone's secure hardware that can only sign after a successful fingerprint scan, and
 * sends the public key to the server (an admin then approves/locks it). Each check-in is a one-time
 * server challenge that the phone signs; the server verifies the signature. A browser cannot
 * produce that signature, so web check-ins are approved on the registered phone.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import axiosClient from './api/axiosClient';

export interface StaffBiometricCredential {
  id?: number;
  userId: string;
  userName?: string;
  deviceId: string;
  deviceName?: string;
  biometricKeyId: string;
  /** Present for registrations made with the fingerprint-locked key (required for check-in). */
  publicKey?: string;
  status: 'PENDING_APPROVAL' | 'LOCKED' | 'REVOKED' | string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  createdAt?: string;
}

export interface BiometricDeviceInfo {
  deviceId: string;
  deviceName: string;
  manufacturer?: string;
  model?: string;
}

export interface BiometricPromptResult {
  success: boolean;
  deviceId?: string;
  deviceName?: string;
  biometricKeyId?: string;
  error?: string;
  errorCode?: number;
}

export interface SignChallengeResult {
  success: boolean;
  signature?: string;
  deviceId?: string;
  deviceName?: string;
  code?: string;
  error?: string;
}

interface BiometricPluginInterface {
  isAvailable(): Promise<{ available: boolean; status?: number; error?: string }>;
  getDeviceInfo(): Promise<BiometricDeviceInfo>;
  promptBiometric(options: {
    title: string;
    subtitle: string;
    description?: string;
  }): Promise<BiometricPromptResult>;
  createAttendanceKey(options: { userId: string }): Promise<{ publicKey: string; deviceId: string; deviceName: string }>;
  hasAttendanceKey(options: { userId: string }): Promise<{ exists: boolean }>;
  signChallenge(options: { userId: string; message: string; title?: string; subtitle?: string }): Promise<SignChallengeResult>;
  unlockAttendanceKey(options: { userId: string; title?: string; subtitle?: string }): Promise<SignChallengeResult>;
  signWithUnlockedKey(options: { message: string }): Promise<SignChallengeResult>;
  cancelUnlock(): Promise<void>;
}

export const FINGERPRINT_APP_ONLY_MESSAGE =
  'Fingerprint verification is only available in the SSA Android app.';

const NativeBiometric = registerPlugin<BiometricPluginInterface>('BiometricPlugin');

const STORAGE_KEY_PREFIX = 'ssa_biometric_';

export const biometricService = {
  /**
   * Check if biometric authentication is available on this device/platform
   */
  async isBiometricAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeBiometric.isAvailable();
        return Boolean(res?.available);
      } catch (e) {
        console.warn('Native biometric availability check failed:', e);
        return false;
      }
    }

    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      try {
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
          return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
      } catch {
        return false;
      }
    }

    return true;
  },

  /**
   * Retrieve physical device info (Hardware Android ID on mobile or terminal ID on web)
   */
  async getDeviceInfo(): Promise<BiometricDeviceInfo> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await NativeBiometric.getDeviceInfo();
      } catch (err) {
        console.warn('Failed reading native device info:', err);
      }
    }

    // Web / Terminal persistent Device ID
    let deviceId = 'OFFICE-DEVICE-01';
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('ssa_office_device_id');
      if (stored) {
        deviceId = stored;
      } else {
        deviceId = `OFFICE-TAB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        localStorage.setItem('ssa_office_device_id', deviceId);
      }
    }

    const platformDesc = typeof navigator !== 'undefined' ? navigator.userAgent : 'Office Terminal';
    let deviceName = 'Office Device (Samsung Tab)';
    if (platformDesc.includes('Android')) {
      deviceName = 'Office Device (Android Tablet)';
    } else if (platformDesc.includes('Windows')) {
      deviceName = 'Office Terminal (Windows Workstation)';
    } else if (platformDesc.includes('Macintosh')) {
      deviceName = 'Office Terminal (Mac Station)';
    }

    return {
      deviceId,
      deviceName,
      manufacturer: 'Office Systems',
      model: deviceId,
    };
  },

  /**
   * Launch native biometric prompt or WebAuthn platform prompt
   */
  async promptBiometric(options: {
    title: string;
    subtitle: string;
    description?: string;
  }): Promise<BiometricPromptResult> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await NativeBiometric.promptBiometric({
          title: options.title,
          subtitle: options.subtitle,
          description: options.description || 'Enterprise Office Attendance Biometric Validation',
        });
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Biometric hardware sensor error',
        };
      }
    }

    // A browser cannot verify a fingerprint; never report success here
    return { success: false, error: FINGERPRINT_APP_ONLY_MESSAGE };
  },

  /**
   * Flow 1: First-Time Biometric Registration
   * Prompts native fingerprint scanner, retrieves hardware device ID, enrolls at backend,
   * and saves credential in local encrypted storage.
   */
  async registerOfficeFingerprint(params: {
    userId: string;
    userName?: string;
  }): Promise<StaffBiometricCredential> {
    const cleanUserId = params.userId.trim().toLowerCase();

    if (!Capacitor.isNativePlatform()) {
      throw new Error(`${FINGERPRINT_APP_ONLY_MESSAGE} Open the app on your phone to register.`);
    }

    // 1. Confirm a fingerprint is enrolled and the person holding the phone can use it
    const promptRes = await this.promptBiometric({
      title: 'Register Office Fingerprint',
      subtitle: 'Scan your fingerprint to link this phone to your account',
      description: 'Check-ins will need this phone and your fingerprint',
    });

    if (!promptRes.success) {
      throw new Error(promptRes.error || 'Fingerprint verification failed or was cancelled');
    }

    // 2. Create the fingerprint-locked key in the phone's secure hardware
    const key = await NativeBiometric.createAttendanceKey({ userId: cleanUserId });

    const deviceId = key.deviceId || promptRes.deviceId || '';
    const deviceName = key.deviceName || promptRes.deviceName || 'Android phone';
    const biometricKeyId = promptRes.biometricKeyId || `BIO-KEY-${Date.now()}`;

    // 3. Register the public key with the server (an admin must then approve it)
    const payload = {
      userId: cleanUserId,
      userName: params.userName || cleanUserId,
      deviceId,
      deviceName,
      biometricKeyId,
      publicKey: key.publicKey,
    };

    const enrolled = await axiosClient.post<StaffBiometricCredential>(
      '/api/attendance/biometric/enroll',
      payload
    );

    // 3. Store in encrypted local app storage
    this.saveStoredBiometric(cleanUserId, {
      id: enrolled.id,
      userId: cleanUserId,
      userName: enrolled.userName || params.userName,
      deviceId: enrolled.deviceId || deviceId,
      deviceName: enrolled.deviceName || deviceName,
      biometricKeyId: enrolled.biometricKeyId || biometricKeyId,
      status: enrolled.status || 'PENDING_APPROVAL',
      isLocked: enrolled.isLocked || false,
    });

    return enrolled;
  },

  /**
   * Shows the fingerprint prompt and signs a server check-in challenge with this phone's
   * fingerprint-locked key. Android app only.
   */
  async signAttendanceChallenge(params: {
    userId: string;
    message: string;
    title?: string;
    subtitle?: string;
  }): Promise<{ signature: string; deviceId: string }> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error(FINGERPRINT_APP_ONLY_MESSAGE);
    }
    const res = await NativeBiometric.signChallenge({
      userId: params.userId.trim().toLowerCase(),
      message: params.message,
      title: params.title,
      subtitle: params.subtitle,
    });
    if (!res?.success || !res.signature || !res.deviceId) {
      const error: any = new Error(res?.error || 'Fingerprint verification was cancelled');
      error.code = res?.code;
      throw error;
    }
    return { signature: res.signature, deviceId: res.deviceId };
  },

  /**
   * Fast check-in, step 1: show the fingerprint prompt right away. Resolves once the finger is
   * accepted; the unlocked key is then held (single use, ~1 minute) for signWithUnlockedKey.
   */
  async unlockAttendanceKey(params: { userId: string; title?: string; subtitle?: string }): Promise<{ deviceId: string }> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error(FINGERPRINT_APP_ONLY_MESSAGE);
    }
    const res = await NativeBiometric.unlockAttendanceKey({
      userId: params.userId.trim().toLowerCase(),
      title: params.title,
      subtitle: params.subtitle,
    });
    if (!res?.success || !res.deviceId) {
      const error: any = new Error(res?.error || 'Fingerprint verification was cancelled');
      error.code = res?.code;
      throw error;
    }
    return { deviceId: res.deviceId };
  },

  /** Fast check-in, step 2: sign the server's one-time message with the unlocked key. */
  async signWithUnlockedKey(message: string): Promise<string> {
    const res = await NativeBiometric.signWithUnlockedKey({ message });
    if (!res?.success || !res.signature) {
      const error: any = new Error(res?.error || 'Fingerprint confirmation expired. Please try again.');
      error.code = res?.code;
      throw error;
    }
    return res.signature;
  },

  /** Closes an open fingerprint prompt (used when the server refuses the check-in meanwhile). */
  async cancelUnlock(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBiometric.cancelUnlock();
    } catch {
      // older app build without this method: nothing to cancel
    }
  },

  /** Whether this phone holds the fingerprint key for the user (Android app only). */
  async hasAttendanceKey(userId: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const res = await NativeBiometric.hasAttendanceKey({ userId: userId.trim().toLowerCase() });
      return Boolean(res?.exists);
    } catch {
      return false;
    }
  },

  /**
   * Local Encrypted Storage Helpers
   */
  saveStoredBiometric(userId: string, data: Partial<StaffBiometricCredential>): void {
    if (typeof window === 'undefined') return;
    try {
      const cleanUser = userId.trim().toLowerCase();
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanUser}`, JSON.stringify(data));
      // Also cache global active device ID
      if (data.deviceId) {
        localStorage.setItem('ssa_office_device_id', data.deviceId);
      }
    } catch (e) {
      console.warn('Failed saving local biometric credentials:', e);
    }
  },

  getStoredBiometric(userId: string): Partial<StaffBiometricCredential> | null {
    if (typeof window === 'undefined') return null;
    try {
      const cleanUser = userId.trim().toLowerCase();
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${cleanUser}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  clearStoredBiometric(userId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const cleanUser = userId.trim().toLowerCase();
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${cleanUser}`);
    } catch {
      // ignore
    }
  },

  /**
   * Fetch user's registered credentials from backend
   */
  async getUserCredentials(userId: string): Promise<StaffBiometricCredential[]> {
    if (!userId) return [];
    try {
      const cleanUser = userId.trim().toLowerCase();
      const res = await axiosClient.get<StaffBiometricCredential[]>(
        `/api/attendance/biometric/user/${cleanUser}`
      );
      if (Array.isArray(res) && res.length > 0) {
        // Sync local storage with latest server status
        const latest = res[res.length - 1];
        this.saveStoredBiometric(cleanUser, latest);
        return res;
      }
    } catch (e) {
      console.warn('Failed loading user biometric credentials:', e);
    }
    return [];
  },

  /**
   * Part 2 Admin API: Fetch all pending fingerprint registrations requiring Admin approval
   */
  async getPendingApprovals(): Promise<StaffBiometricCredential[]> {
    const res = await axiosClient.get<StaffBiometricCredential[]>('/api/attendance/biometric/pending');
    return Array.isArray(res) ? res : [];
  },

  /**
   * Part 2 Admin API: Fetch all registered biometric credentials
   */
  async getAllCredentials(): Promise<StaffBiometricCredential[]> {
    const res = await axiosClient.get<StaffBiometricCredential[]>('/api/attendance/biometric/credentials');
    return Array.isArray(res) ? res : [];
  },

  /**
   * Part 2 Admin API: Admin locks and permanently approves staff fingerprint on office device
   */
  async lockCredential(id: number | string): Promise<StaffBiometricCredential> {
    const res = await axiosClient.put<StaffBiometricCredential>(
      `/api/attendance/biometric/${id}/lock`
    );
    return res;
  },

  /**
   * Part 2 Admin API: Admin revokes an approved fingerprint credential
   */
  async revokeCredential(id: number | string): Promise<StaffBiometricCredential> {
    const res = await axiosClient.put<StaffBiometricCredential>(
      `/api/attendance/biometric/${id}/revoke`
    );
    return res;
  },
};

export default biometricService;
