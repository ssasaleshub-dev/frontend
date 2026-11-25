import { decryptLeadId, encryptLeadId } from './leadIdCrypto';

export interface NotificationNavigationInput {
  type?: string;
  referenceType?: string;
  referenceId?: string | number | null;
  url?: string | null;
  route?: string | null;
  leadId?: string | number | null;
  eventId?: string | number | null;
  title?: string | null;
  message?: string | null;
  description?: string | null;
}

export interface NotificationNavigationTarget {
  path: string;
  searchName?: string;
}

/**
 * Validates that a raw ID represents a real positive numeric lead ID
 * (or a valid encrypted `e_...` lead token) and returns the numeric ID.
 * Rejects batch IDs, UUIDs, comma-separated IDs, and arbitrary strings.
 */
export function resolveValidLeadId(rawId: string | number | undefined | null): number | null {
  if (rawId === undefined || rawId === null) return null;
  if (typeof rawId === 'number') {
    return Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  }
  const str = String(rawId).trim();
  if (!str) return null;

  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return Number.isSafeInteger(num) && num > 0 ? num : null;
  }

  if (str.startsWith('e_')) {
    const decrypted = decryptLeadId(str);
    return decrypted && decrypted > 0 ? decrypted : null;
  }

  return null;
}

/**
 * Extracts a candidate name when a notification is for a single lead
 * (e.g. "Batch of 1 leads: Sugasekar" or "New Lead Received: Sugasekar").
 * Returns null for multi-lead batches ("Batch of 4 leads: ...").
 */
export function extractSingleBatchLeadName(
  title?: string | null,
  message?: string | null
): string | null {
  const combined = [message, title].filter(Boolean).join('\n');
  if (!combined) return null;

  const batchOneMatch = combined.match(/batch\s+of\s+1\s+leads?\s*:\s*([^\n,|]+)/i);
  if (batchOneMatch?.[1]) {
    const name = batchOneMatch[1].trim();
    if (name && !/\band\s+\d+\s+more\b/i.test(name)) {
      return name;
    }
  }

  const singleLeadMatch = (title || '').match(/^new\s+lead\s+received\s*:\s*(.+)$/i);
  if (singleLeadMatch?.[1]) {
    const name = singleLeadMatch[1].trim();
    if (name) return name;
  }

  return null;
}

/**
 * Normalizes a `/leads/:id` or `/candidates/:id` URL so it always contains
 * a valid encrypted lead ID, or falls back to `/leads` if invalid.
 */
export function normalizeLeadUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const match = trimmed.match(/^\/(?:leads|candidates)\/([^/?#]+)(.*)$/i);
  if (!match) return trimmed;

  const [, token, rest] = match;
  const validId = resolveValidLeadId(token);
  if (!validId) {
    return '/leads';
  }
  return `/leads/${encryptLeadId(validId)}${rest || ''}`;
}

function resolveLeadFallback(
  title?: string | null,
  message?: string | null
): NotificationNavigationTarget {
  const singleName = extractSingleBatchLeadName(title, message);
  if (singleName) {
    return {
      path: `/leads?search=${encodeURIComponent(singleName)}`,
      searchName: singleName,
    };
  }
  return { path: '/leads' };
}

/**
 * Resolves the exact in-app route for any notification (inbox item, WebSocket payload,
 * in-app banner, or native/web push notification). Never produces an invalid `/leads/:id` URL.
 */
export function resolveNotificationTarget(
  item: NotificationNavigationInput
): NotificationNavigationTarget | null {
  const type = (item.type || '').toUpperCase();
  const refType = (item.referenceType || '').toUpperCase();
  const bodyText = item.message || item.description || '';
  const titleText = item.title || '';

  // 1. Explicit internal URL/route (validate `/leads/:id` tokens before navigating)
  const explicitUrl = item.url || item.route;
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim().startsWith('/')) {
    return { path: normalizeLeadUrl(explicitUrl) };
  }

  // 2. Chat & Attendance notifications
  if (type === 'CHAT' || refType === 'CHAT') {
    return { path: '/chat' };
  }
  if (type === 'ATTENDANCE' || type === 'ATTENDANCE_VERIFY' || refType === 'ATTENDANCE') {
    return { path: '/attendance' };
  }

  // 3. Calendar / Reminder / Event notifications
  if (
    type === 'REMINDER' ||
    refType === 'EVENT' ||
    (item.eventId && !item.leadId && refType !== 'LEAD')
  ) {
    return { path: '/calendar' };
  }

  // 4. Lead / Callback / Milestone notifications
  const isLeadType =
    refType === 'LEAD' ||
    type === 'LEAD' ||
    type === 'NEW_LEAD' ||
    type === 'LEAD_ASSIGNED' ||
    type === 'STATUS_CHANGE' ||
    type === 'MILESTONE' ||
    type === 'CALL' ||
    type.startsWith('CLOSING_MILESTONE_') ||
    Boolean(item.leadId);

  if (isLeadType) {
    const validLeadId = resolveValidLeadId(item.leadId ?? item.referenceId);
    if (validLeadId) {
      return { path: `/leads/${encryptLeadId(validLeadId)}` };
    }
    if (type === 'CALL' && /callback|calendar|reminder/i.test(`${titleText} ${bodyText}`)) {
      return { path: '/calendar' };
    }
    return resolveLeadFallback(titleText, bodyText);
  }

  // 5. Fallback for SYSTEM / generic notifications based on content
  const combined = `${titleText} ${bodyText}`.toLowerCase();
  if (/lead|candidate|batch of \d+/i.test(combined)) {
    const validLeadId = resolveValidLeadId(item.referenceId);
    if (validLeadId) {
      return { path: `/leads/${encryptLeadId(validLeadId)}` };
    }
    return resolveLeadFallback(titleText, bodyText);
  }
  if (/reminder|calendar|callback|follow-?up|interview|event/i.test(combined)) {
    return { path: '/calendar' };
  }
  if (/chat|message/i.test(combined)) {
    return { path: '/chat' };
  }
  if (/attendance|check-?in/i.test(combined)) {
    return { path: '/attendance' };
  }

  return null;
}
