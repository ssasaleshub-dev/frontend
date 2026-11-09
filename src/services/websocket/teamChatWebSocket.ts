/**
 * Team Chat Real-Time Client (Spring WebFlux WebSocket + SSE Stream)
 *
 * Provides real-time bi-directional messaging, typing telemetry, and instant message delivery
 * like WhatsApp. Connects to Spring WebFlux WebSocket (/api/ws/chat) with automatic fallback
 * to Server-Sent Events (SSE) stream (/api/messages/stream) and auto-reconnect.
 */

import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '../../config/constants';
import type { ChatMessage } from '../../types';

export interface ChatWsMessagePayload {
  content: string;
  channel?: string;
  recipientId?: number;
  userId?: number;
  userName?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
}

type MessageCallback = (message: ChatMessage) => void;
type TypingCallback = (data: { userId: number; userName: string; channel: string; isTyping: boolean }) => void;
type AckCallback = (data: { messageId: number; status: string; message: ChatMessage }) => void;
type StatusCallback = (isConnected: boolean) => void;

class TeamChatWebSocket {
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private wsUrl: string = '';
  private sseUrl: string = '';
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;
  private pendingQueue: any[] = [];
  private currentUser: any = null;
  private seenMessageIds: Set<string | number> = new Set();

  private messageListeners: Set<MessageCallback> = new Set();
  private typingListeners: Set<TypingCallback> = new Set();
  private ackListeners: Set<AckCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();

  constructor() {
    this.computeEndpoints();
  }

  /**
   * Resolves the WebSocket and SSE stream endpoints dynamically based on environment
   */
  private computeEndpoints(): void {
    const envWsUrl = (import.meta as any).env?.VITE_CHAT_WS_URL;
    const baseApi = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    // 1. Resolve SSE Stream Endpoint (HTTPS/HTTP)
    if (baseApi && baseApi.startsWith('http')) {
      this.sseUrl = `${baseApi.replace(/\/$/, '')}/api/messages/stream`;
    } else {
      this.sseUrl = '/api/messages/stream';
    }

    // 2. Resolve WebSocket Endpoint (WSS/WS)
    if (envWsUrl) {
      this.wsUrl = envWsUrl;
      return;
    }

    if (Capacitor.isNativePlatform()) {
      // Mobile app running on Android / iOS
      const host = baseApi ? baseApi.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'ssasaleshub.cloud';
      const isHttps = !baseApi.startsWith('http://');
      this.wsUrl = `${isHttps ? 'wss:' : 'ws:'}//${host}/api/ws/chat`;
      return;
    }

    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

      if (isLocalhost) {
        // Local dev: connect to Spring backend on 8080
        this.wsUrl = 'ws://localhost:8080/api/ws/chat';
      } else {
        // Production web browser: route through Cloudflare /api/ws/chat
        this.wsUrl = `${wsProtocol}//${host}/api/ws/chat`;
      }
    } else {
      this.wsUrl = 'wss://ssasaleshub.cloud/api/ws/chat';
    }
  }

  /**
   * Initializes real-time connectivity via WebSocket + SSE fallback
   */
  public connect(user?: any): void {
    if (user) this.currentUser = user;

    // Connect WebSocket
    this.connectWs();

    // Connect SSE stream in parallel for guaranteed real-time delivery
    this.connectSSE();
  }

  private connectWs(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`[TeamChatWebSocket] 🟢 Live WebSocket connected: ${this.wsUrl}`);
        this.notifyStatus(true);

        if (this.currentUser) {
          this.authenticate(this.currentUser);
        }

        while (this.pendingQueue.length > 0) {
          const item = this.pendingQueue.shift();
          this.sendRaw(item);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          this.handleFrame(frame);
        } catch (err) {
          console.debug('[TeamChatWebSocket] Ignored unparsed frame');
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.debug('[TeamChatWebSocket] Connection notice:', err);
        this.isConnected = false;
      };
    } catch (err) {
      console.debug('[TeamChatWebSocket] WS Init Exception:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Connects to Server-Sent Events (SSE) stream for reliable real-time push over HTTPS
   */
  private connectSSE(): void {
    if (typeof window === 'undefined' || !window.EventSource) return;
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) return;

    try {
      this.eventSource = new EventSource(this.sseUrl);

      this.eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.id || data.content)) {
            this.dispatchIncomingMessage(data);
          }
        } catch {
          // ignore keepalive/ping frame
        }
      });

      this.eventSource.onerror = () => {
        // EventSource will automatically retry in the background
        console.debug('[TeamChatSSE] SSE reconnecting in background...');
      };
    } catch (err) {
      console.debug('[TeamChatSSE] SSE Init Notice:', err);
    }
  }

  private handleFrame(frame: any): void {
    const { event, message, messageId, status, ...rest } = frame;

    switch (event) {
      case 'NEW_MESSAGE':
        if (message) {
          this.dispatchIncomingMessage(message);
        }
        break;

      case 'MESSAGE_ACK':
        for (const listener of this.ackListeners) {
          try {
            listener({ messageId, status, message });
          } catch (e) {
            console.error(e);
          }
        }
        break;

      case 'USER_TYPING':
        for (const listener of this.typingListeners) {
          try {
            listener(rest as any);
          } catch (e) {
            console.error(e);
          }
        }
        break;

      case 'CONNECTED':
      case 'AUTHENTICATED':
        console.log(`[TeamChatWebSocket] Handshake OK (${event})`);
        break;

      default:
        break;
    }
  }

  /**
   * Deduplicates and delivers incoming messages to registered listeners
   */
  private dispatchIncomingMessage(msg: ChatMessage): void {
    if (!msg) return;

    if (msg.id != null) {
      const key = `${msg.id}`;
      if (this.seenMessageIds.has(key)) return;
      this.seenMessageIds.add(key);

      // Keep cache size bounded
      if (this.seenMessageIds.size > 1000) {
        const first = this.seenMessageIds.values().next().value;
        if (first !== undefined) this.seenMessageIds.delete(first);
      }
    }

    for (const listener of this.messageListeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error('[TeamChatWebSocket] Error in message listener:', err);
      }
    }
  }

  public authenticate(user: any): void {
    this.currentUser = user;
    this.sendRaw({
      event: 'AUTHENTICATE',
      payload: {
        userId: user.id || 1,
        userLogin: user.login || 'user',
        userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.login || 'Staff',
      },
    });
  }

  public joinChannel(channel: string): void {
    this.sendRaw({
      event: 'JOIN_CHANNEL',
      payload: { channel },
    });
  }

  public sendMessage(payload: ChatWsMessagePayload): void {
    this.sendRaw({
      event: 'SEND_MESSAGE',
      payload,
    });
  }

  public sendTyping(channel: string, recipientId?: number, isTyping: boolean = true): void {
    this.sendRaw({
      event: 'TYPING',
      payload: { channel, recipientId, isTyping },
    });
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onTyping(callback: TypingCallback): () => void {
    this.typingListeners.add(callback);
    return () => this.typingListeners.delete(callback);
  }

  public onMessageAck(callback: AckCallback): () => void {
    this.ackListeners.add(callback);
    return () => this.ackListeners.delete(callback);
  }

  public onStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  private sendRaw(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.pendingQueue.push(data);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, delay);
  }

  private notifyStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      try {
        listener(connected);
      } catch (e) {
        console.error(e);
      }
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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }
}

export const teamChatWebSocket = new TeamChatWebSocket();
export default teamChatWebSocket;
