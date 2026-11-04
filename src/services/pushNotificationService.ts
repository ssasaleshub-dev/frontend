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
import { LocalNotifications, ActionPerformed as LocalActionPerformed } from '@capacitor/local-notifications';
import axiosClient from './api/axiosClient';
import reminderNotificationService from './reminderNotificationService';
import { encryptLeadId } from '../utils/leadIdCrypto';

const FCM_TOKEN_STORAGE_KEY = 'ssa_fcm_token';

class PushNotificationService {
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!Capacitor.isNativePlatform()) {
      console.info('[PushNotifications] Web environment detected. Native FCM listeners skipped.');
      return;
    }

    try {
      this.isInitialized = true;
      console.info('[PushNotifications] Initializing Native Push & Local Notifications...');

      // 1. Create notification channels on Android 8.0+ first
      await this.createDefaultNotificationChannel();

      // 2. Request user permissions for Push Notifications
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      // 3. Request permissions for Local Notifications
      try {
        let localPerm = await LocalNotifications.checkPermissions();
        if (localPerm.display !== 'granted') {
          localPerm = await LocalNotifications.requestPermissions();
        }
      } catch (localErr) {
        console.warn('[PushNotifications] Local notifications permission check warning:', localErr);
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[PushNotifications] Push notification permission was not granted:', permStatus.receive);
      } else {
        // Register with Google FCM / Apple APNS
        await PushNotifications.register();
      }

      // 4. Listen for FCM registration token
      await PushNotifications.addListener('registration', (token: Token) => {
        console.info('[PushNotifications] FCM Device Token received:', token.value);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        this.syncTokenWithBackend(token.value);

        window.dispatchEvent(
          new CustomEvent('ssa_fcm_token_registered', { detail: { token: token.value } })
        );
      });

      // 5. Handle registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[PushNotifications] Error on registration:', error);
      });

      // 6. Handle foreground push notification received
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.info('[PushNotifications] Push received in foreground:', notification);

          // Add to internal notifications inbox & cache
          reminderNotificationService.addNotification({
            userId: notification.data?.userId || 'current',
            title: notification.title || 'SSA Notification',
            message: notification.body || '',
            type: (notification.data?.type as any) || 'SYSTEM',
            referenceId: notification.data?.referenceId || notification.data?.leadId || notification.data?.eventId,
            referenceType: notification.data?.referenceType || (notification.data?.leadId ? 'LEAD' : 'EVENT'),
          });

          // Dispatch UI notification event
          window.dispatchEvent(
            new CustomEvent('ssa_push_notification_received', { detail: notification })
          );
        }
      );

      // 7. Handle notification click / tap action (Foreground or Background)
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.info('[PushNotifications] Push notification action performed:', action);
          const data = action.notification.data || {};

          // Dispatch route navigation event for React Router
          if (data.leadId) {
            window.dispatchEvent(
              new CustomEvent('ssa_navigate_to', { detail: { path: `/leads/${encryptLeadId(data.leadId)}` } })
            );
          } else if (data.eventId) {
            window.dispatchEvent(
              new CustomEvent('ssa_navigate_to', { detail: { path: '/calendar' } })
            );
          } else if (data.route) {
            window.dispatchEvent(
              new CustomEvent('ssa_navigate_to', { detail: { path: data.route } })
            );
          }
        }
      );

      // 8. Handle Local Notification action tap (Navigates when user clicks native local alarm)
      try {
        await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (action: LocalActionPerformed) => {
            console.info('[PushNotifications] Local notification action performed:', action);
            const extra = action.notification.extra || {};
            if (extra.leadId) {
              window.dispatchEvent(
                new CustomEvent('ssa_navigate_to', { detail: { path: `/leads/${encryptLeadId(extra.leadId)}` } })
              );
            } else if (extra.eventId) {
              window.dispatchEvent(
                new CustomEvent('ssa_navigate_to', { detail: { path: '/calendar' } })
              );
            }
          }
        );
      } catch (localListenerErr) {
        console.warn('[PushNotifications] Local notification listener warning:', localListenerErr);
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
          importance: 5, // High importance (heads-up notification)
          visibility: 1,
          sound: 'default',
          vibration: true,
        };

        await PushNotifications.createChannel(channelConfig).catch(() => {});
        await LocalNotifications.createChannel(channelConfig).catch(() => {});
        console.info('[PushNotifications] Default notification channels created.');
      }
    } catch (e) {
      console.warn('[PushNotifications] Channel creation warning:', e);
    }
  }

  /**
   * Schedule Native Android Local Reminder Notification
   * Works offline & when app is closed via Android AlarmManager
   */
  public async scheduleLocalReminder(event: {
    id?: string;
    title: string;
    candidateName?: string;
    eventDate: string; // YYYY-MM-DD
    eventTime?: string; // HH:mm
    remindBeforeMinutes?: number;
    description?: string;
    candidateId?: string | number;
  }): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const timePart = event.eventTime || '09:00';
      const [hours, minutes] = timePart.split(':').map(Number);
      const parts = event.eventDate.split('-').map(Number);
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, 0, 0);

      const offsetMinutes = Number(event.remindBeforeMinutes) || 0;
      const triggerTime = new Date(targetDate.getTime() - offsetMinutes * 60 * 1000);
      const now = new Date();

      // Stable 32-bit integer ID for LocalNotifications
      let notifId = Math.floor(Math.random() * 1000000);
      if (event.id) {
        let hash = 0;
        for (let i = 0; i < event.id.length; i++) {
          hash = (hash << 5) - hash + event.id.charCodeAt(i);
          hash |= 0;
        }
        notifId = Math.abs(hash);
      }

      const candidateText = event.candidateName ? ` for ${event.candidateName}` : '';
      const dueBody = `Reminder: "${event.title}"${candidateText} scheduled at ${timePart}.`;

      const notificationsToSchedule: any[] = [];

      // 1. If triggerTime is in the future, schedule native alarm
      if (triggerTime.getTime() > now.getTime()) {
        notificationsToSchedule.push({
          id: notifId,
          title: `🔔 ${event.title}`,
          body: dueBody,
          channelId: 'fcm_default_channel',
          schedule: { at: triggerTime, allowWhileIdle: true },
          sound: 'default',
          extra: {
            leadId: event.candidateId,
            eventId: event.id,
          },
        });
        console.info('[PushNotifications] Native reminder alarm scheduled for:', triggerTime.toLocaleString());
      }

      // 2. Immediate heads-up push confirmation on Android device confirming reminder was set
      notificationsToSchedule.push({
        id: notifId + 1,
        title: `✅ Reminder Set: ${event.title}`,
        body: `Scheduled for ${event.eventDate} at ${timePart}${candidateText} (Alert active)`,
        channelId: 'fcm_default_channel',
        schedule: { at: new Date(Date.now() + 500) },
        sound: 'default',
        extra: {
          leadId: event.candidateId,
          eventId: event.id,
        },
      });

      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    } catch (err) {
      console.warn('[PushNotifications] Failed to schedule native local reminder:', err);
    }
  }

  /**
   * Cancel scheduled native reminder
   */
  public async cancelLocalReminder(id: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash |= 0;
      }
      const notifId = Math.abs(hash);
      await LocalNotifications.cancel({ notifications: [{ id: notifId }, { id: notifId + 1 }] });
    } catch {}
  }

  /**
   * Synchronize the FCM token with the backend server
   */
  public async syncTokenWithBackend(token: string, userId?: string): Promise<void> {
    try {
      const storedUser = localStorage.getItem('ssa_user');
      let currentUserId = userId;
      if (!currentUserId && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          currentUserId = parsed.login;
        } catch {}
      }

      const payload: any = {
        token,
        platform: Capacitor.getPlatform(),
        updatedAt: new Date().toISOString(),
      };
      if (currentUserId) {
        payload.userId = currentUserId;
      }

      // Try sending to standard backend FCM registration endpoint if available
      await axiosClient.post('/api/notifications/fcm-token', payload).catch(() => {
        // Fallback for custom backend routes
        return axiosClient.post('/api/account/fcm-token', payload);
      });
      console.info('[PushNotifications] FCM token successfully synced to backend for user:', currentUserId);
    } catch {
      // Backend may not have endpoint ready yet - silent fail gracefully
      console.warn('[PushNotifications] Backend token sync deferred until API endpoint available.');
    }
  }

  /**
   * Get cached FCM token
   */
  public getStoredToken(): string | null {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;

