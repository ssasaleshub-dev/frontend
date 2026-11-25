import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Check,
  Trash2,
  ChevronRight,
  Phone,
  UserPlus,
  Bell,
  Award,
} from 'lucide-react';
import { AppleBellIcon } from './icons/BrandIcons';
import { useAlert } from '../context/AlertContext';
import playIPhoneNotificationSound from '../utils/appleSound';
import reminderNotificationService, {
  NotificationItem,
} from '../services/reminderNotificationService';
import { resolveNotificationTarget } from '../utils/notificationNavigation';
import { formatIndianTime, formatIndianDate, cleanNotificationMessage, cleanNotificationTitle } from '../utils/dateTimeUtils';

export default function NotificationBell() {
  const { showAlert } = useAlert();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [hasPermission, setHasPermission] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const isNative = Capacitor.isNativePlatform();
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isNative || window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = isNative || window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobileScreen(mobile);
      if (mobile) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isNative]);

  const loadNotifications = async () => {
    const list = await reminderNotificationService.fetchNotifications();
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      setNotifications(reminderNotificationService.getCachedNotifications());
    };

    window.addEventListener('ssa_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('ssa_notifications_updated', handleUpdate);
    };
  }, []);

  // Close dropdown on outside click (desktop only)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showAlert({
        title: 'Notifications Not Supported',
        message: 'Your browser or device does not support desktop notifications.',
      });
      return;
    }

    if (Notification.permission === 'denied') {
      showAlert({
        title: 'Notifications Blocked by Browser',
        message:
          'Your browser is currently blocking notifications for this site.\n\nTo enable alerts:\n1. Click the Tune / Padlock icon on the left of your browser address bar.\n2. Change "Notifications" from "Block" to "Allow".\n3. Reload the page.',
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setHasPermission(true);
        playIPhoneNotificationSound();
        try {
          new Notification('SSA CRM Desktop Alerts Enabled', {
            body: 'You will now receive desktop alerts for candidate callbacks and messages.',
            icon: '/brand-logo.jpg',
            badge: '/brand-logo.jpg',
          });
        } catch {
          // fallback
        }
        showAlert({
          title: 'Desktop Alerts Activated',
          message: 'Desktop notifications have been successfully enabled! A test notification was sent.',
          icon: 'success',
        });
      } else {
        setHasPermission(false);
        showAlert({
          title: 'Permission Denied',
          message:
            'You chose not to allow notifications. To enable alerts later, click the lock icon in your browser address bar and set Notifications to "Allow".',
        });
      }
    } catch (err: any) {
      console.warn('Notification permission error:', err);
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = notifications.find((n) => String(n.id) === String(id));
    setNotifications((prev) =>
      prev.map((n) => {
        if (String(n.id) === String(id) || (target && reminderNotificationService.isSameNotification(n, target))) {
          return { ...n, isRead: true };
        }
        return n;
      })
    );
    await reminderNotificationService.markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await reminderNotificationService.markAllAsRead();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = notifications.find((n) => String(n.id) === String(id));
    setNotifications((prev) =>
      prev.filter((n) => {
        if (String(n.id) === String(id)) return false;
        if (target && reminderNotificationService.isSameNotification(n, target)) return false;
        return true;
      })
    );
    await reminderNotificationService.deleteNotification(id);
  };

  const handleBellClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // On mobile screen or native Android/iOS app: directly navigate to dedicated Notifications page
    if (isNative || isMobileScreen) {
      setIsOpen(false);
      navigate('/notifications');
      return;
    }
    // On desktop viewports: toggle popover dropdown
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => {
          if (String(n.id) === String(item.id) || reminderNotificationService.isSameNotification(n, item)) {
            return { ...n, isRead: true };
          }
          return n;
        })
      );
      await reminderNotificationService.markAsRead(item.id);
    }
    setIsOpen(false);
    const target = resolveNotificationTarget(item);
    if (target) {
      navigate(target.path, {
        state: { fromNotification: true, searchName: target.searchName },
      });
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return formatIndianTime(date); // 12-hour AM/PM IST time
      }
      return formatIndianDate(date);
    } catch {
      return '';
    }
  };

  // Filter: All vs Unread
  const filteredNotifications = useMemo(() => {
    if (filterTab === 'UNREAD') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  // Group by Today, Yesterday, Earlier (Apple iOS Notification Center grouping)
  const groupedNotifications = useMemo(() => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    filteredNotifications.forEach((item) => {
      try {
        const t = new Date(item.createdAt).getTime();
        if (t >= todayStart) {
          today.push(item);
        } else if (t >= yesterdayStart) {
          yesterday.push(item);
        } else {
          earlier.push(item);
        }
      } catch {
        earlier.push(item);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Earlier', items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [filteredNotifications]);

  return (
    <div className="relative font-sf-display" ref={dropdownRef}>
      {/* Apple HIG Bell Trigger Button (SF Symbol bell.badge) */}
      <button
        type="button"
        onClick={handleBellClick}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none cursor-pointer ${
          isOpen
            ? 'bg-black/[0.08] text-[#1d1d1f]'
            : 'text-[#48484a] hover:text-[#1d1d1f] hover:bg-black/[0.05] active:bg-black/[0.08]'
        }`}
        aria-label="Notifications"
      >
        <AppleBellIcon size={18} strokeWidth={1.75} hasBadge={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-[#ff3b30] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Apple Notification Popover (Solid White Surface, Zero Bleed-through; DESKTOP ONLY) */}
      {isOpen && !isMobileScreen && !isNative && (
        <div className="absolute -right-4 sm:right-0 top-full mt-2 sm:mt-2.5 w-[380px] max-w-[calc(100vw-24px)] bg-white !p-0 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-black/[0.08] z-[60] overflow-hidden flex flex-col max-h-[540px] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Apple HIG Header & Segmented Filter Control */}
          <div className="px-4 pt-3.5 pb-2.5 border-b border-black/[0.04] space-y-2.5 bg-[#fbfbfd]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight shrink-0">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold rounded-full shrink-0">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[12px] font-medium text-[#0071e3] hover:underline transition-all cursor-pointer shrink-0"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Apple HIG Segmented Control: [ All | Unread ] */}
            <div className="flex items-center p-0.5 bg-black/[0.04] rounded-full text-[12px]">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`flex-1 py-1 rounded-full text-center font-medium transition-all cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-white text-[#1d1d1f] shadow-2xs font-semibold'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('UNREAD')}
                className={`flex-1 py-1 rounded-full text-center font-medium transition-all cursor-pointer ${
                  filterTab === 'UNREAD'
                    ? 'bg-white text-[#1d1d1f] shadow-2xs font-semibold'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* Notification Permission Request Card (Apple HIG Managing Notifications) - Web Desktop Only */}
          {!hasPermission && !isNative && !isMobileScreen && (
            <div className="mx-3 mt-2 p-2.5 bg-[#f2f2f7] border border-black/[0.06] rounded-xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white shadow-2xs text-[#0071e3] flex items-center justify-center shrink-0">
                  <AppleBellIcon size={14} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1d1d1f] truncate">
                    Desktop Alerts
                  </p>
                  <p className="text-[11px] text-[#86868b] truncate">
                    Allow alerts for callback times & tasks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3 py-1 bg-[#0071e3] hover:bg-[#0077ED] active:scale-95 text-white font-medium rounded-lg text-[11px] shrink-0 shadow-2xs transition-all cursor-pointer"
              >
                Allow
              </button>
            </div>
          )}

          {/* Notifications Grouped Scroll Stream */}
          <div className="overflow-y-auto flex-1 p-2 space-y-3">
            {groupedNotifications.length === 0 ? (
              /* Apple iOS Clean Empty State */
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-black/[0.04] flex items-center justify-center text-[#86868b] mx-auto mb-3 shadow-inner">
                  <AppleBellIcon size={22} strokeWidth={1.6} />
                </div>
                <p className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                  {filterTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications'}
                </p>
              </div>
            ) : (
              groupedNotifications.map((group) => (
                <div key={group.label} className="space-y-1">
                  {/* Apple HIG Section Header (Grouped by Date) */}
                  <div className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    {group.label}
                  </div>

                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer group flex items-start gap-2.5 relative border ${
                          item.isRead
                            ? 'bg-transparent hover:bg-black/[0.03] border-transparent'
                            : 'bg-[#0071e3]/[0.04] hover:bg-[#0071e3]/[0.07] border-[#0071e3]/10'
                        }`}
                      >
                        {/* Squircle Category Icon on the Left */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === 'CALL'
                              ? 'bg-amber-500/10 text-amber-600'
                              : item.type === 'REMINDER'
                              ? 'bg-purple-500/10 text-purple-600'
                              : item.type && item.type.startsWith('CLOSING_MILESTONE_')
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-blue-500/10 text-[#0071e3]'
                          }`}
                        >
                          {item.type === 'CALL' ? (
                            <Phone size={14} />
                          ) : item.type === 'REMINDER' ? (
                            <Bell size={14} />
                          ) : item.type && item.type.startsWith('CLOSING_MILESTONE_') ? (
                            <Award size={14} />
                          ) : (
                            <UserPlus size={14} />
                          )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-semibold text-[#1d1d1f] truncate">
                                {item.type === 'CALL'
                                  ? 'Candidate Callback'
                                  : item.type === 'REMINDER'
                                  ? 'Reminder'
                                  : item.type === 'LEAD_ASSIGNED'
                                  ? 'Lead Assignment'
                                  : item.type && item.type.startsWith('CLOSING_MILESTONE_')
                                  ? 'Milestone'
                                  : 'SSA Sales Hub'}
                              </span>

                              <span className="text-[11px] text-[#8e8e93]">•</span>

                              <span className="text-[11px] text-[#8e8e93] shrink-0 font-normal">
                                {formatTimestamp(item.createdAt)}
                              </span>
                            </div>

                            {/* Unread Indicator & Hover Quick Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!item.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0 group-hover:hidden" />
                              )}
                              <div className="hidden group-hover:flex items-center gap-1 transition-opacity">
                                {!item.isRead && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkAsRead(item.id, e)}
                                    title="Mark as read"
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/[0.05] transition-colors"
                                  >
                                    <Check size={12} strokeWidth={2.5} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(item.id, e)}
                                  title="Dismiss notification"
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-black/[0.05] transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Body Content */}
                          {(() => {
                            const cleanTitle = cleanNotificationTitle(item.title);
                            const displayMessage = cleanNotificationMessage(item.message, cleanTitle);
                            return (
                              <div className="mt-0.5">
                                <p
                                  className={`text-[12.5px] leading-snug truncate ${
                                    item.isRead ? 'font-normal text-[#1d1d1f]' : 'font-semibold text-[#1d1d1f]'
                                  }`}
                                >
                                  {cleanTitle}
                                </p>
                                {displayMessage && (
                                  <p className="text-[11.5px] text-[#8e8e93] leading-relaxed line-clamp-2 mt-0.5 font-normal">
                                    {displayMessage}
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Apple HIG Popover Footer: Link to Full Notification Center */}
          <div className="p-2.5 border-t border-black/[0.06] bg-[#fbfbfd] text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-[12px] font-medium text-[#0071e3] hover:text-[#0051a8] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View all in Notification Center</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
