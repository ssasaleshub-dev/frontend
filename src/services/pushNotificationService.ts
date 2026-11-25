/**
 * Enterprise Push Notification Service (Firebase Cloud Messaging via Capacitor)
 * Handles native Android FCM token registration, foreground alerts, background notification clicks,
 * deep linking navigation, and backend token synchronization.
 */

import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import axiosClient from './api/axiosClient';
import { resolveNotificationTarget } from '../utils/notificationNavigation';

const FCM_TOKEN_STORAGE_KEY = 'ssa_fcm_token';
const VAPID_KEY = 'BDrOMLhjXKW08RO8-cYa5EH3aQM4SFLvDYL1HAyRiiuz4iBUaofBBU7hPIdYfokjvgMAuMsjh0HcxVF8_w_bISI';

const firebaseWebConfig = {
  apiKey: "AIzaSyA620dxJm4OogLpWi3v3A3kXil-8vMOyQg",
  authDomain: "ssa-sales-hub.firebaseapp.com",
  projectId: "ssa-sales-hub",
  storageBucket: "ssa-sales-hub.firebasestorage.app",
  messagingSenderId: "701029569745",
  appId: "1:701029569745:android:a6cc3a97fbe3cd8c46a1f0",
};

class PushNotificationService {
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!Capacitor.isNativePlatform()) {
      console.info('[PushNotifications] Web environment detected. Initializing Firebase Web Push...');
      await this.initializeWeb();
      return;
    }

    try {
      console.info('[PushNotifications] Initializing Firebase Push Notifications on native device...');

      // 1. Create notification channel on Android 8.0+ first
      await this.createDefaultNotificationChannel();

      // 2. Attach listeners FIRST so no events are missed
      await PushNotifications.addListener('registration', (token: Token) => {
        console.info('[PushNotifications] FCM Device Token received:', token.value);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        this.syncTokenWithBackend(token.value);

        window.dispatchEvent(
          new CustomEvent('ssa_fcm_token_registered', { detail: { token: token.value } })
        );
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[PushNotifications] Error on registration:', error);
      });

      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.info('[PushNotifications] Push received in foreground:', notification);

          // Strictly single notification: Firebase Cloud Messaging native SDK delivers and displays
          // the notification in the Android system tray. We NEVER invoke LocalNotifications here
          // to eliminate duplicate notifications.

          import('./reminderNotificationService')
            .then((m) => {
              const data = notification.data || {};
              const candidateName = data.candidateName || (notification.title ? notification.title.replace(/^New Lead Received:\s*/i, '').trim() : '');
              const phone = data.phoneNumber || '';
              const title = notification.title || data.title || (candidateName ? `New Lead Received: ${candidateName}` : 'SSA Notification');
              const message = notification.body || data.body || data.message || (phone ? `${phone} | Meta Ad Campaign` : '');

              m.default.addNotification({
                userId: data.userId || 'current',
                title,
                message,
                type: (data.type as any) || (data.leadId ? 'NEW_LEAD' : 'SYSTEM'),
                referenceId: data.referenceId || data.leadId || data.eventId,
                referenceType: data.referenceType || (data.leadId ? 'LEAD' : data.eventId ? 'EVENT' : undefined),
              }, false);
            })
            .catch(() => {});

          // Dispatch UI notification event
          window.dispatchEvent(
            new CustomEvent('ssa_push_notification_received', { detail: notification })
          );

          // A web check-in is waiting for fingerprint approval: open the approval screen right away
          const pushData = notification.data || {};
          if (pushData.type === 'ATTENDANCE_VERIFY' && pushData.route) {
            window.dispatchEvent(new CustomEvent('ssa_navigate_to', { detail: { path: pushData.route } }));
          }
        }
      );

      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.info('[PushNotifications] Push notification action performed:', action);
          const notification = action.notification;
          const data = notification?.data || {};

          // MNC Standard: Save the actioned push notification into in-app mailbox
          import('./reminderNotificationService')
            .then((m) => {
              const candidateName = data.candidateName || (notification?.title ? notification.title.replace(/^New Lead Received:\s*/i, '').trim() : '');
              const phone = data.phoneNumber || '';
              const title = notification?.title || data.title || (candidateName ? `New Lead Received: ${candidateName}` : 'SSA Notification');
              const message = notification?.body || data.body || data.message || (phone ? `${phone} | Meta Ad Campaign` : '');

              m.default.addNotification({
                userId: data.userId || 'current',
                title,
                message,
                type: (data.type as any) || (data.leadId ? 'NEW_LEAD' : 'SYSTEM'),
                referenceId: data.referenceId || data.leadId || data.eventId,
                referenceType: data.referenceType || (data.leadId ? 'LEAD' : data.eventId ? 'EVENT' : undefined),
              }, false);
            })
            .catch(() => {});

          // Dispatch route navigation event for React Router
          const target = resolveNotificationTarget({
            type: data.type,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            leadId: data.leadId,
            eventId: data.eventId,
            route: data.route,
            url: data.url,
            title: notification?.title || data.title,
            message: notification?.body || data.body || data.message,
          });
          window.dispatchEvent(
            new CustomEvent('ssa_navigate_to', {
              detail: {
                path: target?.path || '/notifications',
                state: { fromNotification: true, searchName: target?.searchName },
              },
            })
          );
        }
      );

      // 3. Check existing permission status
      const permStatus = await PushNotifications.checkPermissions().catch(() => null);

      if (permStatus?.receive === 'granted') {
        // Permission is already granted: register with FCM immediately with zero dialogs
        try {
          await PushNotifications.register();
        } catch (regErr) {
          console.error('[PushNotifications] Register error:', regErr);
        }
      } else {
        // Defer permission request dialog so the app finishes cold-start rendering smoothly.
        // This prevents the Android 13+ "System UI isn't responding" ANR caused by immediate
        // modal dialog injection during WebView initial layout.
        setTimeout(async () => {
          try {
            const req = await PushNotifications.requestPermissions();
            if (req.receive === 'granted') {
              await PushNotifications.register();
            }
          } catch (permErr) {
            console.warn('[PushNotifications] Deferred permission request warning:', permErr);
          }
        }, 1800);
      }
    } catch (err) {
      console.error('[PushNotifications] Failed to initialize push notifications:', err);
    }
  }

  /**
   * Android 8.0+ requires notification channels
   */
  private async createDefaultNotificationChannel(): Promise<void> {
    try {
      if (Capacitor.getPlatform() === 'android') {
        const channelConfig = {
          id: 'fcm_default_channel',
          name: 'SSA CRM Alerts',
          description: 'General notifications and lead/reminder alerts for SSA CRM',
          importance: 5 as const, // High importance (heads-up notification)
          visibility: 1 as const,
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#029858',
        };

        await PushNotifications.createChannel(channelConfig).catch(() => {});
        console.info('[PushNotifications] Default push notification channel created.');
      }
    } catch (e) {
      console.warn('[PushNotifications] Channel creation warning:', e);
    }
  }

  /**
   * Reminder scheduling: In-app & Firebase Push only.
   * NEVER schedules local Android AlarmManager alarms to prevent "Alarms & reminders" OS settings redirects.
   */
  public async scheduleLocalReminder(_event: {
    id?: string;
    title: string;
    candidateName?: string;
    eventDate: string;
    eventTime?: string;
    remindBeforeMinutes?: number;
    description?: string;
    candidateId?: string | number;
  }): Promise<void> {
    // Zero exact-alarm scheduling; handled purely via in-app alerts and backend FCM push
  }

  /**
   * Cancel scheduled reminder
   */
  public async cancelLocalReminder(_id: string): Promise<void> {
    // No-op (no native alarm to cancel)
  }

  private lastSyncedTokenKey: string | null = null;
  private isSyncingToken = false;

  /**
   * Synchronize the FCM token with the backend server (deduplicated & cached)
   */
  public async syncTokenWithBackend(token: string, userId?: string): Promise<void> {
    if (!token) return;

    try {
      const storedUser = localStorage.getItem('ssa_user') || localStorage.getItem('user');
      let currentUserId = userId;
      let numericId: any = undefined;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (!currentUserId) currentUserId = parsed.login || parsed.username;
          numericId = parsed.id;
        } catch {}
      }

      const dedupKey = `${token}_${currentUserId || 'anon'}_${numericId || ''}`;
      // Prevent duplicate concurrent or repeated sync calls for the exact same token and user
      if (this.lastSyncedTokenKey === dedupKey || this.isSyncingToken) {
        return;
      }

      this.isSyncingToken = true;

      const payload: any = {
        token,
        platform: Capacitor.getPlatform(),
        updatedAt: new Date().toISOString(),
        replacePreviousUsers: true,
        overwritePreviousUsers: true,
      };
      if (currentUserId) {
        payload.userId = currentUserId;
        payload.username = currentUserId;
      }
      if (numericId) {
        payload.numericId = String(numericId);
      }

      await axiosClient.post('/api/notifications/fcm-token', payload);
      this.lastSyncedTokenKey = dedupKey;
      console.info('[PushNotifications] FCM token successfully synced to backend for user:', currentUserId);
    } catch {
      console.warn('[PushNotifications] Backend token sync deferred until API endpoint available.');
    } finally {
      this.isSyncingToken = false;
    }
  }

  /**
   * Reset synchronization state so token re-syncs unconditionally when a new user logs in
   */
  public resetSyncState(): void {
    this.lastSyncedTokenKey = null;
    this.isSyncingToken = false;
  }

  /**
   * Explicitly unregister / dissociate this device token from previous user on logout.
   * This ensures the previous user never leaves their token mapped to this device,
   * preventing duplicate notifications when switching accounts.
   */
  public async unregisterTokenOnLogout(userId?: string): Promise<void> {
    const token = this.getStoredToken();
    const storedUser = localStorage.getItem('ssa_user') || localStorage.getItem('user');
    let currentUserId = userId;
    let numericId: any = undefined;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (!currentUserId) currentUserId = parsed.login || parsed.username;
        numericId = parsed.id;
      } catch {}
    }

    this.lastSyncedTokenKey = null;

    if (token) {
      const payload: any = {
        token,
        userId: currentUserId,
        numericId: numericId ? String(numericId) : undefined,
        platform: Capacitor.getPlatform(),
        action: 'UNREGISTER',
      };
      try {
        await axiosClient.post('/api/notifications/fcm-token/unregister', payload).catch(() => {});
      } catch {}
      try {
        await axiosClient.post('/api/notifications/fcm-token/logout', payload).catch(() => {});
      } catch {}
      try {
        await axiosClient.delete('/api/notifications/fcm-token', { data: payload }).catch(() => {});
      } catch {}
    }
  }

  /**
   * Get cached FCM token
   */
  public getStoredToken(): string | null {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  }

  /**
   * Initialize Firebase Web Messaging for desktop / Chrome PC
   */
  private async initializeWeb(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
        console.info('[PushNotifications] Web Push not supported on this browser.');
        return;
      }

      const supported = await isSupported().catch(() => false);
      if (!supported) {
        console.info('[PushNotifications] Firebase Web Messaging is not supported in this environment.');
        return;
      }

      const app = getApps().length === 0 ? initializeApp(firebaseWebConfig) : getApp();
      const messaging = getMessaging(app);

      // Register or find service worker
      let swReg: ServiceWorkerRegistration;
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
        console.info('[PushNotifications] Firebase Messaging Service Worker ready.');
      } catch (swErr) {
        console.error('[PushNotifications] Failed to register service worker:', swErr);
        return;
      }

      // Attach foreground message listener
      onMessage(messaging, (payload) => {
        console.info('[PushNotifications] Web push received in foreground:', payload);
        this.handleIncomingWebMessage(payload);
      });

      // If permission is already granted, register Web FCM token immediately
      if (Notification.permission === 'granted') {
        await this.registerWebPushToken(messaging, swReg);
      } else if (Notification.permission === 'default') {
        // Request permission with gentle delay so the app layout renders smoothly
        setTimeout(async () => {
          try {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
              await this.registerWebPushToken(messaging, swReg);
            }
          } catch (permErr) {
            console.warn('[PushNotifications] Notification permission prompt error:', permErr);
          }
        }, 3000);
      }
    } catch (err) {
      console.error('[PushNotifications] Failed to initialize web push:', err);
    }
  }

  /**
   * Public helper to request notification permission via user click (e.g. settings or notifications banner)
   */
  public async requestWebPushPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      const req = await PushNotifications.requestPermissions();
      if (req.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    }

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const supported = await isSupported().catch(() => false);
        if (supported) {
          try {
            const app = getApps().length === 0 ? initializeApp(firebaseWebConfig) : getApp();
            const messaging = getMessaging(app);
            const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            await navigator.serviceWorker.ready;
            await this.registerWebPushToken(messaging, swReg);
          } catch (fcmErr) {
            console.warn('[PushNotifications] Firebase Web Push init notice:', fcmErr);
          }
        }
        return true;
      }
    } catch (e) {
      console.warn('[PushNotifications] Error requesting web push permission:', e);
    }
    return false;
  }

  /**
   * Send a diagnostic test notification to verify Chrome and Windows OS alert permissions
   */
  public sendTestDesktopNotification(): { success: boolean; message: string } {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, message: 'This browser does not support desktop notifications.' };
    }
    if (Notification.permission === 'denied') {
      return {
        success: false,
        message: 'Notifications are blocked in Chrome. Click the padlock/tune icon in the URL bar (next to https://ssasaleshub.cloud) and set Notifications to "Allow".',
      };
    }
    if (Notification.permission === 'default') {
      return {
        success: false,
        message: 'Notification permission has not been granted yet. Click "Enable" first.',
      };
    }

    try {
      const notif = new Notification('SSA Sales Hub', {
        body: '🎉 Desktop notifications are active! You will receive live alerts for all chat messages and reminders.',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: `test-notif-${Date.now()}`,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return { success: true, message: 'Test notification sent to your desktop!' };
    } catch (e: any) {
      return { success: false, message: `Notification display error: ${e?.message || e}` };
    }
  }

  private async registerWebPushToken(messaging: any, swReg: ServiceWorkerRegistration): Promise<string | null> {
    try {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        console.info('[PushNotifications] Web FCM Token received:', token);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        await this.syncTokenWithBackend(token);
        window.dispatchEvent(
          new CustomEvent('ssa_fcm_token_registered', { detail: { token } })
        );
        return token;
      }
    } catch (err) {
      console.error('[PushNotifications] Error getting Web FCM token:', err);
    }
    return null;
  }

  private handleIncomingWebMessage(payload: any): void {
    const title = payload.notification?.title || payload.data?.title || 'SSA Sales Hub';
    const body = payload.notification?.body || payload.data?.body || '';
    const data = payload.data || {};

    // 1. Show In-App Banner
    if (data.type === 'CHAT' || data.route === '/chat') {
      import('./banner/notificationBannerService').then((m) => {
        m.default.show({
          title: title || 'New Chat Message',
          description: body || 'You received a new message in Team Chat',
          type: 'CHAT',
          timestamp: 'now',
          url: '/chat',
        });
      }).catch(() => {});
    }

    // 2. Add to internal notifications inbox
    import('./reminderNotificationService').then((m) => {
      m.default.addNotification({
        userId: data.userId || 'current',
        title: title,
        message: body,
        type: (data.type as any) || 'SYSTEM',
        referenceId: data.referenceId || data.leadId || data.eventId,
        referenceType: data.referenceType || (data.leadId ? 'LEAD' : 'EVENT'),
      });
    }).catch(() => {});

    // 3. Native browser desktop notification (visible even when user is on another tab/window)
    if (Notification.permission === 'granted') {
      try {
        const desktopNotif = new Notification(title, {
          body: body,
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: data,
        });
        desktopNotif.onclick = () => {
          window.focus();
          desktopNotif.close();
          const target = resolveNotificationTarget({
            type: data.type,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            leadId: data.leadId,
            eventId: data.eventId,
            route: data.route,
            url: data.url,
            title,
            message: body,
          });
          window.dispatchEvent(
            new CustomEvent('ssa_navigate_to', {
              detail: {
                path: target?.path || '/notifications',
                state: { fromNotification: true, searchName: target?.searchName },
              },
            })
          );
        };
      } catch (e) {
        console.warn('[PushNotifications] Browser Notification API warning:', e);
      }
    }

    // 4. Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('ssa_push_notification_received', { detail: payload })
    );
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;


