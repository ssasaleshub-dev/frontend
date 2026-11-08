import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import notificationBannerService, { AppleBannerPayload } from '../services/banner/notificationBannerService';
import brandLogo from '../assets/brand-logo.jpg';
import { cleanNotificationMessage } from '../utils/dateTimeUtils';

/**
 * Apple iOS In-App Notification Banner Popup
 *
 * Implements authentic Apple iOS notification banner specification:
 * - Mounted via React Portal directly to document.body to prevent any container transform clipping
 * - Perfect horizontal viewport centering using `inset-x-0 mx-auto`
 * - Clean iOS card with app squircle, SSA CRM header, timestamp, bold title, and description
 * - 5-second auto-hide with swipe-up to dismiss gesture
 */
export default function AppleNotificationBanner() {
  const [banner, setBanner] = useState<AppleBannerPayload | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const touchStartY = useRef<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = notificationBannerService.subscribe((newBanner) => {
      if (newBanner) {
        setBanner(newBanner);
        setOffsetY(0);
        // Smooth slide-in
        requestAnimationFrame(() => setIsVisible(true));
      } else {
        setIsVisible(false);
        // Wait for exit transition before unmounting
        setTimeout(() => setBanner(null), 280);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!banner) return null;
  if (typeof document === 'undefined') return null;

  const handleClick = () => {
    if (banner.onClick) {
      banner.onClick();
    } else if (banner.url) {
      navigate(banner.url);
    }
    notificationBannerService.dismiss();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    notificationBannerService.dismiss();
  };

  // Swipe up to dismiss (iOS gesture)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff < 0) {
      setOffsetY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (offsetY < -20) {
      notificationBannerService.dismiss();
    } else {
      setOffsetY(0);
    }
  };

  const cleanTitle = banner.title.replace(/^🔔\s*/, '').replace(/^Reminder:\s*/i, '').trim();
  const cleanDesc = cleanNotificationMessage(banner.description, cleanTitle);

  const bannerContent = (
    <div
      className={`fixed top-3 sm:top-4 inset-x-0 mx-auto z-[9999] max-w-[390px] w-[calc(100%-24px)] select-none font-sf-display transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-12 scale-95 pointer-events-none'
      }`}
      style={offsetY ? { transform: `translateY(${offsetY}px)` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Authentic Apple iOS Solid White Notification Card */}
      <div
        onClick={handleClick}
        className="group relative flex flex-col p-3.5 px-4 rounded-[22px] bg-white text-[#1d1d1f] border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer hover:bg-[#fafafa] transition-all active:scale-[0.985]"
        role="alert"
        aria-live="assertive"
      >
        {/* Top iOS App Identity Header: App Icon + SSA CRM + Category • now */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* iOS App Squircle Icon */}
            <div className="w-5 h-5 rounded-[5px] overflow-hidden shrink-0 shadow-2xs border border-black/[0.06] flex items-center justify-center bg-white">
              <img
                src={brandLogo}
                alt="SSA Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <span className="text-[11px] font-bold tracking-wider uppercase text-[#8e8e93] truncate">
              SSA CRM
            </span>

            <span className="text-[10px] text-[#8e8e93]">•</span>

            <span className="text-[11px] font-semibold tracking-wide uppercase text-[#0071e3] truncate">
              {banner.type === 'CALL'
                ? 'Callback'
                : banner.type === 'CHAT'
                ? 'Chat'
                : banner.type === 'LEAD'
                ? 'Lead'
                : 'Reminder'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-[#8e8e93] font-medium tracking-tight">
              {banner.timestamp || 'now'}
            </span>

            {/* Subtle dismiss button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="w-4 h-4 rounded-full flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-all"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Center: iOS Notification Title & Description */}
        <div className="min-w-0 pr-1 pl-0.5">
          <h4 className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight truncate leading-snug">
            {cleanTitle}
          </h4>

          {cleanDesc && (
            <p className="text-[13px] text-[#48484a] line-clamp-2 leading-relaxed mt-0.5 font-normal">
              {cleanDesc}
            </p>
          )}
        </div>

        {/* Subtle iOS pull indicator handle */}
        <div className="w-8 h-1 rounded-full bg-black/15 mx-auto mt-2" />
      </div>
    </div>
  );

  return createPortal(bannerContent, document.body);
}
