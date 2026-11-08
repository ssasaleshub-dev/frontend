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
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      this.url = isLocalhost
        ? `ws://localhost:8086`
        : `${wsProtocol}//${host}/ws/notifications`;
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
        console.log(`[NotificationWebSocket] 🟢 Pure WebSocket connected: ${this.url}`);
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
        console.warn('[NotificationWebSocket] WebSocket status:', err);
      };
    } catch (err) {
      console.warn('[NotificationWebSocket] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private handleFrame(frame: any): void {
    const { event, data } = frame;

    if (event === 'NOTIFICATION' && data) {
      // Never display another user's private notification
      const targetUser = data.targetUserId || data.targetUserLogin || data.userId;
      const currentLogin = this.currentUser?.login;
      if (targetUser && currentLogin && String(targetUser).toLowerCase() !== currentLogin.toLowerCase() && currentLogin !== 'admin') {
        return;
      }

      console.log('[NotificationWebSocket] 📨 Pure WebSocket notification received:', data);

      // 1. Add directly to cached notification history in memory & localStorage (zero HTTP API polling!)
      const notifItem = {
        id: data.id || `ws-${Date.now()}`,
        userId: targetUser ? String(targetUser) : undefined,
        title: data.title || 'Notification',
        message: data.description || '',
        type: data.type || 'SYSTEM',
        isRead: false,
        createdAt: data.createdAt || new Date().toISOString(),
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        url: data.url,
      };
      reminderNotificationService.addIncomingNotification(notifItem);

      // 2. Trigger Apple HIG in-app notification popup banner on the web app!
      notificationBannerService.show({
        id: notifItem.id,
        title: (data.title || 'Notification').replace(/^🔔\s*/, ''),
        description: data.description || '',
        type: data.type || 'SYSTEM',
        timestamp: data.timestamp || 'now',
        url: data.url,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      });

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

