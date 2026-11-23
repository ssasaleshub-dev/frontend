import React from 'react';
import { Loader2, RefreshCw, UploadCloud, CheckCircle2 } from 'lucide-react';

export type SmallLoaderSize = 'xs' | 'sm' | 'md' | 'lg';
export type SmallLoaderColor = 'primary' | 'white' | 'slate' | 'emerald' | 'amber' | 'blue';
export type SmallLoaderVariant = 'inline' | 'card' | 'overlay' | 'pill';

export interface SmallLoaderProps {
  /** Size of the spinner: xs (14px), sm (16px), md (22px), lg (32px) */
  size?: SmallLoaderSize;
  /** Color theme */
  color?: SmallLoaderColor;
  /** Display text next to or below the spinner */
  text?: string;
  /** Secondary helper text */
  subtext?: string;
  /** Visual layout style */
  variant?: SmallLoaderVariant;
  /** Optional upload/processing progress percentage (0 - 100) */
  progress?: number;
  /** Optional custom CSS classes */
  className?: string;
}

const SIZE_MAP: Record<SmallLoaderSize, { iconSize: number; textClass: string; subtextClass: string; px: number }> = {
  xs: { iconSize: 13, textClass: 'text-[11px]', subtextClass: 'text-[10px]', px: 14 },
  sm: { iconSize: 16, textClass: 'text-xs', subtextClass: 'text-[11px]', px: 18 },
  md: { iconSize: 22, textClass: 'text-sm font-medium', subtextClass: 'text-xs', px: 24 },
  lg: { iconSize: 32, textClass: 'text-base font-semibold', subtextClass: 'text-xs', px: 32 },
};

const COLOR_MAP: Record<SmallLoaderColor, { strokeColor: string; text: string }> = {
  primary: { strokeColor: '#1a73e8', text: 'text-slate-700' },
  blue: { strokeColor: '#4285f4', text: 'text-blue-700' },
  white: { strokeColor: '#ffffff', text: 'text-white' },
  slate: { strokeColor: '#5f6368', text: 'text-slate-600' },
  emerald: { strokeColor: '#0f9d58', text: 'text-emerald-700' },
  amber: { strokeColor: '#f4b400', text: 'text-amber-700' },
};

/**
 * Authentic Google Material circular spinner
 */
export const SpinnerGraphic: React.FC<{ size: SmallLoaderSize; color: SmallLoaderColor }> = ({ size, color }) => {
  const { px } = SIZE_MAP[size];
  const { strokeColor } = COLOR_MAP[color];

  return (
    <div
      style={{ width: px, height: px }}
      className="relative inline-flex items-center justify-center shrink-0"
    >
      <svg
        className="w-full h-full animate-[gSpin_2s_linear_infinite]"
        viewBox="0 0 50 50"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          className="animate-[gDash_1.5s_ease-in-out_infinite]"
        />
      </svg>
    </div>
  );
};

/**
 * Versatile Small Loader for file uploads, inline buttons, pull-to-refresh, and card loading
 */
export const SmallLoader: React.FC<SmallLoaderProps> = ({
  size = 'sm',
  color = 'primary',
  text,
  subtext,
  variant = 'inline',
  progress,
  className = '',
}) => {
  const { textClass, subtextClass } = SIZE_MAP[size];
  const colorScheme = COLOR_MAP[color];

  // Overlay variant (e.g. for card or section blocking during upload/refresh)
  if (variant === 'overlay') {
    return (
      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs rounded-xl p-4 transition-all duration-200 ${className}`}>
        <div className="flex flex-col items-center gap-2 max-w-xs text-center">
          <SpinnerGraphic size={size === 'xs' ? 'sm' : size} color={color} />
          {text && <span className={`${textClass} ${colorScheme.text}`}>{text}</span>}
          {typeof progress === 'number' && (
            <div className="w-36 bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1 border border-slate-200/60">
              <div
                className="bg-[#0866ff] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
          {subtext && <span className={`${subtextClass} text-slate-400`}>{subtext}</span>}
        </div>
      </div>
    );
  }

  // Card variant (for dedicated empty-states or section loading)
  if (variant === 'card') {
    return (
      <div className={`flex flex-col items-center justify-center py-6 px-4 bg-slate-50/70 border border-slate-100 rounded-xl text-center gap-2.5 ${className}`}>
        <SpinnerGraphic size={size} color={color} />
        {text && <span className={`${textClass} ${colorScheme.text}`}>{text}</span>}
        {typeof progress === 'number' && (
          <div className="w-40 bg-slate-200/70 rounded-full h-1.5 overflow-hidden border border-slate-200">
            <div
              className="bg-[#0866ff] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        {subtext && <span className={`${subtextClass} text-slate-400 max-w-xs`}>{subtext}</span>}
      </div>
    );
  }

  // Pill badge variant (for status bars, table headers, quick indicator)
  if (variant === 'pill') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-100/80 text-blue-700 shadow-2xs ${className}`}>
        <SpinnerGraphic size="xs" color="primary" />
        {text && <span className="text-[11px] font-semibold">{text}</span>}
        {typeof progress === 'number' && (
          <span className="text-[10px] font-bold text-blue-600 font-mono ml-0.5">{Math.round(progress)}%</span>
        )}
      </span>
    );
  }

  // Default inline variant (e.g. inside buttons, headers, beside labels)
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <SpinnerGraphic size={size} color={color} />
      {text && <span className={`${textClass} ${colorScheme.text}`}>{text}</span>}
      {typeof progress === 'number' && (
        <span className={`${subtextClass} font-semibold font-mono text-slate-500`}>
          {Math.round(progress)}%
        </span>
      )}
    </span>
  );
};

/**
 * Quick button spinner helper (e.g. `<ButtonSpinner /> Saving...`)
 */
export const ButtonSpinner: React.FC<{ size?: SmallLoaderSize; color?: SmallLoaderColor; className?: string }> = ({
  size = 'sm',
  color = 'white',
  className = '',
}) => {
  return <SpinnerGraphic size={size} color={color} />;
};

/**
 * Specialized File Upload Loader (with cloud icon and smooth progress animation)
 */
export const UploadLoader: React.FC<{
  text?: string;
  subtext?: string;
  progress?: number;
  fileName?: string;
  isComplete?: boolean;
  className?: string;
}> = ({
  text = 'Uploading document...',
  subtext,
  progress,
  fileName,
  isComplete = false,
  className = '',
}) => {
  return (
    <div className={`p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0866ff] flex items-center justify-center shrink-0">
            {isComplete ? (
              <CheckCircle2 size={18} className="text-emerald-500 animate-in fade-in zoom-in-75 duration-200" />
            ) : (
              <UploadCloud size={18} className="animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{fileName || text}</p>
            {subtext && <p className="text-[11px] text-slate-400 truncate">{subtext}</p>}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {!isComplete ? (
            <SpinnerGraphic size="xs" color="primary" />
          ) : (
            <span className="text-[11px] font-semibold text-emerald-600">Done</span>
          )}
          {typeof progress === 'number' && !isComplete && (
            <span className="text-xs font-bold text-slate-600 font-mono">{Math.round(progress)}%</span>
          )}
        </div>
      </div>

      {typeof progress === 'number' && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              isComplete ? 'bg-emerald-500' : 'bg-[#0866ff]'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Specialized Refresh Loader (e.g. for page refresh, pull-to-refresh, live sync indicator)
 */
export const RefreshLoader: React.FC<{
  text?: string;
  isFloating?: boolean;
  className?: string;
}> = ({
  text = 'Refreshing...',
  isFloating = false,
  className = '',
}) => {
  if (isFloating) {
    return (
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 ${className}`}>
        <SpinnerGraphic size="xs" color="primary" />
        <span className="text-xs font-semibold text-slate-700">{text}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-2 py-3 px-4 text-xs font-medium text-slate-500 ${className}`}>
      <SpinnerGraphic size="sm" color="primary" />
      <span>{text}</span>
    </div>
  );
};

export default SmallLoader;
