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
import axiosClient from './api/axiosClient';
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
      console.info('[PushNotifications] Initializing Firebase Push Notifications...');

      // 1. Create notification channel on Android 8.0+ first
      await this.createDefaultNotificationChannel();

      // 2. Request user permissions for Push Notifications
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'granted') {
          permStatus = await PushNotifications.requestPermissions();
        }
      } catch (permErr) {
        console.warn('[PushNotifications] Permission check warning:', permErr);
      }

      // 3. Always register with Google FCM / Apple APNS to obtain device token
      try {
        await PushNotifications.register();
      } catch (regErr) {
        console.error('[PushNotifications] Error calling PushNotifications.register():', regErr);
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

          // Add to internal notifications inbox & cache (lazy loaded to prevent circular dependency)
          import('./reminderNotificationService')
            .then((m) => {
              m.default.addNotification({
                userId: notification.data?.userId || 'current',
                title: notification.title || 'SSA Notification',
                message: notification.body || '',
                type: (notification.data?.type as any) || 'SYSTEM',
                referenceId: notification.data?.referenceId || notification.data?.leadId || notification.data?.eventId,
                referenceType: notification.data?.referenceType || (notification.data?.leadId ? 'LEAD' : 'EVENT'),
              });
            })
            .catch(() => {});

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
          } else {
            window.dispatchEvent(
              new CustomEvent('ssa_navigate_to', { detail: { path: '/notifications' } })
            );
          }
        }
      );
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
          lights: true,
          lightColor: '#0071e3',
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

  /**
   * Synchronize the FCM token with the backend server
   */
  public async syncTokenWithBackend(token: string, userId?: string): Promise<void> {
    try {
      const storedUser = localStorage.getItem('ssa_user') || localStorage.getItem('user');
      let currentUserId = userId;
      if (!currentUserId && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          currentUserId = parsed.login || parsed.username;
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
        return axiosClient.post('/api/account/fcm-token', payload);
      });
      console.info('[PushNotifications] FCM token successfully synced to backend for user:', currentUserId);
    } catch {
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


