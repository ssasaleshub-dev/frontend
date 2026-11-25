import React, { useEffect, useRef } from 'react';
import { LOADER_ASSETS } from './loaderAssets';
import DotsLoader from './DotsLoader';
import './AppPageLoader.css';

export interface AppPageLoaderProps {
  /** Optional message for accessibility label */
  message?: string;
  /** Whether to show full screen or fit container */
  fullScreen?: boolean;
  /** Spinner color mode (kept for backwards compatibility) */
  colorMode?: 'google' | 'brand';
  /** Optional custom CSS classes */
  className?: string;
}

const PART_CONFIGS = [
  {
    cls: 'ssa-fan2',
    style: { left: '5.859%', top: '60.156%', width: '31.641%', height: '9.180%', '--d': '.7s', '--o': '75% 100%' },
  },
  {
    cls: 'ssa-fan',
    style: { left: '7.031%', top: '49.219%', width: '14.453%', height: '17.188%', '--d': '.85s', '--o': '100% 100%' },
  },
  {
    cls: 'ssa-rise',
    style: { left: '14.062%', top: '30.859%', width: '26.758%', height: '24.414%', '--d': '.95s' },
  },
  {
    cls: 'ssa-rise',
    style: { left: '22.070%', top: '30.664%', width: '44.336%', height: '37.305%', '--d': '1.1s' },
  },
  {
    cls: 'ssa-rise',
    style: { left: '56.836%', top: '30.664%', width: '36.328%', height: '33.594%', '--d': '1.25s' },
  },
  {
    cls: 'ssa-leap',
    style: { left: '21.094%', top: '47.656%', width: '11.523%', height: '18.164%', '--d': '1.5s' },
  },
  {
    cls: 'ssa-leaph',
    style: { left: '25.781%', top: '49.609%', width: '4.297%', height: '4.492%', '--d': '1.55s' },
  },
] as const;

export const AppPageLoader: React.FC<AppPageLoaderProps> = ({
  message = 'Loading',
  fullScreen = true,
  className = '',
}) => {
  const logoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = logoRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let fadeTimer: number | undefined;

    const play = () => {
      el.classList.remove('ssa-loader-play', 'out');
      void el.offsetWidth;
      el.classList.add('ssa-loader-play');
      fadeTimer = window.setTimeout(() => {
        el.classList.add('out');
      }, 4300);
    };

    play();
    const interval = window.setInterval(play, 5100);

    return () => {
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`ssa-loader-root ${
        fullScreen ? 'fixed inset-0 z-9999' : 'w-full min-h-[60vh] relative'
      } select-none ${className}`}
    >
      <main
        ref={logoRef}
        className="ssa-loader-logo ssa-loader-play"
        role="status"
        aria-label={message}
      >
        <div className="ssa-loader-layer">
          <img className="ssa-loader-tile" alt="" src={LOADER_ASSETS.tile} />
        </div>
        <div className="ssa-loader-layer">
          {PART_CONFIGS.map((part, idx) => (
            <img
              key={idx}
              className={`ssa-loader-p ${part.cls}`}
              alt=""
              style={part.style as React.CSSProperties}
              src={LOADER_ASSETS.parts[idx]}
            />
          ))}
          <div className="ssa-loader-ring" />
        </div>
        <div className="ssa-loader-layer" style={{ overflow: 'hidden' }}>
          <div className="ssa-loader-sheen" />
        </div>
      </main>

      <div
        className="ssa-loader-dots"
        style={fullScreen ? undefined : { position: 'absolute', bottom: '2rem' }}
        aria-hidden="true"
      >
        <DotsLoader size="lg" />
      </div>
    </div>
  );
};

export default AppPageLoader;
