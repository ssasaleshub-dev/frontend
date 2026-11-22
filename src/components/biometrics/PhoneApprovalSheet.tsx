import React, { useEffect, useState } from 'react';
import { Fingerprint, Smartphone } from 'lucide-react';

export interface PhoneApprovalSheetProps {
  /** ISO time the request expires; the sheet is hidden when null. */
  expiresAt: string | null;
  onCancel: () => void;
}

/**
 * Shown on the web while a check-in waits for fingerprint approval on the registered phone.
 */
export const PhoneApprovalSheet: React.FC<PhoneApprovalSheetProps> = ({ expiresAt, onCancel }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="phone-approval-title">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-2xl bg-blue-100 animate-ping opacity-40" />
          <div className="relative w-16 h-16 rounded-2xl bg-blue-50 text-[#007aff] flex items-center justify-center">
            <Smartphone size={30} />
          </div>
        </div>

        <h2 id="phone-approval-title" className="text-lg font-bold text-slate-900">
          Approve on your phone
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          We sent a request to the SSA app on your registered phone. Open it and confirm with your fingerprint to check in.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Fingerprint size={14} className="text-emerald-600" />
          <span>
            Waiting for approval · <span className="font-mono tabular-nums text-slate-700">{mm}:{ss}</span>
          </span>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Didn't get a notification? Open the SSA app on your phone and go to Profile.
        </p>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PhoneApprovalSheet;
