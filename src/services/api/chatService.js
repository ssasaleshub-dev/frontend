import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';

export const chatService = {
  getMessages: (channel = 'general') =>
    axiosClient.get(API_ENDPOINTS.MESSAGES, { params: { channel } }),

  getMessageById: (id) =>
    axiosClient.get(`${API_ENDPOINTS.MESSAGES}/${id}`),

  sendMessage: ({ content, channel = 'general', userId = 1, userName }) =>
    axiosClient.post(API_ENDPOINTS.MESSAGES, {
      content,
      channel,
      userId,
      userName,
    }),

  deleteMessage: (id) =>
    axiosClient.delete(`${API_ENDPOINTS.MESSAGES}/${id}`),
};

export default chatService;
