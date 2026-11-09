import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Check, AlertTriangle, XCircle, Info } from 'lucide-react';

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  icon?: 'success' | 'warning' | 'error' | 'info';
  autoCloseMs?: number;
  onConfirm?: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions | string) => Promise<void>;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertState {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDestructive: boolean;
  icon?: 'success' | 'warning' | 'error' | 'info';
  resolveRef?: (val: any) => void;
  onConfirmCallback?: () => void;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    type: 'alert',
    title: 'App',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    isDestructive: false,
  });

  const resolveCallbackRef = useRef<((val: any) => void) | null>(null);
  const onConfirmCallbackRef = useRef<(() => void) | null>(null);
  const autoCloseTimerRef = useRef<any>(null);

  const handleConfirm = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (onConfirmCallbackRef.current) {
      onConfirmCallbackRef.current();
    }
    if (resolveCallbackRef.current) {
      resolveCallbackRef.current(true);
      resolveCallbackRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (resolveCallbackRef.current) {
      resolveCallbackRef.current(false);
      resolveCallbackRef.current = null;
    }
  }, []);

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
      resolveCallbackRef.current = () => resolve();
      onConfirmCallbackRef.current = opts.onConfirm || null;

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }

      if (opts.autoCloseMs && opts.autoCloseMs > 0) {
        autoCloseTimerRef.current = setTimeout(() => {
          handleConfirm();
        }, opts.autoCloseMs);
      }

      setAlertState({
        isOpen: true,
        type: 'alert',
        title: opts.title || 'App',
        message: opts.message || '',
        confirmText: opts.buttonText || 'OK',
        cancelText: 'Cancel',
        isDestructive: false,
        icon: opts.icon,
      });
    });
  }, [handleConfirm]);

  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      resolveCallbackRef.current = (val: boolean) => resolve(val);
      onConfirmCallbackRef.current = null;

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }

      setAlertState({
        isOpen: true,
        type: 'confirm',
        title: opts.title || 'App',
        message: opts.message || '',
        confirmText: opts.confirmText || 'OK',
        cancelText: opts.cancelText || 'Cancel',
        isDestructive: Boolean(opts.isDestructive),
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (resolveCallbackRef.current) {
      resolveCallbackRef.current(false);
      resolveCallbackRef.current = null;
    }
  }, []);

  // Intercept window.alert globally so legacy alert() calls also render as the authentic iOS modal
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      showAlert({
        title: 'App',
        message: typeof msg === 'object' ? JSON.stringify(msg) : String(msg ?? ''),
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
      {children}

      {/* Authentic Apple HIG UIAlertController Modal & Materials */}
      {alertState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleConfirm}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-opacity duration-150 animate-in fade-in"
        >
          <div
            className="w-[280px] max-w-[85vw] bg-white rounded-[18px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden text-center select-none border border-black/[0.08] transform transition-transform duration-150 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Body */}
            <div className="px-5 pt-6 pb-4">
              {alertState.icon === 'success' && (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#34c759]/15 text-[#34c759] flex items-center justify-center animate-in zoom-in-75 duration-150">
                  <Check size={26} strokeWidth={2.8} />
                </div>
              )}
              {alertState.icon === 'warning' && (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#ff9500]/15 text-[#ff9500] flex items-center justify-center animate-in zoom-in-75 duration-150">
                  <AlertTriangle size={26} strokeWidth={2.4} />
                </div>
              )}
              {alertState.icon === 'error' && (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#ff3b30]/15 text-[#ff3b30] flex items-center justify-center animate-in zoom-in-75 duration-150">
                  <XCircle size={26} strokeWidth={2.4} />
                </div>
              )}
              {alertState.icon === 'info' && (
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#007aff]/15 text-[#007aff] flex items-center justify-center animate-in zoom-in-75 duration-150">
                  <Info size={26} strokeWidth={2.4} />
                </div>
              )}

              <h3 className="font-semibold text-[17px] text-[#1c1c1e] leading-snug tracking-tight">
                {alertState.title}
              </h3>
              {alertState.message && (
                <p className="mt-1.5 text-[13px] text-[#3c3c43] leading-[1.35] tracking-tight whitespace-pre-line">
                  {alertState.message}
                </p>
              )}
            </div>

            {/* Actions Bar (Apple 44pt Touch Targets) */}
            {alertState.type === 'alert' ? (
              <div className="border-t border-[rgba(60,60,67,0.18)]">
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className="w-full h-[44px] flex items-center justify-center text-[17px] font-semibold text-[#007aff] hover:bg-black/[0.04] active:bg-black/[0.08] transition-colors cursor-pointer select-none"
                >
                  {alertState.confirmText || 'OK'}
                </button>
              </div>
            ) : (
              <div className="border-t border-[rgba(60,60,67,0.18)] grid grid-cols-2 divide-x divide-[rgba(60,60,67,0.18)]">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-[44px] flex items-center justify-center text-[17px] font-normal text-[#007aff] hover:bg-black/[0.04] active:bg-black/[0.08] transition-colors cursor-pointer select-none"
                >
                  {alertState.cancelText || 'Cancel'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirm}
                  className={`h-[44px] flex items-center justify-center text-[17px] font-semibold hover:bg-black/[0.04] active:bg-black/[0.08] transition-colors cursor-pointer select-none ${
                    alertState.isDestructive ? 'text-[#ff3b30]' : 'text-[#007aff]'
                  }`}
                >
                  {alertState.confirmText || 'OK'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
