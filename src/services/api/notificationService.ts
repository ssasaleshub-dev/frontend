import axiosClient from './axiosClient';

export type EventType = 'REMINDER' | 'EVENT' | 'CALL' | 'INTERVIEW' | 'FOLLOWUP' | 'HOLIDAY';
export type EventPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NotificationType = 'REMINDER' | 'LEAD_ASSIGNED' | 'STATUS_CHANGE' | 'SYSTEM';

export interface CalendarEventDTO {
  id: string;
  userId: string;
  title: string;
  description?: string;
  eventDate: string; // YYYY-MM-DD
  eventTime?: string; // HH:mm
  eventType: EventType;
  priority: EventPriority;
  candidateId?: string | number;
  candidateName?: string;
  isCompleted: boolean;
  notificationSent: boolean;
  remindBeforeMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: 'EVENT' | 'LEAD';
  isRead: boolean;
  createdAt: string;
  scheduledFor?: string;
}

/**
 * Enterprise Internal Notification & Reminder API Service (MNC Standard)
 * Full dynamic REST integration for SSA internal notification & reminder engine.
 */
export const notificationApiService = {
  // --- Calendar Events & Reminders ---
  getEvents: async (params?: { month?: number; year?: number }): Promise<CalendarEventDTO[]> => {
    return axiosClient.get('/api/events', { params });
  },

  getEventById: async (id: string): Promise<CalendarEventDTO> => {
    return axiosClient.get(`/api/events/${id}`);
  },

  createEvent: async (eventData: Partial<CalendarEventDTO>): Promise<CalendarEventDTO> => {
    return axiosClient.post('/api/events', eventData);
  },

  updateEvent: async (id: string, updates: Partial<CalendarEventDTO>): Promise<CalendarEventDTO> => {
    return axiosClient.put(`/api/events/${id}`, updates);
  },

  toggleEventComplete: async (id: string): Promise<CalendarEventDTO> => {
    return axiosClient.patch(`/api/events/${id}/toggle-complete`);
  },

  deleteEvent: async (id: string): Promise<any> => {
    return axiosClient.delete(`/api/events/${id}`);
  },

  // --- Internal Notifications Inbox ---
  getNotifications: async (): Promise<NotificationDTO[]> => {
    return axiosClient.get('/api/notifications');
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    return axiosClient.get('/api/notifications/unread-count');
  },

  markAsRead: async (id: string): Promise<any> => {
    return axiosClient.patch(`/api/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<any> => {
    return axiosClient.patch('/api/notifications/read-all');
  },

  deleteNotification: async (id: string): Promise<any> => {
    return axiosClient.delete(`/api/notifications/${id}`);
  },

  clearAllNotifications: async (): Promise<any> => {
    return axiosClient.delete('/api/notifications');
  },
};

export default notificationApiService;
