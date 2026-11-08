/**
 * Notification WebSocket Client (SSA Microservices)
 *
 * Dedicated WebSocket client communicating directly with the `notification-service`
 * microservice (port 8086). Listens for real-time alerts, candidate reminders,
 * callback deadlines, and triggers the Apple HIG Notification Banner popup.
 */

import notificationBannerService from '../banner/notificationBannerService';
import reminderNotificationService from '../reminderNotificationService';

export interface WsNotificationPayload {
  id: string;
  title: string;
  description: string;
  type?: 'CHAT' | 'REMINDER' | 'CALL' | 'LEAD' | 'MILESTONE' | 'ATTENDANCE' | 'SYSTEM';
  referenceId?: string | number;
  referenceType?: string;
  url?: string;
  timestamp?: string;
  createdAt?: string;
  priority?: string;
}

type NotificationCallback = (notification: WsNotificationPayload) => void;
type StatusCallback = (isConnected: boolean) => void;

class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;
  private currentUser: any = null;

  private notificationListeners: Set<NotificationCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();

  constructor() {
    const envUrl = (import.meta as any).env?.VITE_NOTIF_WS_URL;
    if (envUrl) {
      this.url = envUrl;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      this.url = `${protocol}//${host}:8086`;
    } else {
      this.url = 'ws://localhost:8086';
    }
  }

  public connect(user?: any): void {
    if (user) this.currentUser = user;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`[NotificationWebSocket] Connected to microservice: ${this.url}`);
        this.notifyStatus(true);

        if (this.currentUser) {
          this.authenticate(this.currentUser);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          this.handleFrame(frame);
        } catch (err) {
          console.error('[NotificationWebSocket] Error parsing frame:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[NotificationWebSocket] Warning/error:', err);
      };
    } catch (err) {
      console.warn('[NotificationWebSocket] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private handleFrame(frame: any): void {
    const { event, data } = frame;

    if (event === 'NOTIFICATION' && data) {
      console.log('[NotificationWebSocket] Incoming notification frame:', data);

      // 1. Trigger Apple HIG in-app notification popup banner on the web app!
      notificationBannerService.show({
        id: data.id,
        title: data.title,
        description: data.description,
        type: data.type || 'SYSTEM',
        timestamp: data.timestamp || 'now',
        url: data.url,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      });

      // 2. Add to cached notification history in the notification bell
      reminderNotificationService.fetchNotifications().catch(() => {});

      // 3. Notify subscribers
      for (const listener of this.notificationListeners) {
        listener(data);
      }
    }
  }

  public authenticate(user: any): void {
    this.currentUser = user;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          event: 'AUTHENTICATE',
          payload: {
            userId: user.id || 1,
            userLogin: user.login || 'user',
            role: user.authorities?.[0] || 'STAFF',
          },
        })
      );
    }
  }

  public onNotification(callback: NotificationCallback): () => void {
    this.notificationListeners.add(callback);
    return () => this.notificationListeners.delete(callback);
  }

  public onStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[NotificationWebSocket] Max reconnect attempts reached.');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private notifyStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      listener(connected);
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const notificationWebSocket = new NotificationWebSocket();
export default notificationWebSocket;

