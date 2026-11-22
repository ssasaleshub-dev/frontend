import React, { useEffect } from 'react';

export interface BiometricSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
  timestamp: string;
  deviceId?: string;
  /** Main line, e.g. "Checked in". */
  title?: string;
}

/** How long the confirmation stays before closing itself, like an iOS success HUD. */
const AUTO_CLOSE_MS = 2600;

/**
 * Check-in confirmation in the style of an iOS system alert: a green ring and checkmark draw in,
 * then a single line of text and the time. Closes itself after a moment, or on "Done".
 */
export const BiometricSuccessModal: React.FC<BiometricSuccessModalProps> = ({
  isOpen,
  onClose,
  timestamp,
  title = 'Checked in',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    // A short tap of haptic feedback on phones that support it
    try {
      navigator.vibrate?.(12);
    } catch {
      // not supported
    }
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ios-success-backdrop fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/25"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-label={`${title}${timestamp ? ` at ${timestamp}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        className="ios-success-card w-[270px] rounded-[18px] bg-white/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.18)] overflow-hidden text-center"
      >
        <div className="px-6 pt-7 pb-5">
          <svg viewBox="0 0 72 72" width="64" height="64" className="mx-auto" aria-hidden="true">
            <circle
              className="ios-success-ring"
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke="#34C759"
              strokeWidth="3.5"
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
            <path
              className="ios-success-check"
              d="M23 37.5 L32 46 L49.5 27.5"
              fill="none"
              stroke="#34C759"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="mt-3.5 text-[17px] font-semibold text-[#1c1c1e] tracking-[-0.01em]">{title}</p>
          {timestamp && <p className="mt-0.5 text-[13px] text-[#8e8e93] tabular-nums">{timestamp}</p>}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 border-t border-black/[0.08] text-[17px] font-semibold text-[#007aff] active:bg-black/[0.04] cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default BiometricSuccessModal;
