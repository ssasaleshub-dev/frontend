import React from 'react';
import brandLogo from '../assets/brand-logo.jpg';

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export default function Logo({
  className = 'w-9 h-9',
  showText = true,
  textClassName = 'text-sm font-semibold text-slate-900',
}: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={brandLogo}
        alt="SSA Brand Logo"
        className={`rounded-md object-cover ${className}`}
      />
      {showText && <span className={textClassName}>SSA Sales Hub</span>}
    </div>
  );
}
