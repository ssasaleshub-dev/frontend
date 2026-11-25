import React from 'react';
import './DotsLoader.css';

export type DotsLoaderSize = 'xs' | 'sm' | 'md' | 'lg';

export interface DotsLoaderProps {
  /** Dot size preset */
  size?: DotsLoaderSize;
  /** Optional text label beside/below dots */
  label?: string;
  /** Layout direction when label is provided */
  direction?: 'row' | 'column';
  /** Optional custom CSS classes */
  className?: string;
}

const DOT_COLORS = ['#FFD400', '#8CC63F', '#02A35F', '#02713E'] as const;

const SIZE_CONFIG: Record<
  DotsLoaderSize,
  { dotPx: number; gapPx: number; hopPx: number; heightPx: number; textClass: string }
> = {
  xs: { dotPx: 5, gapPx: 4, hopPx: -5, heightPx: 14, textClass: 'text-[11px]' },
  sm: { dotPx: 7, gapPx: 6, hopPx: -8, heightPx: 20, textClass: 'text-xs' },
  md: { dotPx: 9, gapPx: 8, hopPx: -11, heightPx: 26, textClass: 'text-xs font-medium' },
  lg: { dotPx: 12, gapPx: 10, hopPx: -15, heightPx: 34, textClass: 'text-sm font-medium' },
};

/**
 * Common 4-dot bouncing ("ball drop") loader shared by splash, uploads, and feature views.
 */
export const DotsLoader: React.FC<DotsLoaderProps> = ({
  size = 'sm',
  label,
  direction = 'row',
  className = '',
}) => {
  const cfg = SIZE_CONFIG[size];

  return (
    <span
      className={`inline-flex items-center justify-center ${
        direction === 'column' ? 'flex-col gap-2' : 'gap-2'
      } ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    >
      <span
        className="ssa-dots-loader"
        style={{ gap: `${cfg.gapPx}px`, height: `${cfg.heightPx}px` }}
        aria-hidden="true"
      >
        {DOT_COLORS.map((color, idx) => (
          <i
            key={color}
            className="ssa-dots-loader-dot"
            style={
              {
                width: `${cfg.dotPx}px`,
                height: `${cfg.dotPx}px`,
                '--dot-i': idx,
                '--dot-c': color,
                '--dot-hop': `${cfg.hopPx}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      {label && <span className={`${cfg.textClass} text-slate-600`}>{label}</span>}
    </span>
  );
};

export default DotsLoader;
