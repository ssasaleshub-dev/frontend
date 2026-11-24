import axiosClient from './axiosClient';

export interface GoogleIntegrationStatus {
  connected: boolean;
  googleEmail?: string;
  connectedAt?: string;
}

export interface GoogleAuthUrlResponse {
  url: string;
}

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
   * Get Google OAuth authorization URL to initiate account connection
   */
  async getGoogleAuthUrl(): Promise<string> {
    const res = await axiosClient.get<GoogleAuthUrlResponse>('/api/integrations/google/auth-url');
    if (!res?.url) {
      throw new Error('Backend did not return an authorization URL');
    }
    return res.url;
  },

  /**
   * Disconnect Google account
   */
  async disconnectGoogle(): Promise<boolean> {
    try {
      await axiosClient.post('/api/integrations/google/disconnect');
      return true;
    } catch (err) {
      console.error('Failed to disconnect Google account:', err);
      throw err;
    }
  },
};

export default integrationsService;
