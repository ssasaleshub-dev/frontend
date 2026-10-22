import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';
import type { ChatMessage } from '../../types';

export const chatService = {
  getMessages: (channel: string = 'general'): Promise<ChatMessage[]> =>
    axiosClient.get(API_ENDPOINTS.MESSAGES, { params: { channel } }),

  getP2pMessages: (otherUserId: string | number): Promise<ChatMessage[]> =>
    axiosClient.get(`${API_ENDPOINTS.MESSAGES_P2P}/${otherUserId}`),

  markP2pAsRead: (otherUserId: string | number): Promise<void> =>
    axiosClient.patch(`${API_ENDPOINTS.MESSAGES_P2P}/${otherUserId}/read`),

  getMessageById: (id: string | number): Promise<ChatMessage> =>
    axiosClient.get(`${API_ENDPOINTS.MESSAGES}/${id}`),

  sendMessage: (payload: {
    content?: string;
    channel?: string;
    userId?: number | string;
    userName?: string;
    recipientId?: number | string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'FILE' | string;
    fileName?: string;
    fileSize?: number;
  }): Promise<ChatMessage> =>
    axiosClient.post(API_ENDPOINTS.MESSAGES, payload),

  deleteMessage: (id: string | number): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.MESSAGES}/${id}`),
};

export default chatService;
