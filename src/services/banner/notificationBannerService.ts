/**
 * Apple HIG In-App Notification Banner Service
 *
 * Implements Apple Human Interface Guidelines: Notifications (Banner Popups)
 * Manages active in-app banners, slide-down animations, auto-dismiss timers,
 * and user tap-through navigation.
 */

import { playIPhoneNotificationSound } from '../../utils/appleSound';

export interface AppleBannerPayload {
  id?: string;
  title: string;
  description: string;
  type?: 'CHAT' | 'REMINDER' | 'CALL' | 'LEAD' | 'MILESTONE' | 'ATTENDANCE' | 'SYSTEM';
  timestamp?: string; // e.g. "now"
  url?: string;
  referenceId?: string | number;
  referenceType?: string;
  icon?: string;
  onClick?: () => void;
  durationMs?: number; // default: 5000ms (5 seconds)
  playSound?: boolean;
}

type BannerListener = (banner: AppleBannerPayload | null) => void;

class NotificationBannerService {
  private currentBanner: AppleBannerPayload | null = null;
  private listeners: Set<BannerListener> = new Set();
  private dismissTimer: any = null;

  public subscribe(listener: BannerListener): () => void {
    this.listeners.add(listener);
    listener(this.currentBanner);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Triggers an Apple HIG Notification Popup Banner with iPhone chime and 5-second auto-hide
   */
  public show(payload: AppleBannerPayload): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    const duration = payload.durationMs ?? 5000;

    const banner: AppleBannerPayload = {
      id: payload.id || `banner_${Date.now()}`,
      title: payload.title,
      description: payload.description,
      type: payload.type || 'SYSTEM',
      timestamp: payload.timestamp || 'now',
      url: payload.url,
      referenceId: payload.referenceId,
      referenceType: payload.referenceType,
      icon: payload.icon,
      onClick: payload.onClick,
      durationMs: duration,
    };

    // Play authentic Apple iPhone notification sound
    if (payload.playSound !== false) {
      try {
        playIPhoneNotificationSound();
      } catch (e) {
        console.warn('[NotificationBannerService] Sound error:', e);
      }
    }

    this.currentBanner = banner;
    this.notify();

    // Auto dismiss strictly after 5 seconds
    this.dismissTimer = setTimeout(() => {
      this.dismiss();
    }, duration);
  }

  /**
   * Dismisses the active banner with an exit animation
   */
  public dismiss(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.currentBanner = null;
    this.notify();
  }

  public getCurrentBanner(): AppleBannerPayload | null {
    return this.currentBanner;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentBanner);
      } catch (err) {
        console.error('[NotificationBannerService] Listener error:', err);
      }
    }
  }
}

export const notificationBannerService = new NotificationBannerService();
export default notificationBannerService;

