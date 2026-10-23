import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Calendar,
  Volume2,
  ChevronRight,
} from 'lucide-react';
import reminderNotificationService, {
  NotificationItem,
} from '../services/reminderNotificationService';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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
    if (item.type === 'REMINDER' || item.referenceType === 'EVENT') {
      navigate('/calendar');
    } else if (item.referenceType === 'LEAD' && item.referenceId) {
      navigate(`/leads/${item.referenceId}`);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative font-sf-display" ref={dropdownRef}>
      {/* Apple iOS Style Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none ${
          isOpen
            ? 'bg-black/[0.08] text-[#1d1d1f]'
            : 'text-[#48484a] hover:text-[#1d1d1f] hover:bg-black/[0.05] active:bg-black/[0.08]'
        }`}
        aria-label="Notifications"
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-[#ff3b30] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Apple OS Frosted Glass Notification Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:right-0 mt-2.5 w-[360px] sm:w-[380px] bg-white/90 backdrop-blur-2xl rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)] border border-black/[0.06] z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in zoom-in-95 duration-150">
          
          {/* iOS Header */}
          <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between border-b border-black/[0.04]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] text-[#1d1d1f] tracking-tight">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-black/[0.05] text-[#1d1d1f] text-[11px] font-medium rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[12px] font-medium text-[#0071e3] hover:text-[#0077ED] transition-opacity active:opacity-60"
              >
                Mark All as Read
              </button>
            )}
          </div>

          {/* Desktop Alerts Request Pill (Apple iOS Widget Style) */}
          {!hasPermission && (
            <div className="mx-3.5 mt-2.5 p-2 bg-[#f5f5f7]/80 border border-black/[0.04] rounded-[14px] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 pl-1">
                <div className="w-6 h-6 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                  <Volume2 size={12} strokeWidth={2.5} />
                </div>
                <span className="text-[12px] font-medium text-[#1d1d1f] truncate">
                  Desktop Alerts
                </span>
              </div>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3 py-1 bg-[#0071e3] hover:bg-[#0077ED] active:scale-95 text-white font-medium rounded-full text-[11px] shrink-0 shadow-xs transition-all"
              >
                Turn On
              </button>
            </div>
          )}

          {/* Notifications Scroll List */}
          <div className="overflow-y-auto flex-1 p-2.5 space-y-2">
            {notifications.length === 0 ? (
              /* Apple iOS Clean Empty State */
              <div className="py-12 px-6 text-center">
                <div className="w-13 h-13 rounded-full bg-black/[0.04] flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-inner">
                  <Bell size={22} strokeWidth={1.5} className="text-[#86868b]" />
                </div>
                <p className="text-[14px] font-semibold text-[#1d1d1f] tracking-tight">
                  No Notifications
                </p>
                <p className="text-[12px] text-[#86868b] mt-1 font-normal">
                  Reminders, callbacks, and calendar alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-[16px] transition-all cursor-pointer group border flex items-start gap-3 relative ${
                    item.isRead
                      ? 'bg-white/70 hover:bg-white border-black/[0.04] shadow-2xs'
                      : 'bg-white hover:bg-white border-[#0071e3]/20 shadow-xs ring-1 ring-[#0071e3]/10'
                  }`}
                >
                  {/* Apple Style Squircle Icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'REMINDER' ? (
                      <div className="w-8 h-8 rounded-[10px] bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Clock size={15} strokeWidth={2.2} />
                      </div>
                    ) : item.type === 'LEAD_ASSIGNED' ? (
                      <div className="w-8 h-8 rounded-[10px] bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                        <Calendar size={15} strokeWidth={2.2} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-[10px] bg-slate-500/10 text-slate-700 flex items-center justify-center">
                        <Bell size={15} strokeWidth={2.2} />
                      </div>
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className={`text-[13px] truncate ${item.isRead ? 'font-medium text-[#1d1d1f]' : 'font-semibold text-[#1d1d1f]'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[#86868b] font-normal shrink-0">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#515154] mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        title="Mark as read"
                        className="p-1 text-[#86868b] hover:text-[#0071e3] rounded-full hover:bg-black/[0.05] transition-colors"
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete"
                      className="p-1 text-[#86868b] hover:text-[#ff3b30] rounded-full hover:bg-black/[0.05] transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Apple Style Footer */}
          <div className="px-4 py-2.5 bg-[#f5f5f7]/70 border-t border-black/[0.04] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/calendar');
              }}
              className="text-[#0071e3] hover:text-[#0077ED] font-medium text-[12px] flex items-center gap-1.5 transition-colors"
            >
              <Calendar size={13} strokeWidth={2} />
              <span>Calendar & Reminders</span>
              <ChevronRight size={12} strokeWidth={2.5} />
            </button>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => reminderNotificationService.clearAllNotifications()}
                className="text-[#86868b] hover:text-[#ff3b30] text-[11px] font-normal transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
