import axiosClient from './axiosClient';

export interface GoogleIntegrationStatus {
  connected: boolean;
  googleEmail?: string;
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
