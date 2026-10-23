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
  private syncInterval: any = null;

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
    const tempId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newEvent: CalendarEventDTO = {
      ...eventData,
      id: tempId,
      notificationSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update local cache immediately for zero-latency response
    const cached = this.getCachedEvents();
    cached.unshift(newEvent);
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_events_updated'));

    // Attempt real backend POST
    try {
      const savedOnServer = await notificationApiService.createEvent(newEvent);
      if (savedOnServer && savedOnServer.id) {
        // Replace temp ID with server ID
        const idx = cached.findIndex((e) => e.id === tempId);
        if (idx !== -1) {
          cached[idx] = savedOnServer;
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
          window.dispatchEvent(new CustomEvent('ssa_events_updated'));
        }
        return savedOnServer;
      }
    } catch {
      // Fallback kept
    }

    this.checkDueReminders();
    return newEvent;
  }

  public async updateEvent(id: string, updates: Partial<CalendarEventDTO>): Promise<CalendarEventDTO | null> {
    const cached = this.getCachedEvents();
    const idx = cached.findIndex((e) => e.id === id);
    if (idx !== -1) {
      cached[idx] = { ...cached[idx], ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(cached));
      window.dispatchEvent(new CustomEvent('ssa_events_updated'));
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

  // --- INTERNAL NOTIFICATIONS (DYNAMIC API WITH FALLBACK) ---

  public async fetchNotifications(): Promise<NotificationDTO[]> {
    try {
      const serverNotifs = await notificationApiService.getNotifications();
      if (Array.isArray(serverNotifs)) {
        localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(serverNotifs));
        window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
        return serverNotifs;
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

  // --- BACKGROUND TICKER & REAL-TIME REMINDER EVALUATOR ---

  public startBackgroundWorkers() {
    if (this.checkInterval) return;

    // Check reminders every 25 seconds
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 25000);

    // Sync with backend API every 60 seconds
    this.syncInterval = setInterval(() => {
      this.fetchEvents();
      this.fetchNotifications();
    }, 60000);

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
        const timePart = evt.eventTime || '09:00';
        const [hours, minutes] = timePart.split(':').map(Number);
        const eventDateTime = new Date(evt.eventDate);
        eventDateTime.setHours(hours, minutes, 0, 0);

        const leadOffset = (evt.remindBeforeMinutes || 0) * 60 * 1000;
        const triggerTime = new Date(eventDateTime.getTime() - leadOffset);

        const diffMs = now.getTime() - triggerTime.getTime();
        const twoDaysMs = 48 * 60 * 60 * 1000;

        if (diffMs >= 0 && diffMs <= twoDaysMs) {
          evt.notificationSent = true;
          updated = true;

          const msg = evt.candidateName
            ? `Reminder: "${evt.title}" for candidate ${evt.candidateName} scheduled at ${timePart}.`
            : `Reminder: "${evt.title}" scheduled for ${timePart}.`;

          this.addNotification({
            userId: evt.userId,
            title: `🔔 ${evt.title}`,
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

export const reminderNotificationService = new ReminderNotificationService();
export default reminderNotificationService;
