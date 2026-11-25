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
import { format12HourTime, IST_TIMEZONE, cleanNotificationMessage } from '../utils/dateTimeUtils';
import { resolveNotificationTarget } from '../utils/notificationNavigation';

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
const NOTIFIED_EVENT_IDS_KEY = 'ssa_notified_event_ids_v1';
const SERVER_NOTIF_IDS_KEY = 'ssa_server_notif_ids_v1';
const DELETED_NOTIF_IDS_KEY = 'ssa_deleted_notif_ids_v1';
const DELETED_NOTIF_KEYS_KEY = 'ssa_deleted_notif_keys_v1';

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

      // Purge mock notifications, deleted items, and collapse existing duplicate cards
      const rawNotifs = localStorage.getItem(NOTIFICATIONS_CACHE_KEY);
      if (rawNotifs) {
        try {
          const parsed = JSON.parse(rawNotifs);
          if (Array.isArray(parsed)) {
            const deduplicated: NotificationDTO[] = [];
            for (const n of parsed) {
              if (
                n.id === 'notif-welcome' ||
                n.referenceId === 'evt-1' ||
                n.referenceId === 'evt-2' ||
                n.title?.includes('Schengen Visa') ||
                n.title?.includes('Follow up with Praveen') ||
                n.title?.includes('Internal Notification System Online') ||
                this.isDeletedNotification(n)
              ) {
                continue;
              }
              if (n.message) {
                n.message = cleanNotificationMessage(n.message, n.title);
              }
              const existingIdx = deduplicated.findIndex((item) => this.isSameNotification(item, n));
              if (existingIdx === -1) {
                deduplicated.push(n);
              } else {
                if (n.isServerBacked && !deduplicated[existingIdx].isServerBacked) {
                  deduplicated[existingIdx] = n;
                }
              }
            }
            localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(deduplicated));
          }
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

  // --- CALENDAR EVENTS & REMINDERS (DYNAMIC API WITH FALLBACK & DEDUPLICATION) ---
  private inFlightFetchEvents: Promise<CalendarEventDTO[]> | null = null;
  private lastFetchEventsTime = 0;

  public async fetchEvents(params?: { month?: number; year?: number }, force = false): Promise<CalendarEventDTO[]> {
    if (!force && !params && Date.now() - this.lastFetchEventsTime < 20000) {
      return this.getCachedEvents();
    }
    if (!force && !params && this.inFlightFetchEvents) {
      return this.inFlightFetchEvents;
    }

    const fetchPromise = (async () => {
      try {
        const serverEvents = await notificationApiService.getEvents(params);
        if (Array.isArray(serverEvents)) {
          this.lastFetchEventsTime = Date.now();
          localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(serverEvents));
          window.dispatchEvent(new CustomEvent('ssa_events_updated'));
          return serverEvents;
        }
      } catch {
        // Backend not yet deployed or offline: fallback to resilient local cache
      } finally {
        if (!params) this.inFlightFetchEvents = null;
      }
      return this.getCachedEvents();
    })();

    if (!params) this.inFlightFetchEvents = fetchPromise;
    return fetchPromise;
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

  // --- INTERNAL NOTIFICATIONS (DYNAMIC API WITH FALLBACK & DEDUPLICATION) ---

  public getDeletedNotificationIds(): Set<string> {
    try {
      const raw = localStorage.getItem(DELETED_NOTIF_IDS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  public getDeletedNotificationKeys(): Set<string> {
    try {
      const raw = localStorage.getItem(DELETED_NOTIF_KEYS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  public getDedupeKey(n: Partial<NotificationDTO>): string {
    if (!n) return '';
    const cleanTitle = (n.title || '')
      .replace(/^🔔\s*/, '')
      .replace(/^Reminder:\s*/i, '')
      .trim()
      .toLowerCase();

    const type = (n.type || 'NOTIFICATION').toUpperCase();

    if (n.referenceType && n.referenceId) {
      return `${type}_${n.referenceType}_${n.referenceId}`.toLowerCase();
    }

    if (n.id) {
      return `${type}_${n.id}`.toLowerCase();
    }

    const dateKey = n.scheduledFor
      ? n.scheduledFor.substring(0, 10)
      : n.createdAt
      ? n.createdAt.substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    return `${type}_${cleanTitle}_${dateKey}`.toLowerCase();
  }

  public getReminderTitleDateKey(n: Partial<NotificationDTO>): string {
    if (!n) return '';
    const cleanTitle = (n.title || '')
      .replace(/^🔔\s*/, '')
      .replace(/^Reminder:\s*/i, '')
      .trim()
      .toLowerCase();
    const dateKey = n.scheduledFor
      ? n.scheduledFor.substring(0, 10)
      : n.createdAt
      ? n.createdAt.substring(0, 10)
      : new Date().toISOString().substring(0, 10);
    return `reminder_${cleanTitle}_${dateKey}`;
  }

  public isSameNotification(a: Partial<NotificationDTO>, b: Partial<NotificationDTO>): boolean {
    if (!a || !b) return false;

    // 1. Exact ID match (identical notification record)
    if (a.id && b.id && String(a.id) === String(b.id)) {
      return true;
    }

    const typeA = (a.type || '').toUpperCase();
    const typeB = (b.type || '').toUpperCase();

    // 2. CHAT messages must NEVER be collapsed by sender title; only match by exact ID or matching referenceId.
    if (typeA === 'CHAT' || typeB === 'CHAT') {
      return Boolean(
        a.referenceId &&
        b.referenceId &&
        String(a.referenceId) === String(b.referenceId) &&
        typeA === typeB
      );
    }

    // Extract effective referenceId (handles `lead-123` / `evt-abc` local IDs if referenceId is omitted)
    const getEffectiveRefId = (n: Partial<NotificationDTO>): string => {
      if (n.referenceId !== undefined && n.referenceId !== null && String(n.referenceId).trim() !== '') {
        return String(n.referenceId).trim();
      }
      const idStr = n.id ? String(n.id) : '';
      if (idStr.startsWith('lead-')) return idStr.slice(5);
      if (idStr.startsWith('evt-')) return idStr.slice(4);
      return '';
    };

    const refIdA = getEffectiveRefId(a);
    const refIdB = getEffectiveRefId(b);
    const refTypeA = (a.referenceType || '').toUpperCase();
    const refTypeB = (b.referenceType || '').toUpperCase();

    // 3. Different referenceIds (e.g. lead A vs lead B) -> NEVER the same!
    if (refIdA && refIdB && refIdA !== refIdB) {
      return false;
    }

    // 4. Same referenceId match (collapses server + local + duplicate server records for the same lead/event)
    if (refIdA && refIdB && refIdA === refIdB) {
      if (refTypeA && refTypeB && refTypeA !== refTypeB) {
        return false;
      }
      return true;
    }

    // 5. Reminder title & date match (collapses duplicate cards with same title on the exact same reminder date)
    if (typeA === 'REMINDER' && typeB === 'REMINDER') {
      const keyA = this.getReminderTitleDateKey(a);
      const keyB = this.getReminderTitleDateKey(b);
      if (keyA && keyB && keyA === keyB) {
        return true;
      }
    }

    // 6. Content + date match for non-chat notifications (collapses duplicate server/push deliveries with different IDs)
    const normTitle = (t?: string) => (t || '').replace(/^🔔\s*/, '').trim().toLowerCase();
    const normMsg = (m?: string, t?: string) => cleanNotificationMessage(m || '', t || '').trim().toLowerCase();
    const titleA = normTitle(a.title);
    const titleB = normTitle(b.title);
    const msgA = normMsg(a.message, a.title);
    const msgB = normMsg(b.message, b.title);

    if (titleA && titleB && titleA === titleB && msgA === msgB) {
      const dateA = (a.scheduledFor || a.createdAt || '').substring(0, 10);
      const dateB = (b.scheduledFor || b.createdAt || '').substring(0, 10);
      if (!dateA || !dateB || dateA === dateB) {
        return true;
      }
    }

    const dedupeA = this.getDedupeKey(a);
    const dedupeB = this.getDedupeKey(b);
    return Boolean(dedupeA && dedupeB && dedupeA === dedupeB);
  }

  public isDeletedNotification(n: Partial<NotificationDTO>): boolean {
    if (!n) return false;
    const deletedIds = this.getDeletedNotificationIds();
    if (n.id && deletedIds.has(String(n.id))) {
      return true;
    }
    const deletedKeys = this.getDeletedNotificationKeys();
    const dedupeKey = this.getDedupeKey(n);
    if (dedupeKey && deletedKeys.has(dedupeKey)) {
      return true;
    }
    const reminderKey = this.getReminderTitleDateKey(n);
    if (reminderKey && deletedKeys.has(reminderKey)) {
      return true;
    }
    if (n.referenceType && n.referenceId) {
      const typedKey = `${n.referenceType}_${n.referenceId}`.toLowerCase();
      if (deletedKeys.has(typedKey)) {
        return true;
      }
    }
    if (
      n.referenceId &&
      (n.referenceType === 'EVENT' || n.type === 'REMINDER') &&
      (deletedKeys.has(String(n.referenceId)) || deletedKeys.has(`event_${n.referenceId}`.toLowerCase()))
    ) {
      return true;
    }
    if (
      n.referenceId &&
      (n.referenceType === 'LEAD' || (n.type as string) === 'NEW_LEAD') &&
      (deletedKeys.has(`lead_${n.referenceId}`.toLowerCase()) || deletedKeys.has(`new_lead_${n.referenceId}`.toLowerCase()))
    ) {
      return true;
    }
    return false;
  }

  private inFlightFetchNotifications: Promise<NotificationDTO[]> | null = null;
  private lastFetchNotificationsTime = 0;

  public async fetchNotifications(userId?: string, force = false): Promise<NotificationDTO[]> {
    const targetUser = userId || this.getCurrentUserLogin();

    if (!force && Date.now() - this.lastFetchNotificationsTime < 15000) {
      return this.getCachedNotifications().filter((n) => !this.isDeletedNotification(n));
    }

    if (!force && this.inFlightFetchNotifications) {
      return this.inFlightFetchNotifications;
    }

    const fetchPromise = (async () => {
      try {
        const serverNotifs = await notificationApiService.getNotifications(targetUser);
        if (Array.isArray(serverNotifs)) {
          this.lastFetchNotificationsTime = Date.now();
          // 1. Process server notifications and track current active server IDs
          const currentServerIds = new Set<string>();
          const validServerNotifs: NotificationDTO[] = [];
          for (const n of serverNotifs) {
            if (this.isDeletedNotification(n)) {
              try {
                notificationApiService.deleteNotification(n.id);
              } catch {}
            } else {
              n.isServerBacked = true;
              currentServerIds.add(String(n.id));
              validServerNotifs.push(n);
            }
          }

          // Store exact active server IDs (never accumulate stale/deleted IDs)
          this.setServerNotificationIds(currentServerIds);

          // 2. Load cached notifications and filter out any deleted ones
          const cached = this.getCachedNotifications().filter((n) => !this.isDeletedNotification(n));

          // 3. Deduplicate merge: server notifications take precedence
          const deduplicatedList: NotificationDTO[] = [];

          for (const sNotif of validServerNotifs) {
            const existingIdx = deduplicatedList.findIndex((item) => this.isSameNotification(item, sNotif));
            if (existingIdx === -1) {
              deduplicatedList.push(sNotif);
            } else {
              deduplicatedList[existingIdx] = {
                ...sNotif,
                isRead: deduplicatedList[existingIdx].isRead || sNotif.isRead,
              };
            }
          }

          for (const cNotif of cached) {
            const alreadyInList = deduplicatedList.some((item) => this.isSameNotification(item, cNotif));
            if (!alreadyInList) {
              deduplicatedList.push(cNotif);
            }
          }

          if (deduplicatedList.length === 0) {
            return await this.populateFromRecentLeadsAndEvents([]);
          }

          deduplicatedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(deduplicatedList));
          window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
          return deduplicatedList;
        }
      } catch (err) {
        console.warn('[Notifications] Failed to fetch server notifications:', err);
      } finally {
        this.inFlightFetchNotifications = null;
      }

      const validCached = this.getCachedNotifications().filter((n) => !this.isDeletedNotification(n));
      if (validCached.length === 0) {
        return await this.populateFromRecentLeadsAndEvents([]);
      }
      return validCached;
    })();

    this.inFlightFetchNotifications = fetchPromise;
    return fetchPromise;
  }

  /**
   * Enterprise Lead & Event Notification Synthesizer (MNC Standard)
   * Automatically synchronizes lead arrivals and upcoming/recent calendar reminders into the
   * notifications mailbox so the counselor's notification center always reflects real CRM activity.
   */
  public async populateFromRecentLeadsAndEvents(existingList: NotificationDTO[] = []): Promise<NotificationDTO[]> {
    const deletedKeys = this.getDeletedNotificationKeys();
    const deletedIds = this.getDeletedNotificationIds();
    const result: NotificationDTO[] = [...existingList];

    // 1. Synchronize recent leads
    try {
      const crmModule = await import('./api/crmService');
      let leads: any[] = [];
      try {
        const detailed = await crmModule.default.getDetailedLeads();
        if (Array.isArray(detailed) && detailed.length > 0) {
          leads = detailed;
        }
      } catch {}

      if (leads.length === 0) {
        try {
          const pageRes = await crmModule.default.getLeads(0, 50, 'id,desc');
          leads = Array.isArray(pageRes) ? pageRes : (pageRes as any)?.content || [];
        } catch {}
      }

      const recentLeads = leads.slice(0, 40);
      for (const lead of recentLeads) {
        if (!lead || !lead.id) continue;
        const strId = String(lead.id);
        const name = lead.customerName || (lead.customer && lead.customer.fullName) || 'New Lead';
        const phone = lead.phoneNumber || (lead.customer && lead.customer.phoneNumber) || '';
        const source = lead.campaignName || lead.leadFormName || 'Meta Ad Campaign';
        const notifId = `lead-${strId}`;
        const dedupeKey = `new_lead_lead_${strId}`.toLowerCase();

        if (
          deletedIds.has(notifId) ||
          deletedKeys.has(dedupeKey) ||
          deletedKeys.has(`lead_${strId}`.toLowerCase()) ||
          deletedKeys.has(notifId)
        ) {
          continue;
        }

        const isUncontacted = !lead.status || lead.status === 'CREATED' || lead.status === 'NEW';
        const notifItem: NotificationDTO = {
          id: notifId,
          userId: 'current',
          title: `New Lead Received: ${name}`,
          message: phone ? `${phone} • ${source}` : source,
          type: 'NEW_LEAD' as any,
          referenceId: strId,
          referenceType: 'LEAD',
          isRead: !isUncontacted,
          createdAt: lead.createdTime || new Date().toISOString(),
          isServerBacked: false,
        };

        const alreadyExists = result.some((item) => this.isSameNotification(item, notifItem));
        if (!alreadyExists) {
          result.push(notifItem);
        }
      }
    } catch (leadErr) {
      console.warn('[Reminders] Failed to populate lead notifications:', leadErr);
    }

    // 2. Synchronize calendar events & reminders
    try {
      const events = this.getCachedEvents();
      for (const evt of events) {
        if (!evt || !evt.id) continue;
        const strId = String(evt.id);
        const notifId = `evt-${strId}`;
        const dedupeKey = `reminder_event_${strId}`.toLowerCase();

        if (
          deletedIds.has(notifId) ||
          deletedKeys.has(dedupeKey) ||
          deletedKeys.has(`event_${strId}`.toLowerCase()) ||
          deletedKeys.has(notifId)
        ) {
          continue;
        }

        const notifItem: NotificationDTO = {
          id: notifId,
          userId: 'current',
          title: `Reminder: ${evt.title || 'Follow-up with Candidate'}`,
          message: evt.candidateName
            ? `Candidate: ${evt.candidateName}${evt.eventTime ? ` at ${evt.eventTime}` : ''}`
            : (evt.description || 'Follow-up reminder'),
          type: 'REMINDER',
          referenceId: strId,
          referenceType: 'EVENT',
          isRead: evt.isCompleted || false,
          createdAt: evt.createdAt || new Date().toISOString(),
          isServerBacked: false,
        };

        const alreadyExists = result.some((item) => this.isSameNotification(item, notifItem));
        if (!alreadyExists) {
          result.push(notifItem);
        }
      }
    } catch (evtErr) {
      console.warn('[Reminders] Failed to populate event notifications:', evtErr);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
    return result;
  }

  public getServerNotificationIds(): Set<string> {
    try {
      const raw = localStorage.getItem(SERVER_NOTIF_IDS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  public setServerNotificationIds(ids: Set<string>): void {
    try {
      localStorage.setItem(SERVER_NOTIF_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {}
  }

  public recordServerNotificationId(id: string): void {
    if (!id) return;
    const set = this.getServerNotificationIds();
    set.add(String(id));
    this.setServerNotificationIds(set);
  }

  public removeServerNotificationId(id: string): void {
    if (!id) return;
    const set = this.getServerNotificationIds();
    set.delete(String(id));
    this.setServerNotificationIds(set);
  }

  public isServerNotification(id: string): boolean {
    if (!id) return false;
    const cached = this.getCachedNotifications();
    const item = cached.find((n) => String(n.id) === String(id));
    if (item && item.isServerBacked === false) {
      return false;
    }
    return this.getServerNotificationIds().has(String(id));
  }

  public getCachedNotifications(): NotificationDTO[] {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_CACHE_KEY);
      const list: NotificationDTO[] = raw ? JSON.parse(raw) : [];
      // Deduplicate on read to collapse any existing duplicates in local storage
      const deduped: NotificationDTO[] = [];
      for (const item of list) {
        if (this.isDeletedNotification(item)) continue;
        const existingIdx = deduped.findIndex((d) => this.isSameNotification(d, item));
        if (existingIdx === -1) {
          deduped.push({ ...item });
        } else {
          // If either is read, preserve read state
          if (item.isRead) deduped[existingIdx].isRead = true;
          // Prefer server-backed item for ID and syncing
          if (item.isServerBacked) {
            deduped[existingIdx] = {
              ...item,
              isRead: deduped[existingIdx].isRead || item.isRead,
            };
          }
        }
      }
      const sorted = deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (deduped.length !== list.length) {
        try {
          localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(sorted));
        } catch {}
      }
      return sorted;
    } catch {
      return [];
    }
  }

  public getUnreadNotificationCount(): number {
    return this.getCachedNotifications().filter((n) => !n.isRead).length;
  }

  public addNotification(
    notification: Omit<NotificationDTO, 'id' | 'createdAt' | 'isRead'>,
    showBanner = true
  ): NotificationDTO | null {
    if (this.isDeletedNotification(notification as any)) {
      return null;
    }

    const cached = this.getCachedNotifications();

    // Check if identical notification already exists
    const existingIdx = cached.findIndex((item) => this.isSameNotification(item, notification as any));
    if (existingIdx !== -1) {
      cached[existingIdx] = {
        ...cached[existingIdx],
        message: notification.message || cached[existingIdx].message,
      };
      localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
      window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
      return cached[existingIdx];
    }

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

    const newItem: NotificationDTO = {
      ...notification,
      id: generateUUID(),
      isRead: false,
      createdAt: new Date().toISOString(),
      isServerBacked: false,
    };

    cached.unshift(newItem);
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    if (showBanner) {
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
          durationMs: 5000,
          referenceId: newItem.referenceId,
          referenceType: newItem.referenceType,
          url: resolveNotificationTarget(newItem)?.path || '/calendar',
        });
      } catch (bannerErr) {
        console.warn('Banner show error:', bannerErr);
      }
    }

    return newItem;
  }

  public async markAsRead(id: string): Promise<void> {
    if (!id) return;
    const strId = String(id);
    const cached = this.getCachedNotifications();
    const item = cached.find((n) => String(n.id) === strId);
    if (!item) return;

    const serverIdsToSync = new Set<string>();

    cached.forEach((n) => {
      if (String(n.id) === strId || this.isSameNotification(n, item)) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        if (this.isServerNotification(n.id) && this.getServerNotificationIds().has(String(n.id))) {
          serverIdsToSync.add(String(n.id));
        }
      }
    });

    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    if (this.isServerNotification(strId) && this.getServerNotificationIds().has(strId)) {
      serverIdsToSync.add(strId);
    }

    for (const serverId of serverIdsToSync) {
      try {
        await notificationApiService.markAsRead(serverId);
      } catch (err: any) {
        this.removeServerNotificationId(serverId);
      }
    }
  }

  public async markAsUnread(id: string): Promise<void> {
    if (!id) return;
    const strId = String(id);
    const cached = this.getCachedNotifications();
    const item = cached.find((n) => String(n.id) === strId);
    if (!item) return;

    cached.forEach((n) => {
      if (String(n.id) === strId || this.isSameNotification(n, item)) {
        n.isRead = false;
        delete (n as any).readAt;
      }
    });

    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
  }

  public async markAllAsRead(): Promise<void> {
    const cached = this.getCachedNotifications();
    const nowIso = new Date().toISOString();
    cached.forEach((n) => {
      n.isRead = true;
      n.readAt = nowIso;
    });
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));

    try {
      await notificationApiService.markAllAsRead();
    } catch {}
  }

  public async deleteNotification(id: string): Promise<void> {
    if (!id) return;
    const strId = String(id);
    const cached = this.getCachedNotifications();
    const target = cached.find((n) => String(n.id) === strId);

    const deletedIds = this.getDeletedNotificationIds();
    const deletedKeys = this.getDeletedNotificationKeys();

    deletedIds.add(strId);

    const matchingItems: NotificationDTO[] = [];
    const remainingItems: NotificationDTO[] = [];

    for (const item of cached) {
      if (String(item.id) === strId || (target && this.isSameNotification(item, target))) {
        matchingItems.push(item);
      } else {
        remainingItems.push(item);
      }
    }

    matchingItems.forEach((item) => {
      deletedIds.add(String(item.id));
      const k1 = this.getDedupeKey(item);
      if (k1) deletedKeys.add(k1);
      const k2 = this.getReminderTitleDateKey(item);
      if (k2) deletedKeys.add(k2);
      if (item.referenceId) {
        deletedKeys.add(String(item.referenceId));
        deletedKeys.add(`event_${item.referenceId}`.toLowerCase());
      }
      if (item.referenceType && item.referenceId) {
        deletedKeys.add(`${item.referenceType}_${item.referenceId}`.toLowerCase());
      }
    });

    if (target) {
      const k1 = this.getDedupeKey(target);
      if (k1) deletedKeys.add(k1);
      const k2 = this.getReminderTitleDateKey(target);
      if (k2) deletedKeys.add(k2);
      if (target.referenceId) {
        deletedKeys.add(String(target.referenceId));
        deletedKeys.add(`event_${target.referenceId}`.toLowerCase());
      }
    }

    // Persist tombstones and remaining items immediately
    try {
      localStorage.setItem(DELETED_NOTIF_IDS_KEY, JSON.stringify(Array.from(deletedIds)));
      localStorage.setItem(DELETED_NOTIF_KEYS_KEY, JSON.stringify(Array.from(deletedKeys)));
      localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(remainingItems));
      window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
    } catch (e) {
      console.warn('Storage tombstone error:', e);
    }

    // Dispatch DELETE request to backend for all real active server-backed IDs found
    const serverIdsToDelete = new Set<string>();
    if (this.isServerNotification(strId) && this.getServerNotificationIds().has(strId)) {
      serverIdsToDelete.add(strId);
    }
    matchingItems.forEach((item) => {
      if (this.isServerNotification(item.id) && this.getServerNotificationIds().has(String(item.id))) {
        serverIdsToDelete.add(String(item.id));
      }
    });

    for (const serverId of serverIdsToDelete) {
      try {
        await notificationApiService.deleteNotification(serverId);
      } catch (err: any) {
        this.removeServerNotificationId(serverId);
      }
    }
  }

  public async clearAllNotifications(): Promise<void> {
    const cached = this.getCachedNotifications();
    const deletedIds = this.getDeletedNotificationIds();
    const deletedKeys = this.getDeletedNotificationKeys();

    cached.forEach((item) => {
      deletedIds.add(String(item.id));
      const k1 = this.getDedupeKey(item);
      if (k1) deletedKeys.add(k1);
      const k2 = this.getReminderTitleDateKey(item);
      if (k2) deletedKeys.add(k2);
      if (item.referenceId) {
        deletedKeys.add(String(item.referenceId));
        deletedKeys.add(`event_${item.referenceId}`.toLowerCase());
      }
      if (item.referenceType && item.referenceId) {
        deletedKeys.add(`${item.referenceType}_${item.referenceId}`.toLowerCase());
      }
    });

    try {
      localStorage.setItem(DELETED_NOTIF_IDS_KEY, JSON.stringify(Array.from(deletedIds)));
      localStorage.setItem(DELETED_NOTIF_KEYS_KEY, JSON.stringify(Array.from(deletedKeys)));
      localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
    } catch {}

    try {
      await notificationApiService.clearAllNotifications();
    } catch {}
  }

  /**
   * Directly stores incoming notification from WebSocket push without making HTTP requests
   */
  public addIncomingNotification(notification: NotificationDTO): void {
    if (this.isDeletedNotification(notification)) {
      return;
    }
    notification.isServerBacked = true;
    this.recordServerNotificationId(notification.id);

    const cached = this.getCachedNotifications();
    const existingIdx = cached.findIndex((n) => this.isSameNotification(n, notification));
    if (existingIdx !== -1) {
      cached[existingIdx] = { ...cached[existingIdx], ...notification, isServerBacked: true };
    } else {
      cached.unshift(notification);
    }
    localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(cached));
    window.dispatchEvent(new CustomEvent('ssa_notifications_updated'));
  }

  // --- BACKGROUND TICKER & REAL-TIME REMINDER EVALUATOR ---

  public getNotifiedEventIds(): Set<string> {
    try {
      const raw = localStorage.getItem(NOTIFIED_EVENT_IDS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  /**
   * Records a reminder that came due while the app was closed/asleep as an inbox notification.
   * No banner or sound (avoids a burst of popups on startup), but the counselor can still see it.
   * Only reminders missed within the last 24 hours are surfaced.
   */
  private recordMissedReminder(evt: CalendarEventDTO, eventDateTime: Date, triggerTimeMs: number): void {
    const MISSED_WINDOW_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - triggerTimeMs > MISSED_WINDOW_MS) return;

    const strId = String(evt.id);
    const alreadyInInbox = this.getCachedNotifications().some(
      (n) => n.referenceType === 'EVENT' && String(n.referenceId) === strId
    );
    if (alreadyInInbox) return;

    const cleanCandidate = evt.candidateName ? evt.candidateName.replace(/^Candidate:\s*/i, '').trim() : '';
    const timeLabel = format12HourTime(evt.eventTime || '09:00');
    const detail = evt.description?.trim() || cleanCandidate;

    this.addNotification(
      {
        userId: evt.userId || this.getCurrentUserLogin(),
        title: `Missed reminder: ${evt.title}`,
        message: detail ? `Due ${timeLabel} · ${detail}` : `Due ${timeLabel}`,
        type: 'REMINDER',
        referenceId: evt.id,
        referenceType: 'EVENT',
        scheduledFor: eventDateTime.toISOString(),
      },
      false
    );
  }

  public markPastEventsNotified(events?: CalendarEventDTO[]): void {
    const list = events || this.getCachedEvents();
    const now = Date.now();
    const notified = this.getNotifiedEventIds();
    let updated = false;

    list.forEach((evt) => {
      if (!evt.id) return;
      const strId = String(evt.id);
      if (evt.isCompleted || evt.notificationSent) {
        if (!notified.has(strId)) {
          notified.add(strId);
          updated = true;
        }
        return;
      }
      try {
        if (!evt.eventDate) return;
        const timePart = evt.eventTime || '09:00';
        const [hours, minutes] = timePart.split(':').map(Number);
        const dateParts = evt.eventDate.split('-').map(Number);
        if (dateParts.length < 3) return;

        const eventDateTime = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes, 0, 0);
        const leadOffset = (Number(evt.remindBeforeMinutes) || 0) * 60 * 1000;
        const triggerTime = eventDateTime.getTime() - leadOffset;

        // Any reminder whose scheduled time is ALREADY in the past on startup and was never
        // notified: record it in the inbox (no banner), then mark notified so it never re-fires.
        if (triggerTime <= now) {
          if (!notified.has(strId)) {
            this.recordMissedReminder(evt, eventDateTime, triggerTime);
          }
          notified.add(strId);
          evt.notificationSent = true;
          updated = true;
        }
      } catch {}
    });

    localStorage.setItem(NOTIFIED_EVENT_IDS_KEY, JSON.stringify(Array.from(notified)));
    if (updated) {
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(list));
    }
  }

  public startBackgroundWorkers() {
    if (this.checkInterval) return;

    // Check reminders locally in memory every 10 seconds for real-time exact-minute responsiveness
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 10000);

    // Initial snapshot load on startup: fetch events and notifications, mark existing past events as already notified silently (NO BANNER ON REFRESH!)
    setTimeout(async () => {
      try {
        const events = await this.fetchEvents();
        this.fetchNotifications();
        // Silently mark past events as notified so they NEVER trigger banners on page reload
        this.markPastEventsNotified(events);
      } catch {}
    }, 1200);
  }

  public checkDueReminders() {
    const events = this.getCachedEvents();
    const now = new Date();
    const nowMs = now.getTime();
    const notified = this.getNotifiedEventIds();
    const deletedKeys = this.getDeletedNotificationKeys();
    const cachedNotifs = this.getCachedNotifications();
    let updated = false;

    events.forEach((evt) => {
      if (!evt.id) return;
      const strId = String(evt.id);

      // If already completed or already notified, DO NOTHING
      if (evt.isCompleted || evt.notificationSent || notified.has(strId)) {
        return;
      }

      // If user deleted this reminder notification previously, skip it silently
      if (
        deletedKeys.has(strId) ||
        deletedKeys.has(`event_${strId}`.toLowerCase()) ||
        deletedKeys.has(`reminder_event_${strId}`.toLowerCase())
      ) {
        evt.notificationSent = true;
        notified.add(strId);
        updated = true;
        return;
      }

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

        const diffMs = nowMs - triggerTime.getTime();

        // ONLY trigger if the reminder is due RIGHT NOW (within a narrow 30-second window while tab is open)
        if (diffMs >= 0 && diffMs <= 30000) {
          evt.notificationSent = true;
          notified.add(strId);
          updated = true;

          const rawCandidate = evt.candidateName;
          const cleanCandidate = rawCandidate ? rawCandidate.replace(/^Candidate:\s*/i, '').trim() : '';
          const formattedTime12h = format12HourTime(timePart);

          // Only use user-entered notes/description; never generate static boilerplate
          let msg = evt.description && evt.description.trim() ? evt.description.trim() : '';
          if (!msg && cleanCandidate && cleanCandidate.toLowerCase() !== evt.title.toLowerCase()) {
            msg = cleanCandidate;
          }

          console.log(`[Reminders] 🔔 Exact-time reminder reached: "${evt.title}" (${formattedTime12h})`);

          // If a notification for this event already exists in the cache, don't show another duplicate
          const alreadyNotifiedInCache = cachedNotifs.some(
            (n) =>
              (n.referenceType === 'EVENT' && String(n.referenceId) === strId) ||
              this.isSameNotification(n, {
                title: evt.title,
                type: 'REMINDER',
                referenceId: evt.id,
                referenceType: 'EVENT',
              })
          );

          if (!alreadyNotifiedInCache) {
            this.addNotification(
              {
                userId: evt.userId || this.getCurrentUserLogin(),
                title: evt.title,
                message: msg,
                type: 'REMINDER',
                referenceId: evt.id,
                referenceType: 'EVENT',
                scheduledFor: eventDateTime.toISOString(),
              },
              true // Show banner with iPhone sound & 5s auto-hide
            );
          }
        } else if (diffMs > 30000) {
          // Already past (e.g. browser was sleeping): record in inbox without a banner, then mark notified
          this.recordMissedReminder(evt, eventDateTime, triggerTime.getTime());
          evt.notificationSent = true;
          notified.add(strId);
          updated = true;
        }
      } catch (err) {
        console.warn('Reminder calculation error:', err);
      }
    });

    if (updated) {
      localStorage.setItem(NOTIFIED_EVENT_IDS_KEY, JSON.stringify(Array.from(notified)));
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
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body,
        icon: '/brand-logo.jpg',
        badge: '/brand-logo.jpg',
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification(title, options))
          .catch(() => {
            try {
              new Notification(title, options);
            } catch {}
          });
      } else {
        try {
          new Notification(title, options);
        } catch {}
      }
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
