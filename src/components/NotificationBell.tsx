import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Check,
  Trash2,
  Clock,
  Calendar,
  Volume2,
  ChevronRight,
  Phone,
  X,
} from 'lucide-react';
import { AppleBellIcon } from './icons/BrandIcons';
import reminderNotificationService, {
  NotificationItem,
} from '../services/reminderNotificationService';
import { encryptLeadId } from '../utils/leadIdCrypto';
import { formatIndianTime, formatIndianDate } from '../utils/dateTimeUtils';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [hasPermission, setHasPermission] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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

  // Close dropdown on outside click
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
    const granted = await reminderNotificationService.requestNotificationPermission();
    setHasPermission(granted);
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await reminderNotificationService.markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    await reminderNotificationService.markAllAsRead();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await reminderNotificationService.deleteNotification(id);
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await reminderNotificationService.markAsRead(item.id);
    }
    setIsOpen(false);
    if (item.referenceType === 'LEAD' && item.referenceId) {
      navigate(`/leads/${encryptLeadId(item.referenceId)}`);
    } else if (item.type === 'REMINDER' || item.referenceType === 'EVENT') {
      navigate('/calendar');
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

  const isNative = Capacitor.isNativePlatform();
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Apple OS Frosted Glass Notification Popover */}
      {isOpen && (
        <>
          {/* Mobile Backdrop Overlay to dismiss on tap */}
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed top-14 left-3 right-3 sm:left-auto sm:right-0 sm:absolute sm:top-full mt-2 sm:mt-2.5 w-auto sm:w-[390px] max-w-[calc(100vw-24px)] ios-material-thick !p-0 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-white/60 z-50 overflow-hidden flex flex-col max-h-[82vh] sm:max-h-[540px] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Apple HIG Header & Segmented Filter Control */}
            <div className="px-4 pt-3.5 pb-2.5 border-b border-black/[0.04] space-y-2.5 bg-[#fbfbfd]/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] text-[#1d1d1f] tracking-tight">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-semibold rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[12px] font-medium text-[#0071e3] hover:text-[#0077ED] transition-opacity active:opacity-60 cursor-pointer"
                  >
                    Mark All as Read
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

            {/* Notification Permission Request Card (Apple HIG Managing Notifications) */}
            {!hasPermission && !isNative && (
              <div className="mx-3.5 mt-2.5 p-3 bg-gradient-to-r from-[#0071e3]/[0.06] to-transparent border border-[#0071e3]/15 rounded-[16px] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#0071e3]/15 text-[#0071e3] flex items-center justify-center shrink-0">
                    <AppleBellIcon size={14} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#1d1d1f] truncate">
                      {isMobile ? 'Push Alerts' : 'Desktop Alerts'}
                    </p>
                    <p className="text-[11px] text-[#86868b] truncate">
                      Allow alerts for callback times & tasks
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3.5 py-1.5 bg-[#0071e3] hover:bg-[#0077ED] active:scale-95 text-white font-medium rounded-full text-[11px] shrink-0 shadow-xs transition-all cursor-pointer"
                >
                  Allow
                </button>
              </div>
            )}

            {/* Notifications Grouped Scroll Stream */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {groupedNotifications.length === 0 ? (
                /* Apple iOS Clean Empty State */
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-black/[0.04] flex items-center justify-center text-[#86868b] mx-auto mb-3 shadow-inner">
                    <AppleBellIcon size={22} strokeWidth={1.6} />
                  </div>
                  <p className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                    {filterTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications'}
                  </p>
                  <p className="text-[12px] text-[#86868b] mt-1 font-normal">
                    {filterTab === 'UNREAD'
                      ? 'You are all caught up on your reminders.'
                      : 'Reminders, callbacks, and calendar alerts will appear here.'}
                  </p>
                </div>
              ) : (
                groupedNotifications.map((group) => (
                  <div key={group.label} className="space-y-1.5">
                    {/* Apple HIG Section Header (Grouped by Date) */}
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                      {group.label}
                    </div>

                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`p-3 rounded-[18px] transition-all cursor-pointer group border flex flex-col gap-1.5 relative ${
                            item.isRead
                              ? 'bg-white/70 hover:bg-white border-black/[0.04] shadow-2xs'
                              : 'bg-white hover:bg-white border-[#0071e3]/20 shadow-xs ring-1 ring-[#0071e3]/10'
                          }`}
                        >
                          {/* Top Row: Squircle Glyph + Source Subtitle + Timestamp + Unread Dot */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0 ${
                                  item.type && item.type.startsWith('CLOSING_MILESTONE_')
                                    ? item.type.includes('100')
                                      ? 'bg-rose-500/10 text-rose-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                    : item.type === 'CALL'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : item.type === 'REMINDER'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : item.type === 'LEAD_ASSIGNED'
                                    ? 'bg-[#0071e3]/10 text-[#0071e3]'
                                    : 'bg-slate-500/10 text-slate-700'
                                }`}
                              >
                                {item.type === 'CALL' ? (
                                  <Phone size={10} strokeWidth={2.5} />
                                ) : item.type === 'REMINDER' || (item.type && item.type.startsWith('CLOSING_MILESTONE_')) ? (
                                  <Clock size={10} strokeWidth={2.5} />
                                ) : item.type === 'LEAD_ASSIGNED' ? (
                                  <Calendar size={10} strokeWidth={2.5} />
                                ) : (
                                  <AppleBellIcon size={11} strokeWidth={2} />
                                )}
                              </div>

                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b] truncate">
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

                              <span className="text-[10px] text-[#86868b]">•</span>

                              <span className="text-[10px] text-[#86868b] shrink-0 font-normal">
                                {formatTimestamp(item.createdAt)}
                              </span>
                            </div>

                            {/* Unread Indicator & Hover Quick Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!item.isRead && (
                                <span
                                  className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0"
                                  title="Unread notification"
                                />
                              )}
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
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
                          <div className="pl-6.5 pr-1">
                            <p
                              className={`text-[13px] leading-snug truncate ${
                                item.isRead ? 'font-medium text-[#1d1d1f]' : 'font-semibold text-[#1d1d1f]'
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="text-[12px] text-[#515154] leading-relaxed line-clamp-2 mt-0.5 font-normal">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Apple HIG Footer: Calendar Jump & Clear All */}
            <div className="px-4 py-2.5 bg-[#f5f5f7]/80 border-t border-black/[0.04] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/calendar');
                }}
                className="text-[#0071e3] hover:text-[#0077ED] font-medium text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calendar size={13} strokeWidth={2} />
                <span>Calendar & Reminders</span>
                <ChevronRight size={12} strokeWidth={2.5} />
              </button>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => reminderNotificationService.clearAllNotifications()}
                  className="text-[#86868b] hover:text-[#ff3b30] text-[11px] font-normal transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
