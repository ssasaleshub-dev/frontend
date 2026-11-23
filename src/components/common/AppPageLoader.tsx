import React from 'react';

export interface AppPageLoaderProps {
  /** Optional message shown below the spinner */
  message?: string;
  /** Whether to show full screen or fit container */
  fullScreen?: boolean;
  /** Spinner color mode: 'google' (4-color Material) or 'brand' (clean blue) */
  colorMode?: 'google' | 'brand';
  /** Optional custom CSS classes */
  className?: string;
}

export const AppPageLoader: React.FC<AppPageLoaderProps> = ({
  fullScreen = true,
  className = '',
}) => {
  return (
    <div
      className={`${
        fullScreen ? 'fixed inset-0 z-9999' : 'w-full min-h-[60vh]'
      } flex flex-col items-center justify-between bg-white px-6 select-none ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)',
      }}
    >
      {/* Top spacer to balance layout */}
      <div className="w-full h-4" />

      {/* Center: Clean Brand Logo */}
      <div className="flex flex-col items-center text-center">
        <img
          src="/brand-logo.png"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.endsWith('brand-logo.jpg')) {
              target.src = '/brand-logo.jpg';
            } else if (!target.src.endsWith('favicon.png')) {
              target.src = '/favicon.png';
            }
          }}
          alt="SSA"
          className="w-24 h-24 object-contain rounded-[22px]"
        />
      </div>

      {/* Bottom: Subtle Brand Name (Google/iOS splash style) */}
      <div className="text-center">
        <p className="text-xs font-medium text-slate-400 tracking-wide">
          SSA CRM
        </p>
      </div>
    </div>
  );
};

export default AppPageLoader;
