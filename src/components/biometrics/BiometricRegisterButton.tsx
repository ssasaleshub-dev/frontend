import React from 'react';
import { Fingerprint, ShieldCheck, Loader2 } from 'lucide-react';
import { StaffBiometricCredential } from '../../services/biometricService';

export interface BiometricRegisterButtonProps {
  credential: Partial<StaffBiometricCredential> | null;
  isLoading: boolean;
  onRegister: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Enterprise MNC-Grade Reusable Biometric Hardware Registration Button
 */
export const BiometricRegisterButton: React.FC<BiometricRegisterButtonProps> = ({
  credential,
  isLoading,
  onRegister,
  disabled = false,
  className = '',
}) => {
  const isLocked = Boolean(credential?.isLocked || credential?.status === 'LOCKED');
  const isPending = credential?.status === 'PENDING_APPROVAL';

  if (isLocked) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 ${className}`}
        title={`Hardware ID: ${credential?.deviceId || 'Office Device'}`}
      >
        <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
        <span>Device Locked & Approved</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRegister}
      disabled={disabled || isLoading}
      className={`px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200/80 shadow-xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 size={13} className="animate-spin text-slate-600" />
      ) : (
        <Fingerprint size={14} className="text-emerald-600" />
      )}
      <span>{isPending ? 'Re-bind Fingerprint' : 'Register Office Fingerprint'}</span>
    </button>
  );
};

export default BiometricRegisterButton;
