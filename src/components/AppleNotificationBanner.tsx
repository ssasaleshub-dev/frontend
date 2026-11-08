import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, Clock, Phone, User, Calendar, Bell } from 'lucide-react';
import notificationBannerService, { AppleBannerPayload } from '../services/banner/notificationBannerService';
import { AppleBellIcon } from './icons/BrandIcons';
import { cleanNotificationMessage } from '../utils/dateTimeUtils';

/**
 * Apple HIG In-App Notification Banner Popup
 *
 * Designed according to Apple Human Interface Guidelines: Notifications
 * (https://developer.apple.com/design/human-interface-guidelines/notifications)
 * Features squircle app icon, bold Title, Description, and top-right "now" timestamp.
 */
export default function AppleNotificationBanner() {
  const [banner, setBanner] = useState<AppleBannerPayload | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = notificationBannerService.subscribe((newBanner) => {
      if (newBanner) {
        setBanner(newBanner);
        // Trigger smooth slide-in
        requestAnimationFrame(() => setIsVisible(true));
      } else {
        setIsVisible(false);
        // Wait for exit animation before unmounting
        setTimeout(() => setBanner(null), 250);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!banner) return null;

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

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[420px] w-[calc(100%-32px)] transition-all duration-300 ease-out font-sf-display ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-6 scale-95 pointer-events-none'
      }`}
    >
      {/* Apple HIG Notification Banner Capsule */}
      <div
        onClick={handleClick}
        className="group relative flex items-start gap-3 p-3.5 pr-4 rounded-[22px] bg-[#1d1d1f]/92 text-white border border-white/15 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] cursor-pointer hover:bg-[#252528]/95 transition-all active:scale-[0.98]"
        role="alert"
        aria-live="assertive"
      >
        {/* Left: Squircle App Icon Guide Geometry */}
        <div className="shrink-0 mt-0.5">
          <div
            className={`w-9 h-9 rounded-[10px] flex items-center justify-center shadow-inner ${
              banner.type === 'CHAT'
                ? 'bg-[#0071e3] text-white'
                : banner.type === 'CALL'
                ? 'bg-[#34c759] text-white'
                : banner.type === 'REMINDER'
                ? 'bg-[#ff9500] text-white'
                : banner.type === 'LEAD'
                ? 'bg-[#5856d6] text-white'
                : banner.type === 'MILESTONE'
                ? 'bg-[#ff2d55] text-white'
                : 'bg-white/15 text-white'
            }`}
          >
            {banner.type === 'CHAT' ? (
              <MessageSquare size={17} strokeWidth={2.2} />
            ) : banner.type === 'CALL' ? (
              <Phone size={17} strokeWidth={2.2} />
            ) : banner.type === 'REMINDER' ? (
              <Clock size={17} strokeWidth={2.2} />
            ) : banner.type === 'LEAD' ? (
              <User size={17} strokeWidth={2.2} />
            ) : (
              <AppleBellIcon size={17} strokeWidth={2} />
            )}
          </div>
        </div>

        {/* Center: Title & Description (User-entered only) */}
        {(() => {
          const cleanTitle = banner.title.replace(/^🔔\s*/, '').replace(/^Reminder:\s*/i, '').trim();
          const cleanDesc = cleanNotificationMessage(banner.description, cleanTitle);
          return (
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-[13.5px] font-semibold text-white tracking-tight truncate leading-snug">
                  {cleanTitle}
                </h4>

                {/* Right: "now" timestamp from Apple HIG spec */}
                <span className="text-[11px] text-white/50 font-normal shrink-0 tracking-tight pt-0.5">
                  {banner.timestamp || 'now'}
                </span>
              </div>

              {cleanDesc && (
                <p className="text-[12px] text-white/80 line-clamp-2 leading-relaxed mt-0.5 font-normal">
                  {cleanDesc}
                </p>
              )}
            </div>
          );
        })()}

        {/* Dismiss Button (visible on hover or tap) */}
        <button
          type="button"
          onClick={handleDismiss}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0 ml-1"
          title="Dismiss notification"
          aria-label="Dismiss"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

