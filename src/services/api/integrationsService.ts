import axiosClient from './axiosClient';

export interface GoogleIntegrationStatus {
  connected: boolean;
  email?: string;
  googleEmail?: string;
  displayName?: string;
  avatarUrl?: string;
  connectedAt?: string;
}

export interface GoogleAuthUrlResponse {
  url: string;
}

export interface GoogleAuthResult {
  url: string;
  hasClientId: boolean;
  rawUrl: string;
}

export interface InstagramIntegrationStatus {
  configured: boolean;
  webhookUrl: string;
  cachedProfilesCount?: number;
}

export interface SendInstagramPayload {
  recipientId: string;
  message: string;
  leadId?: number;
}

export interface SendTestEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface GoogleSheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface GoogleSheetPreview {
  spreadsheetId: string;
  title?: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export const DEFAULT_GOOGLE_CLIENT_ID = '644951238009-bgnaql1piqh8if8u80qgrvmo4vf0ko85.apps.googleusercontent.com';

export const integrationsService = {
  /**
   * Check connection status of Google Workspace integration
   */
  async getGoogleStatus(): Promise<GoogleIntegrationStatus> {
    try {
      const res = await axiosClient.get<GoogleIntegrationStatus>('/api/integrations/google/status');
      return res || { connected: false };
    } catch (err) {
      console.warn('Failed to fetch Google integration status:', err);
      return { connected: false };
    }
  },

  /**
   * Exchange OAuth code for tokens (OAuth callback handler)
   */
  async exchangeGoogleCode(code: string): Promise<any> {
    return await axiosClient.post('/api/integrations/google/exchange-code', { code });
  },

  /**
   * Instantly generate and schedule a Google Meet consultation link
   */
  async createGoogleMeet(
    title: string = 'Client Consultation',
    options?: { description?: string; startTime?: string; endTime?: string }
  ): Promise<{ meetUrl?: string; eventId?: string; url?: string; hangoutsLink?: string }> {
    const res = await axiosClient.post('/api/integrations/google/meet', {
      title,
      ...(options?.description ? { description: options.description } : {}),
      ...(options?.startTime ? { startTime: options.startTime } : {}),
      ...(options?.endTime ? { endTime: options.endTime } : {}),
    });
    return res;
  },

  /**
   * Send email using connected Gmail account
   */
  async sendTestEmail(payload: SendTestEmailPayload): Promise<any> {
    return await axiosClient.post('/api/integrations/google/send', payload);
  },

  /**
   * Check connection status of Instagram DM integration
   */
  async getInstagramStatus(): Promise<InstagramIntegrationStatus> {
    try {
      const res = await axiosClient.get<InstagramIntegrationStatus>('/api/integrations/instagram/status');
      return (
        res || {
          configured: true,
          webhookUrl: 'https://ssasaleshub.cloud/api/webhooks/instagram',
          cachedProfilesCount: 0,
        }
      );
    } catch {
      return {
        configured: true,
        webhookUrl: 'https://ssasaleshub.cloud/api/webhooks/instagram',
        cachedProfilesCount: 0,
      };
    }
  },

  /**
   * Send outbound Instagram DM reply
   */
  async sendInstagramMessage(payload: SendInstagramPayload): Promise<any> {
    const res: any = await axiosClient.post('/api/integrations/instagram/send-message', payload);
    if (res && res.success === false) {
      throw new Error(res.errorMessage || res.error || res.message || 'Failed to send Instagram DM.');
    }
    return res;
  },

  /**
   * Get Google OAuth authorization URL to initiate account connection
   * Safeguards against empty client_id by checking configured client_id or local storage
   */
  async getGoogleAuthUrl(overrideClientId?: string): Promise<GoogleAuthResult> {
    const res = await axiosClient.get<GoogleAuthUrlResponse>('/api/integrations/google/auth-url');
    if (!res?.url) {
      throw new Error('Backend did not return an authorization URL');
    }

    try {
      const parsed = new URL(res.url);
      const urlClientId = parsed.searchParams.get('client_id');
      const backendHasClientId = Boolean(urlClientId && urlClientId.trim().length > 0);

      const effectiveClientId =
        overrideClientId?.trim() ||
        (backendHasClientId ? urlClientId : '') ||
        ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '').trim() ||
        (localStorage.getItem('ssa_google_client_id') || '').trim() ||
        DEFAULT_GOOGLE_CLIENT_ID;

      if (effectiveClientId) {
        parsed.searchParams.set('client_id', effectiveClientId);
      }

      return {
        url: parsed.toString(),
        hasClientId: Boolean(effectiveClientId && effectiveClientId.length > 5),
        rawUrl: res.url,
      };
    } catch {
      return {
        url: res.url,
        hasClientId: false,
        rawUrl: res.url,
      };
    }
  },

  /**
   * List user's Google Sheets (import-only)
   */
  async listGoogleSheets(): Promise<GoogleSheetItem[]> {
    const res = await axiosClient.get<GoogleSheetItem[] | { sheets?: GoogleSheetItem[] }>('/api/integrations/google/sheets');
    if (Array.isArray(res)) return res;
    return res?.sheets || [];
  },

  /**
   * Preview rows from a selected Google Sheet before importing
   */
  async previewGoogleSheet(spreadsheetId: string): Promise<GoogleSheetPreview> {
    return await axiosClient.get<GoogleSheetPreview>(`/api/integrations/google/sheets/${encodeURIComponent(spreadsheetId)}/preview`);
  },

  /**
   * Import verified rows from a selected Google Sheet
   */
  async importGoogleSheet(spreadsheetId: string): Promise<{ importedCount: number; leadIds: number[] }> {
    return await axiosClient.post<{ importedCount: number; leadIds: number[] }>(
      `/api/integrations/google/sheets/${encodeURIComponent(spreadsheetId)}/import`
    );
  },

  /**
   * Revert a previous Google Sheet import by deleting its imported lead IDs
   */
  async revertGoogleSheetImport(leadIds: number[]): Promise<void> {
    await Promise.all(leadIds.map((id) => axiosClient.delete(`/api/leads/${id}`)));
  },

  /**
   * Disconnect Google account
   */
  async disconnectGoogle(): Promise<boolean> {
    await axiosClient.post('/api/integrations/google/disconnect');
    return true;
  },
};

export default integrationsService;
