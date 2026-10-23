import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  ExternalLink,
  X,
  Volume2,
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
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-auto md:right-0 mt-2 w-[340px] sm:w-[380px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-800">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Browser Notification Permission Banner */}
          {!hasPermission && (
            <div className="p-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2 text-xs text-blue-900">
              <div className="flex items-center gap-1.5 min-w-0">
                <Volume2 size={13} className="text-blue-600 shrink-0" />
                <span className="truncate text-[11px]">Enable desktop alerts for reminders</span>
              </div>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-[10px] shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium text-slate-600">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Reminders, callbacks, and calendar alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                    item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/30 hover:bg-blue-50/50'
                  }`}
                >
                  {/* Category Icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'REMINDER' ? (
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                        <Clock size={14} />
                      </div>
                    ) : item.type === 'LEAD_ASSIGNED' ? (
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                        <Calendar size={14} />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Bell size={14} />
                      </div>
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className={`text-xs truncate ${item.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        title="Mark as read"
                        className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/calendar');
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] flex items-center gap-1"
            >
              <Calendar size={12} />
              <span>Open Calendar & Reminders</span>
            </button>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => reminderNotificationService.clearAllNotifications()}
                className="text-slate-400 hover:text-rose-600 text-[11px] font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
