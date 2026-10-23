import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
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

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
      resolveCallbackRef.current = () => resolve();
      onConfirmCallbackRef.current = opts.onConfirm || null;

      setAlertState({
        isOpen: true,
        type: 'alert',
        title: opts.title || 'App',
        message: opts.message || '',
        confirmText: opts.buttonText || 'OK',
        cancelText: 'Cancel',
        isDestructive: false,
      });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      resolveCallbackRef.current = (val: boolean) => resolve(val);
      onConfirmCallbackRef.current = null;

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

  const handleConfirm = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (onConfirmCallbackRef.current) {
      onConfirmCallbackRef.current();
    }
    if (resolveCallbackRef.current) {
      resolveCallbackRef.current(true);
      resolveCallbackRef.current = null;
    }
  };

  const handleCancel = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (resolveCallbackRef.current) {
      resolveCallbackRef.current(false);
      resolveCallbackRef.current = null;
    }
  };

  const closeAlert = useCallback(() => {
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

      {/* Authentic iOS Alert Modal Backdrop & Dialog */}
      {alertState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
        >
          <div
            className="w-[270px] max-w-[85vw] bg-white/95 backdrop-blur-xl rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden text-center select-none border border-black/5 transform transition-transform duration-150 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Body */}
            <div className="px-4 pt-5 pb-4">
              <h3 className="font-semibold text-[17px] text-slate-900 leading-snug tracking-[-0.015em]">
                {alertState.title}
              </h3>
              {alertState.message && (
                <p className="mt-1 text-[13px] text-slate-700 leading-[1.35] tracking-[-0.01em] whitespace-pre-line">
                  {alertState.message}
                </p>
              )}
            </div>

            {/* Actions Bar */}
            {alertState.type === 'alert' ? (
              <div className="border-t border-[#3c3c43]/18">
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
              <div className="border-t border-[#3c3c43]/18 grid grid-cols-2 divide-x divide-[#3c3c43]/18">
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
