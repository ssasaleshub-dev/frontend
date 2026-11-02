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
      console.info('[PushNotifications] Initializing Native Push Notifications...');

      // 1. Request user permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[PushNotifications] Push notification permission was not granted:', permStatus.receive);
        return;
      }

      // 2. Register with Apple APNS / Google FCM
      await PushNotifications.register();

      // 3. Listen for FCM registration token
      await PushNotifications.addListener('registration', (token: Token) => {
        console.info('[PushNotifications] FCM Device Token received:', token.value);
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token.value);
        this.syncTokenWithBackend(token.value);

        window.dispatchEvent(
          new CustomEvent('ssa_fcm_token_registered', { detail: { token: token.value } })
        );
      });

      // 4. Handle registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[PushNotifications] Error on registration:', error);
      });

      // 5. Handle foreground notification received
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

      // 6. Handle notification click / tap action (Foreground or Background)
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

      // Create notification channel for Android 8.0+
      await this.createDefaultNotificationChannel();
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
        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'SSA CRM Alerts',
          description: 'General notifications and lead/reminder alerts for SSA CRM',
          importance: 5, // High importance (heads-up notification)
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
        console.info('[PushNotifications] Default notification channel created.');
      }
    } catch (e) {
      console.warn('[PushNotifications] Channel creation warning:', e);
    }
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

