/**
 * Team Chat WebSocket Client (SSA Microservices)
 *
 * Dedicated WebSocket client communicating directly with the `team-chat-service`
 * microservice (port 8085). Handles real-time message streaming, typing status,
 * delivery ACKs, and auto-reconnect.
 */

import { ChatMessage } from '../../types';

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
  private url: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;
  private pendingQueue: any[] = [];
  private currentUser: any = null;

  private messageListeners: Set<MessageCallback> = new Set();
  private typingListeners: Set<TypingCallback> = new Set();
  private ackListeners: Set<AckCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();

  constructor() {
    // Read from env or default to dedicated microservice port 8085
    const envUrl = (import.meta as any).env?.VITE_CHAT_WS_URL;
    if (envUrl) {
      this.url = envUrl;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      this.url = `${protocol}//${host}:8085`;
    } else {
      this.url = 'ws://localhost:8085';
    }
  }

  /**
   * Initializes the WebSocket connection with the Team Chat microservice
   */
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
        console.log(`[TeamChatWebSocket] Connected to microservice: ${this.url}`);
        this.notifyStatus(true);

        // Authenticate session
        if (this.currentUser) {
          this.authenticate(this.currentUser);
        }

        // Flush offline queue
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
          console.error('[TeamChatWebSocket] Error parsing frame:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[TeamChatWebSocket] WebSocket warning/error:', err);
      };
    } catch (err) {
      console.warn('[TeamChatWebSocket] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private handleFrame(frame: any): void {
    const { event, message, messageId, status, ...rest } = frame;

    switch (event) {
      case 'NEW_MESSAGE':
        if (message) {
          for (const listener of this.messageListeners) {
            listener(message);
          }
        }
        break;

      case 'MESSAGE_ACK':
        for (const listener of this.ackListeners) {
          listener({ messageId, status, message });
        }
        break;

      case 'USER_TYPING':
        for (const listener of this.typingListeners) {
          listener(rest as any);
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
      console.warn('[TeamChatWebSocket] Max reconnect attempts reached.');
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

export const teamChatWebSocket = new TeamChatWebSocket();
export default teamChatWebSocket;

