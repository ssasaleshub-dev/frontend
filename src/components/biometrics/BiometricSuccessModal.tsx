import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface BiometricSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  timestamp: string;
  deviceId?: string;
}

/**
 * Enterprise MNC-Grade Reusable Biometric Check-In Confirmation Modal
 */
export const BiometricSuccessModal: React.FC<BiometricSuccessModalProps> = ({
  isOpen,
  onClose,
  userName,
  userId,
  timestamp,
  deviceId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-black/[0.08] p-6 max-w-md w-full shadow-2xl text-center space-y-4">
        {/* Verification Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 size={36} />
        </div>

        {/* Header & Status */}
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider mb-2">
            Biometric Verified
          </span>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Attendance Checked In!</h3>
          <p className="text-xs text-slate-600 mt-1">
            Your fingerprint was verified and bound to the office device. Today's shift status has been set to{' '}
            <strong className="text-emerald-700">CHECKED IN (On Duty)</strong>.
          </p>
        </div>

        {/* Verification Metadata Box */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-left space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Employee:</span>
            <span className="font-semibold text-slate-800">
              {userName} (@{userId})
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Timestamp (IST):</span>
            <span className="font-mono font-semibold text-emerald-700">{timestamp}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Office Hardware ID:</span>
            <span className="font-mono text-slate-700 text-[11px]">
              {deviceId || 'OFFICE-DEVICE'}
            </span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors active:scale-98"
        >
          Continue to Workspace
        </button>
      </div>
    </div>
  );
};

export default BiometricSuccessModal;
