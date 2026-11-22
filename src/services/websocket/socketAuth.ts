import { STORAGE_KEYS } from '../../config/constants';

/**
 * WebSockets and EventSource can't send an Authorization header, so the backend accepts the
 * login JWT as the `access_token` query parameter on these connections only.
 */
export function getAuthToken(): string | null {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.ID_TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.TOKEN) ||
      localStorage.getItem('id_token')
    );
  } catch {
    return null;
  }
}

/** Returns the URL with the current token attached, or null when the user isn't logged in. */
export function withAccessToken(url: string): string | null {
  const token = getAuthToken();
  if (!token) return null;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}
