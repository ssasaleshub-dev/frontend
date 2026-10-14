import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';
import type { ChatMessage } from '../../types';

export const chatService = {
  getMessages: (channel: string = 'general'): Promise<ChatMessage[]> =>
    axiosClient.get(API_ENDPOINTS.MESSAGES, { params: { channel } }),

  getMessageById: (id: string | number): Promise<ChatMessage> =>
    axiosClient.get(`${API_ENDPOINTS.MESSAGES}/${id}`),

  sendMessage: ({
    content,
    channel = 'general',
    userId = 1,
    userName,
  }: {
    content: string;
    channel?: string;
    userId?: number | string;
    userName?: string;
  }): Promise<ChatMessage> =>
    axiosClient.post(API_ENDPOINTS.MESSAGES, {
      content,
      channel,
      userId,
      userName,
    }),

  deleteMessage: (id: string | number): Promise<any> =>
    axiosClient.delete(`${API_ENDPOINTS.MESSAGES}/${id}`),
};

export default chatService;
