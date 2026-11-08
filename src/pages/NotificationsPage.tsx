import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  ChevronLeft,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { AppleBellIcon } from '../components/icons/BrandIcons';
import SwipeableNotificationCard from '../components/SwipeableNotificationCard';
import reminderNotificationService, {
  NotificationItem,
} from '../services/reminderNotificationService';
import { encryptLeadId } from '../utils/leadIdCrypto';
import { formatIndianTime, formatIndianDate } from '../utils/dateTimeUtils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'REMINDER' | 'CALL' | 'LEAD'>('ALL');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const isNative = Capacitor.isNativePlatform();
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const list = await reminderNotificationService.fetchNotifications();
      setNotifications(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      setNotifications(reminderNotificationService.getCachedNotifications());
    };

    window.addEventListener('ssa_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('ssa_notifications_updated', handleUpdate);
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

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

  const handleClearAll = async () => {
    if (window.confirm('Clear all notifications from your feed?')) {
      await reminderNotificationService.clearAllNotifications();
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await reminderNotificationService.markAsRead(item.id);
    }

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
        return formatIndianTime(date); // 12-hour AM/PM IST
      }
      return `${formatIndianDate(date)} • ${formatIndianTime(date)}`;
    } catch {
      return '';
    }
  };

  // Filter tab (All vs Unread) & Category filter
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filterTab === 'UNREAD' && item.isRead) return false;
      if (categoryFilter === 'REMINDER' && item.type !== 'REMINDER') return false;
      if (categoryFilter === 'CALL' && item.type !== 'CALL') return false;
      if (categoryFilter === 'LEAD' && item.referenceType !== 'LEAD' && item.type !== 'LEAD_ASSIGNED') return false;
      return true;
    });
  }, [notifications, filterTab, categoryFilter]);

  // Group by Today, Yesterday, Earlier (Apple iOS Notification Center)
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12 font-sf-display text-[#1d1d1f]">
      {/* Apple iOS Page Navigation Bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-[#0071e3] hover:text-[#0077ED] font-medium text-sm -ml-1 py-1.5 px-2 rounded-xl active:bg-black/[0.05] transition-all cursor-pointer"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.05] active:scale-95 transition-all cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#0071e3]' : ''} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[13px] font-semibold text-[#0071e3] hover:text-[#0077ED] active:opacity-60 transition-opacity px-2.5 py-1 rounded-lg cursor-pointer"
            >
              Mark All Read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[13px] font-medium text-[#86868b] hover:text-[#ff3b30] active:opacity-60 transition-colors px-2 py-1 rounded-lg cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Page Title Header */}
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
          Notifications
        </h1>
      </div>

      {/* Apple HIG Segmented Control: [ All | Unread ] */}
      <div className="p-1 bg-black/[0.05] rounded-2xl flex items-center gap-1">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`flex-1 py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
            filterTab === 'ALL'
              ? 'bg-white text-[#1d1d1f] shadow-xs'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('UNREAD')}
          className={`flex-1 py-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
            filterTab === 'UNREAD'
              ? 'bg-white text-[#1d1d1f] shadow-xs'
              : 'text-[#86868b] hover:text-[#1d1d1f]'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Category Filter Pills (All / Reminders / Callbacks / Leads) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
            categoryFilter === 'ALL'
              ? 'bg-[#1d1d1f] text-white shadow-2xs'
              : 'bg-white text-[#86868b] border border-black/[0.06] hover:text-[#1d1d1f]'
          }`}
        >
          All Types
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('REMINDER')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
            categoryFilter === 'REMINDER'
              ? 'bg-[#1d1d1f] text-white shadow-2xs'
              : 'bg-white text-[#86868b] border border-black/[0.06] hover:text-[#1d1d1f]'
          }`}
        >
          Reminders
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('CALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
            categoryFilter === 'CALL'
              ? 'bg-[#1d1d1f] text-white shadow-2xs'
              : 'bg-white text-[#86868b] border border-black/[0.06] hover:text-[#1d1d1f]'
          }`}
        >
          Callbacks
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('LEAD')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
            categoryFilter === 'LEAD'
              ? 'bg-[#1d1d1f] text-white shadow-2xs'
              : 'bg-white text-[#86868b] border border-black/[0.06] hover:text-[#1d1d1f]'
          }`}
        >
          Lead Updates
        </button>
      </div>

      {/* Notification Permission Card (Apple HIG Managing Notifications) */}
      {!hasPermission && !isNative && (
        <div className="p-4 bg-white rounded-2xl border border-[#0071e3]/20 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
              <AppleBellIcon size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold text-[#1d1d1f] truncate">
                {isMobile ? 'Enable Mobile Push Alerts' : 'Enable Desktop Notifications'}
              </h4>
              <p className="text-[12px] text-[#86868b] leading-tight mt-0.5">
                Receive instant alerts for candidate callback times and task deadlines.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4 py-2 bg-[#0071e3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-full shrink-0 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Allow
          </button>
        </div>
      )}

      {/* Grouped Notification List */}
      <div className="space-y-6 pt-1">
        {groupedNotifications.length === 0 ? (
          /* Apple iOS Clean Empty State */
          <div className="py-16 px-4 text-center bg-white rounded-3xl border border-black/[0.05] shadow-xs">
            <div className="w-16 h-16 rounded-full bg-black/[0.04] flex items-center justify-center text-[#86868b] mx-auto mb-4">
              <AppleBellIcon size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-[#1d1d1f] tracking-tight">
              {filterTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications'}
            </h3>
            <p className="text-[13px] text-[#86868b] max-w-sm mx-auto mt-1 font-normal">
              {filterTab === 'UNREAD'
                ? 'You have caught up with all candidate callbacks and reminders.'
                : 'When candidate callbacks, scheduled events, or team notices are due, they will appear here.'}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071e3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Calendar size={14} />
                <span>Open Calendar & Reminders</span>
              </button>
            </div>
          </div>
        ) : (
          groupedNotifications.map((group) => (
            <div key={group.label} className="space-y-2">
              {/* Apple HIG Group Header */}
              <div className="px-2 text-[12px] font-bold uppercase tracking-wider text-[#86868b]">
                {group.label}
              </div>

              {/* Group Items Inset */}
              <div className="space-y-2.5">
                {group.items.map((item) => {
                  const cleanTitle = item.title
                    .replace(/^🔔\s*/, '')
                    .replace(/^Reminder:\s*/i, '')
                    .trim();

                  return (
                    <SwipeableNotificationCard
                      key={item.id}
                      item={item}
                      cleanTitle={cleanTitle}
                      formattedTimestamp={formatTimestamp(item.createdAt)}
                      onClick={handleNotificationClick}
                      onMarkAsRead={(id) => reminderNotificationService.markAsRead(id)}
                      onDelete={(id) => reminderNotificationService.deleteNotification(id)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

