import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Calendar,
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
  const [loading, setLoading] = useState(false);

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

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(id) ? { ...n, isRead: !n.isRead } : n))
    );
    await reminderNotificationService.markAsRead(id);
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => String(n.id) !== String(id)));
    await reminderNotificationService.deleteNotification(id);
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all notifications?')) {
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

  const filteredNotifications = useMemo(() => {
    if (filterTab === 'UNREAD') {
      return notifications.filter((item) => !item.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  // Group by Today, Yesterday, Earlier (Instagram Activity Center)
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
    <div className="w-full min-h-screen bg-white font-sf-display text-[#1d1d1f]">
      {/* Instagram-style Top Navigation Header on Pure White */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.06] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1 -ml-1 text-[#1d1d1f] hover:text-[#0071e3] active:scale-95 transition-all cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft size={24} strokeWidth={2.4} />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-[#1d1d1f]">
            Notifications
          </h1>
        </div>
      </div>

      {/* Instagram-style Minimalist Tab Bar */}
      <div className="flex items-center border-b border-black/[0.06] bg-white text-xs">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`flex-1 py-3 text-center font-semibold transition-all relative cursor-pointer ${
            filterTab === 'ALL'
              ? 'text-[#1d1d1f]'
              : 'text-[#8e8e93] hover:text-[#1d1d1f]'
          }`}
        >
          <span>All ({notifications.length})</span>
          {filterTab === 'ALL' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1d1d1f]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('UNREAD')}
          className={`flex-1 py-3 text-center font-semibold transition-all relative cursor-pointer ${
            filterTab === 'UNREAD'
              ? 'text-[#1d1d1f]'
              : 'text-[#8e8e93] hover:text-[#1d1d1f]'
          }`}
        >
          <span>Unread ({unreadCount})</span>
          {filterTab === 'UNREAD' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1d1d1f]" />
          )}
        </button>
      </div>

      {/* Instagram-style Flat Notification Feed (No Card Boxes, No Gray Background) */}
      <div className="bg-white">
        {groupedNotifications.length === 0 ? (
          /* Clean Minimal Empty State */
          <div className="py-24 px-4 text-center bg-white">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-[#8e8e93] mx-auto mb-3.5">
              <AppleBellIcon size={24} strokeWidth={1.6} />
            </div>
            <h3 className="text-base font-semibold text-[#1d1d1f] tracking-tight">
              {filterTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications'}
            </h3>
            <p className="text-[13px] text-[#8e8e93] max-w-xs mx-auto mt-1 font-normal">
              {filterTab === 'UNREAD'
                ? 'You are all caught up.'
                : 'Activity and reminders will appear here.'}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071e3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Calendar size={14} />
                <span>Go to Calendar</span>
              </button>
            </div>
          </div>
        ) : (
          groupedNotifications.map((group) => (
            <div key={group.label}>
              {/* Instagram Group Header */}
              <div className="px-4 py-2 bg-slate-50/70 border-b border-black/[0.03] text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
                {group.label}
              </div>

              {/* Flat List Rows (Divide Hairline) */}
              <div className="divide-y divide-black/[0.04]">
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
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
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
