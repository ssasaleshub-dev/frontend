/**
 * Apple HIG In-App Notification Banner Service
 *
 * Implements Apple Human Interface Guidelines: Notifications (Banner Popups)
 * Manages active in-app banners, slide-down animations, auto-dismiss timers,
 * and user tap-through navigation.
 */

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
  durationMs?: number; // default: 5000ms
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
   * Triggers an Apple HIG Notification Popup Banner
   */
  public show(payload: AppleBannerPayload): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

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
      durationMs: payload.durationMs ?? 5000,
    };

    this.currentBanner = banner;
    this.notify();

    // Auto dismiss after specified duration
    this.dismissTimer = setTimeout(() => {
      this.dismiss();
    }, banner.durationMs);
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
