/**
 * Enterprise Reminder & Notification Service (MNC Standard)
 * Full Dynamic REST Integration with Backend Service + Resilient Offline-First Sync.
 * Supports Indian Calendar, Gazetted Holidays, Candidate Callbacks & Real-time Internal Alerts.
 */

import notificationApiService, {
  CalendarEventDTO,
  NotificationDTO,
  EventType,
  EventPriority,
  NotificationType,
} from './api/notificationService';
import pushNotificationService from './pushNotificationService';
import notificationBannerService from './banner/notificationBannerService';
import { format12HourTime, IST_TIMEZONE } from '../utils/dateTimeUtils';

export type { CalendarEventDTO as CalendarEvent, NotificationDTO as NotificationItem, EventType, EventPriority, NotificationType };

export interface IndianHoliday {
  date: string; // YYYY-MM-DD
  title: string;
  type: 'Gazetted' | 'Restricted' | 'Festival';
  description: string;
}

// Gazetted Indian Holidays (National Reference Calendar)
export const INDIAN_HOLIDAYS: IndianHoliday[] = [
  { date: '2026-01-14', title: 'Pongal / Makar Sankranti', type: 'Festival', description: 'Harvest festival celebrated across India & Tamil Nadu' },
  { date: '2026-01-26', title: 'Republic Day', type: 'Gazetted', description: 'National Holiday celebrating the Constitution of India' },
  { date: '2026-02-15', title: 'Maha Shivaratri', type: 'Festival', description: 'Solemn festival honouring Lord Shiva' },
  { date: '2026-03-04', title: 'Holi', type: 'Gazetted', description: 'Festival of colours and spring arrival' },
  { date: '2026-03-20', title: 'Eid-ul-Fitr (Ramzan)', type: 'Gazetted', description: 'Islamic festival marking the end of Ramadan' },
  { date: '2026-04-03', title: 'Good Friday', type: 'Gazetted', description: 'Christian observance before Easter' },
  { date: '2026-04-14', title: 'Tamil New Year / Puthandu & Ambedkar Jayanti', type: 'Gazetted', description: 'Tamil New Year & birth anniversary of Dr. B.R. Ambedkar' },
  { date: '2026-05-01', title: 'May Day (Labour Day)', type: 'Gazetted', description: 'International Workers Day celebration' },
  { date: '2026-05-27', title: 'Bakrid / Eid al-Adha', type: 'Gazetted', description: 'Feast of the Sacrifice' },
  { date: '2026-08-15', title: 'Independence Day', type: 'Gazetted', description: 'National Holiday celebrating Indian Independence 1947' },
  { date: '2026-08-28', title: 'Raksha Bandhan', type: 'Festival', description: 'Celebration of brother-sister bond' },
  { date: '2026-09-04', title: 'Krishna Janmashtami', type: 'Festival', description: 'Celebration of the birth of Lord Krishna' },
  { date: '2026-09-14', title: 'Ganesh Chaturthi', type: 'Festival', description: 'Festival celebrating Lord Ganesha' },
  { date: '2026-10-02', title: 'Mahatma Gandhi Jayanti', type: 'Gazetted', description: 'National Holiday commemorating the Father of the Nation' },
  { date: '2026-10-20', title: 'Dussehra / Vijaya Dashami', type: 'Gazetted', description: 'Triumph of righteousness over evil' },
  { date: '2026-11-08', title: 'Diwali / Deepavali', type: 'Gazetted', description: 'Grand Festival of Lights' },
  { date: '2026-11-24', title: 'Guru Nanak Jayanti', type: 'Gazetted', description: 'Celebration of the birth of Guru Nanak' },
  { date: '2026-12-25', title: 'Christmas Day', type: 'Gazetted', description: 'Christian celebration of Jesus Christ’s birth' },
];

const EVENTS_CACHE_KEY = 'ssa_calendar_events_v2';
const NOTIFICATIONS_CACHE_KEY = 'ssa_notifications_v2';

class ReminderNotificationService {
  private checkInterval: any = null;

  constructor() {
    this.initDefaultData();
    this.startBackgroundWorkers();
  }

  private initDefaultData() {
    try {
      // Purge any legacy sample keys
      ['ssa_calendar_events_v1', 'ssa_notifications_v1'].forEach((key) => {
        try { localStorage.removeItem(key); } catch {}
      });

      // Purge any mock/sample events
      const rawEvents = localStorage.getItem(EVENTS_CACHE_KEY);
      if (rawEvents) {
        try {
          const parsed = JSON.parse(rawEvents);
          const realOnly = Array.isArray(parsed)
            ? parsed.filter((e: any) => e.id !== 'evt-1' && e.id !== 'evt-2')
            : [];
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(realOnly));
        } catch {
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify([]));
        }
      } else {
        localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify([]));
      }

      // Purge any mock/sample notifications
      const rawNotifs = localStorage.getItem(NOTIFICATIONS_CACHE_KEY);
      if (rawNotifs) {
        try {
          const parsed = JSON.parse(rawNotifs);
          const realOnly = Array.isArray(parsed)
            ? parsed.filter(
                (n: any) =>
                  n.id !== 'notif-welcome' &&
                  n.referenceId !== 'evt-1' &&
                  n.referenceId !== 'evt-2' &&
                  !n.title?.includes('Schengen Visa') &&
                  !n.title?.includes('Follow up with Praveen') &&
                  !n.title?.includes('Internal Notification System Online')
              )
            : [];
          localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(realOnly));
        } catch {
          localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify([]));
        }
      } else {
        localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify([]));
      }
    } catch (e) {
      console.warn('Storage initialization warning:', e);
    }
  }

  // --- CALENDAR EVENTS & REMINDERS (DYNAMIC API WITH FALLBACK) ---

  public async fetchEvents(params?: { month?: number; year?: number }): Promise<CalendarEventDTO[]> {
    try {
      const serverEvents = await notificationApiService.getEvents(params);
      if (Array.isArray(serverEvents)) {
        localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(serverEvents));
        window.dispatchEvent(new CustomEvent('ssa_events_updated'));
        return serverEvents;
      }
    } catch {
      // Backend not yet deployed or offline: fallback to resilient local cache
    }
    return this.getCachedEvents();
  }

  public getCachedEvents(): CalendarEventDTO[] {
    try {
      const raw = localStorage.getItem(EVENTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async saveEvent(
    eventData: Omit<CalendarEventDTO, 'id' | 'createdAt' | 'updatedAt' | 'notificationSent'>
  ): Promise<CalendarEventDTO> {
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
          return crypto.randomUUID();
        } catch {}
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const newId = generateUUID();
    const newEvent: CalendarEventDTO = {
      ...eventData,
      id: newId,
      notificationSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update local cache immediately for zero-latency response
    const cached = this.getCachedEvents();
    cached.unshift(newEvent);
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_events_updated'));

    let finalEvent = newEvent;
    // Attempt real backend POST
    try {
      const savedOnServer = await notificationApiService.createEvent({
        ...eventData,
        id: newId,
      });
      if (savedOnServer && savedOnServer.id) {
        // Replace temp ID with server ID
        const idx = cached.findIndex((e) => e.id === newId);
        if (idx !== -1) {
          cached[idx] = savedOnServer;
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
          window.dispatchEvent(new CustomEvent('ssa_events_updated'));
        }
        finalEvent = savedOnServer;
      }
    } catch (apiErr) {
      console.warn('[Reminders] Backend sync deferred to local cache:', apiErr);
    }

    // Schedule Native Android push notification
    try {
      await pushNotificationService.scheduleLocalReminder({
        id: finalEvent.id,
        title: finalEvent.title,
        candidateName: finalEvent.candidateName,
        eventDate: finalEvent.eventDate,
        eventTime: finalEvent.eventTime,
        remindBeforeMinutes: finalEvent.remindBeforeMinutes,
        description: finalEvent.description,
        candidateId: finalEvent.candidateId,
      });
    } catch (schedErr) {
      console.warn('[Reminders] Could not schedule native notification:', schedErr);
    }

    return finalEvent;
  }

  public async updateEvent(id: string, updates: Partial<CalendarEventDTO>): Promise<CalendarEventDTO | null> {
    const cached = this.getCachedEvents();
    const idx = cached.findIndex((e) => e.id === id);
    if (idx !== -1) {
      cached[idx] = { ...cached[idx], ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
      window.dispatchEvent(new CustomEvent('ssa_events_updated'));

      // Reschedule native notification if time or title changed
      try {
        pushNotificationService.scheduleLocalReminder(cached[idx]);
      } catch {}
    }

    try {
      await notificationApiService.updateEvent(id, updates);
    } catch {}

    return idx !== -1 ? cached[idx] : null;
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const cached = this.getCachedEvents().filter((e) => e.id !== id);
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_events_updated'));

    try {
      pushNotificationService.cancelLocalReminder(id);
    } catch {}

    try {
      await notificationApiService.deleteEvent(id);
    } catch {}

    return true;
  }

  public async toggleEventComplete(id: string): Promise<boolean> {
    const cached = this.getCachedEvents();
    const evt = cached.find((e) => e.id === id);
    if (!evt) return false;

    evt.isCompleted = !evt.isCompleted;
    evt.updatedAt = new Date().toISOString();
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_events_updated'));

    try {
      await notificationApiService.toggleEventComplete(id);
    } catch {}

    return true;
  }

  public getCurrentUserLogin(): string {
    try {
      const stored = localStorage.getItem('ssa_user') || localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.login) return parsed.login;
      }
    } catch {}
    return 'admin';
  }

  // --- INTERNAL NOTIFICATIONS (DYNAMIC API WITH FALLBACK) ---

  public async fetchNotifications(userId?: string): Promise<NotificationDTO[]> {
    const targetUser = userId || this.getCurrentUserLogin();
    try {
      const serverNotifs = await notificationApiService.getNotifications(targetUser);
      if (Array.isArray(serverNotifs) && serverNotifs.length > 0) {
        const cached = this.getCachedNotifications();
        const map = new Map<string, NotificationDTO>();
        cached.forEach((n) => map.set(n.id, n));
        serverNotifs.forEach((n) => map.set(n.id, n));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
        return merged;
      }
    } catch {}

    return this.getCachedNotifications();
  }

  public getCachedNotifications(): NotificationDTO[] {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_CACHE_KEY);
      const list: NotificationDTO[] = raw ? JSON.parse(raw) : [];
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  public getUnreadNotificationCount(): number {
    return this.getCachedNotifications().filter((n) => !n.isRead).length;
  }

  public addNotification(notification: Omit<NotificationDTO, 'id' | 'createdAt' | 'isRead'>): NotificationDTO {
    const newItem: NotificationDTO = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const cached = this.getCachedNotifications();
    cached.unshift(newItem);
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    // Trigger browser notification
    this.sendBrowserNotification(newItem.title, newItem.message);

    // Trigger Apple HIG In-App Notification Banner Popup
    try {
      notificationBannerService.show({
        id: newItem.id,
        title: newItem.title.replace(/^🔔\s*/, ''),
        description: newItem.message,
        type: (newItem.type as any) || 'REMINDER',
        timestamp: 'now',
        url: newItem.referenceType === 'LEAD' && newItem.referenceId ? `/leads/${newItem.referenceId}` : '/calendar',
      });
    } catch (bannerErr) {
      console.warn('Banner show error:', bannerErr);
    }

    return newItem;
  }

  public async markAsRead(id: string): Promise<void> {
    const cached = this.getCachedNotifications();
    const item = cached.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
      window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
    }

    try {
      await notificationApiService.markAsRead(id);
    } catch {}
  }

  public async markAllAsRead(): Promise<void> {
    const cached = this.getCachedNotifications();
    cached.forEach((n) => (n.isRead = true));
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    try {
      await notificationApiService.markAllAsRead();
    } catch {}
  }

  public async deleteNotification(id: string): Promise<void> {
    const cached = this.getCachedNotifications().filter((n) => n.id !== id);
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    try {
      await notificationApiService.deleteNotification(id);
    } catch {}
  }

  public async clearAllNotifications(): Promise<void> {
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    try {
      await notificationApiService.clearAllNotifications();
    } catch {}
  }

  /**
   * Directly stores incoming notification from WebSocket push without making HTTP requests
   */
  public addIncomingNotification(notification: NotificationDTO): void {
    const cached = this.getCachedNotifications();
    if (cached.some((n) => n.id === notification.id)) return;
    cached.unshift(notification);
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
  }

  // --- BACKGROUND TICKER & REAL-TIME REMINDER EVALUATOR ---

  public startBackgroundWorkers() {
    if (this.checkInterval) return;

    // Check reminders locally in memory every 10 seconds for real-time responsiveness (zero network calls)
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 10000);

    // Initial snapshot load on startup only (zero recurring polling - all real-time events use WebSocket)
    setTimeout(() => {
      this.fetchEvents();
      this.fetchNotifications();
      this.checkDueReminders();
    }, 1500);
  }

  public checkDueReminders() {
    const events = this.getCachedEvents();
    const now = new Date();
    let updated = false;

    events.forEach((evt) => {
      if (evt.isCompleted || evt.notificationSent) return;

      try {
        if (!evt.eventDate) return;
        const timePart = evt.eventTime || '09:00';
        const [hours, minutes] = timePart.split(':').map(Number);
        const dateParts = evt.eventDate.split('-').map(Number);
        if (dateParts.length < 3) return;

        // Construct local date time reliably without UTC timezone skew
        const eventDateTime = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes, 0, 0);

        const leadOffset = (Number(evt.remindBeforeMinutes) || 0) * 60 * 1000;
        const triggerTime = new Date(eventDateTime.getTime() - leadOffset);

        const diffMs = now.getTime() - triggerTime.getTime();
        const twoDaysMs = 48 * 60 * 60 * 1000;

        // Trigger when current time is at or past the scheduled trigger time (within 48h active window)
        if (diffMs >= 0 && diffMs <= twoDaysMs) {
          evt.notificationSent = true;
          updated = true;

          const rawCandidate = evt.candidateName;
          const cleanCandidate = rawCandidate ? rawCandidate.replace(/^Candidate:\s*/i, '').trim() : '';
          const formattedTime12h = format12HourTime(timePart);

          let msg = evt.description && evt.description.trim() ? evt.description.trim() : '';
          if (!msg) {
            msg = cleanCandidate
              ? `Reminder for ${cleanCandidate} scheduled at ${formattedTime12h}.`
              : `Reminder scheduled for ${formattedTime12h}.`;
          }

          console.log(`[Reminders] 🔔 Reminder due! Triggering banner & sound for: "${evt.title}" (${formattedTime12h})`);

          this.addNotification({
            userId: evt.userId || this.getCurrentUserLogin(),
            title: evt.title,
            message: msg,
            type: 'REMINDER',
            referenceId: evt.id,
            referenceType: 'EVENT',
            scheduledFor: eventDateTime.toISOString(),
          });
        }
      } catch (err) {
        console.warn('Reminder calculation error:', err);
      }
    });

    if (updated) {
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events));
      window.dispatchEvent(new CustomEvent('ssa_events_updated'));
    }
  }

  // --- DESKTOP WEB NOTIFICATIONS ---

  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  private sendBrowserNotification(title: string, body: string) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/brand-logo.jpg',
          badge: '/brand-logo.jpg',
        });
      } catch {}
    }
  }

  // --- INDIAN CALENDAR HELPERS ---

  public getIndianHolidaysForMonth(year: number, monthIndex: number): IndianHoliday[] {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return INDIAN_HOLIDAYS.filter((h) => h.date.startsWith(prefix));
  }

  public getIndianHolidayForDate(dateStr: string): IndianHoliday | undefined {
    return INDIAN_HOLIDAYS.find((h) => h.date === dateStr);
  }
}

export interface RemainingTimeResult {
  text: string;
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
  isPast: boolean;
  isNear: boolean;
}

/**
 * Calculates human-readable duration remaining until reminder fires (e.g. "8 hours remaining", "12 hours remaining")
 */
export function getRemainingTimeInfo(
  eventDateStr?: string,
  eventTimeStr?: string
): RemainingTimeResult | null {
  if (!eventDateStr) return null;
  const parts = eventDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  const [y, m, d] = parts;
  const timeParts = (eventTimeStr || '00:00').split(':').map(Number);
  const h = isNaN(timeParts[0]) ? 0 : timeParts[0];
  const min = isNaN(timeParts[1]) ? 0 : timeParts[1];

  const target = new Date(y, m - 1, d, h, min, 0);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    const pastMinutes = Math.abs(Math.floor(diffMs / 60000));
    if (pastMinutes < 2) {
      return {
        text: 'Starting right now',
        days: 0,
        hours: 0,
        minutes: 0,
        totalMinutes: 0,
        isPast: false,
        isNear: true,
      };
    }
    return {
      text: 'Scheduled time has passed',
      days: 0,
      hours: 0,
      minutes: 0,
      totalMinutes: -pastMinutes,
      isPast: true,
      isNear: false,
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  let text = '';
  if (days > 0) {
    if (hours > 0) {
      text = `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'} remaining`;
    } else {
      text = `${days} ${days === 1 ? 'day' : 'days'} remaining`;
    }
  } else if (hours > 0) {
    if (minutes > 0) {
      text = `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min remaining`;
    } else {
      text = `${hours} ${hours === 1 ? 'hour' : 'hours'} remaining`;
    }
  } else {
    text = `${minutes} min${minutes === 1 ? '' : 's'} remaining`;
  }

  return {
    text,
    days,
    hours,
    minutes,
    totalMinutes,
    isPast: false,
    isNear: totalMinutes <= 60,
  };
}

/**
 * Returns formatted readable event date/time with Today/Tomorrow awareness (IST)
 */
export function formatEventReadable(eventDateStr: string, eventTimeStr?: string): string {
  try {
    const parts = eventDateStr.split('-').map(Number);
    if (parts.length < 3) return `${eventDateStr} ${eventTimeStr || ''}`.trim();
    const [y, m, d] = parts;
    const timeParts = (eventTimeStr || '00:00').split(':').map(Number);
    const h = isNaN(timeParts[0]) ? 0 : timeParts[0];
    const min = isNaN(timeParts[1]) ? 0 : timeParts[1];

    const target = new Date(y, m - 1, d, h, min, 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(y, m - 1, d);

    const timeStrFormatted = target.toLocaleTimeString('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return `Today at ${timeStrFormatted}`;
    }
    if (diffDays === 1) {
      return `Tomorrow at ${timeStrFormatted}`;
    }
    if (diffDays === -1) {
      return `Yesterday at ${timeStrFormatted}`;
    }

    const dateFormatted = target.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: y !== now.getFullYear() ? 'numeric' : undefined,
    });
    return `${dateFormatted} at ${timeStrFormatted}`;
  } catch {
    return `${eventDateStr} ${eventTimeStr || ''}`.trim();
  }
}

export const reminderNotificationService = new ReminderNotificationService();
export default reminderNotificationService;
