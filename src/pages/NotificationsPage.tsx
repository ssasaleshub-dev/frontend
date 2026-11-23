import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import reminderNotificationService, {
  NotificationItem,
} from '../services/reminderNotificationService';
import pushNotificationService from '../services/pushNotificationService';
import { encryptLeadId } from '../utils/leadIdCrypto';
import {
  formatIndianTime,
  formatIndianDate,
  cleanNotificationTitle,
  cleanNotificationMessage,
} from '../utils/dateTimeUtils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [showWebPushBanner, setShowWebPushBanner] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 1600);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        setShowWebPushBanner(true);
      }
    }
  }, []);

  const handleEnableWebPush = async () => {
    const granted = await pushNotificationService.requestWebPushPermission();
    if (granted || Notification.permission === 'granted') {
      setShowWebPushBanner(false);
      showToast('Notifications enabled');
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      const list = await reminderNotificationService.fetchNotifications();
      if (list && list.length > 0) {
        setNotifications(list);
      } else {
        const enriched = await reminderNotificationService.populateFromRecentLeadsAndEvents([]);
        setNotifications(enriched);
      }
    } catch (e) {
      console.warn('Failed to fetch notifications:', e);
      const cached = reminderNotificationService.getCachedNotifications();
      if (cached && cached.length > 0) {
        setNotifications(cached);
      } else {
        reminderNotificationService.populateFromRecentLeadsAndEvents([]).then(setNotifications);
      }
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
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const handleToggleRead = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRead = !item.isRead;
    setNotifications((prev) =>
      prev.map((n) => {
        if (String(n.id) === String(item.id) || reminderNotificationService.isSameNotification(n, item)) {
          return { ...n, isRead: newRead };
        }
        return n;
      })
    );
    if (newRead) {
      await reminderNotificationService.markAsRead(item.id);
      showToast('Marked as read');
    } else {
      await reminderNotificationService.markAsUnread(item.id);
      showToast('Marked as unread');
    }
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
    showToast('Notification deleted');
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await reminderNotificationService.markAllAsRead();
    showToast('All marked as read');
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

    if ((item.referenceType === 'LEAD' || (item.type as string) === 'NEW_LEAD') && item.referenceId) {
      navigate(`/leads/${encryptLeadId(item.referenceId)}`);
    } else if (item.type === 'REMINDER' || item.referenceType === 'EVENT') {
      navigate('/calendar');
    } else if (item.referenceId) {
      navigate(`/leads/${encryptLeadId(item.referenceId)}`);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/leads');
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
        return formatIndianTime(date);
      }
      return `${formatIndianDate(date)} · ${formatIndianTime(date)}`;
    } catch {
      return '';
    }
  };

  const getInitial = (title: string) => {
    if (title.includes(':')) {
      const candidatePart = title.split(':')[1]?.trim() || '';
      if (candidatePart.length > 0 && /[A-Za-z]/.test(candidatePart[0])) {
        return candidatePart.charAt(0).toUpperCase();
      }
    }
    const clean = title.replace(/new|lead|received|assigned|inquiry|reminder|alert/gi, '').trim();
    if (clean.length > 0 && /[A-Za-z]/.test(clean[0])) {
      return clean.charAt(0).toUpperCase();
    }
    return (title.trim().charAt(0) || 'N').toUpperCase();
  };

  const groupedNotifications = useMemo(() => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    const list = tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

    list.forEach((item) => {
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
  }, [notifications, tab]);

  return (
    <>
      <div className="crm-n" id="crmN">
        <div className="wrap">
          <div className="card">
            {/* Header bar */}
            <div className="hd">
              <button
                type="button"
                className="back"
                id="bk"
                aria-label="Back"
                onClick={handleBack}
              >
                ‹
              </button>
              <h1>Notifications</h1>
              <button
                type="button"
                className="mk"
                id="mk"
                disabled={unreadCount === 0}
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            </div>

            {/* Push Banner prompt if needed */}
            {showWebPushBanner && (
              <div
                style={{
                  margin: '10px 16px',
                  padding: '9px 12px',
                  background: 'var(--blue-soft)',
                  border: '1px solid #d0e2ff',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '12.5px',
                  color: 'var(--text)',
                }}
              >
                <span>Enable browser push notifications for real-time CRM updates.</span>
                <button
                  type="button"
                  onClick={handleEnableWebPush}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--blue)',
                    color: '#fff',
                    border: '0',
                    borderRadius: '4px',
                    fontWeight: '600',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Enable
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="tabs" id="tabs">
              <button
                type="button"
                className={`tab${tab === 'all' ? ' on' : ''}`}
                onClick={() => setTab('all')}
              >
                All <i>({notifications.length})</i>
              </button>
              <button
                type="button"
                className={`tab${tab === 'unread' ? ' on' : ''}`}
                onClick={() => setTab('unread')}
              >
                Unread <i>({unreadCount})</i>
              </button>
            </div>

            {/* Notification Groups & Items */}
            <div id="list">
              {groupedNotifications.length === 0 ? (
                <div className="em">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4" />
                  </svg>
                  <div>
                    {tab === 'unread' ? "You're all caught up" : 'No notifications'}
                  </div>
                </div>
              ) : (
                groupedNotifications.map((group) => (
                  <div key={group.label}>
                    <div className="gh">{group.label}</div>
                    {group.items.map((item) => {
                      const cleanTitle = cleanNotificationTitle(item.title);
                      const cleanSub = item.message
                        ? cleanNotificationMessage(item.message, cleanTitle)
                        : '';
                      const initial = getInitial(cleanTitle);
                      const timeStr = formatTimestamp(item.createdAt);

                      return (
                        <div
                          key={item.id}
                          className={`it${!item.isRead ? ' un' : ''}`}
                          tabIndex={0}
                          onClick={() => handleNotificationClick(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNotificationClick(item);
                          }}
                        >
                          <div className="av">{initial}</div>
                          <div className="bd">
                            <p className="tt">
                              <b>{cleanTitle}</b>
                            </p>
                            {cleanSub && <p className="sb">{cleanSub}</p>}
                            {timeStr && <span className="tm">{timeStr}</span>}
                          </div>

                          {/* Quick Hover / Focus Actions */}
                          <div className="ac">
                            <button
                              type="button"
                              title={item.isRead ? 'Mark as unread' : 'Mark as read'}
                              aria-label={item.isRead ? 'Mark as unread' : 'Mark as read'}
                              onClick={(e) => handleToggleRead(item, e)}
                            >
                              <svg viewBox="0 0 24 24">
                                {item.isRead ? (
                                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                                ) : (
                                  <path d="M5 12l5 5 9-10" />
                                )}
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="d"
                              title="Delete"
                              aria-label="Delete"
                              onClick={(e) => handleDelete(item.id, e)}
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Global Toast Feedback */}
        <div className={`toast${toastMsg ? ' show' : ''}`} id="toast">
          {toastMsg}
        </div>
      </div>
    </>
  );
}
