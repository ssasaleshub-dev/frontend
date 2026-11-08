/**
 * Unified Indian Standard Time (IST - Asia/Kolkata) & 12-Hour AM/PM Time Formatters
 *
 * Ensures all dates and times across web and native Android/iOS apps are consistently
 * formatted in Indian Standard Time (IST, UTC+5:30) using 12-hour AM/PM format.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Converts any time string (e.g. "23:02:00", "23:02", "09:30", "14:45:10") to 12-hour AM/PM format.
 * Examples:
 *   format12HourTime("23:02:00") => "11:02 PM"
 *   format12HourTime("23:02")    => "11:02 PM"
 *   format12HourTime("09:05")    => "9:05 AM"
 *   format12HourTime("00:00")    => "12:00 AM"
 *   format12HourTime("12:00")    => "12:00 PM"
 *   format12HourTime(null)       => "" (or fallback)
 */
export function format12HourTime(timeStr?: string | null, fallback: string = ''): string {
  if (!timeStr || typeof timeStr !== 'string') return fallback;
  const clean = timeStr.trim();
  if (!clean) return fallback;

  // If already in 12h format (contains AM or PM), normalize spacing and return
  if (/(am|pm)/i.test(clean)) return clean;

  const parts = clean.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 0 || isNaN(parts[0])) return clean;

  const rawHours = parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hours12 = rawHours % 12 || 12;
  const minutesStr = String(minutes).padStart(2, '0');

  return `${hours12}:${minutesStr} ${period}`;
}

/**
 * Formats a Date or ISO timestamp into 12-hour AM/PM time in IST (Asia/Kolkata).
 * Example: "11:02 PM" (or "11:02:30 PM" if includeSeconds is true)
 */
export function formatIndianTime(
  dateOrIso?: Date | string | number | null,
  options?: { includeSeconds?: boolean; fallback?: string }
): string {
  if (!dateOrIso) return options?.fallback ?? '—';
  try {
    const d =
      typeof dateOrIso === 'string' || typeof dateOrIso === 'number'
        ? new Date(dateOrIso)
        : dateOrIso;
    if (isNaN(d.getTime())) return options?.fallback ?? '—';

    return d.toLocaleTimeString('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      second: options?.includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
  } catch {
    return options?.fallback ?? '—';
  }
}

/**
 * Formats a Date or ISO timestamp into a full Indian Date + 12-hour AM/PM time in IST.
 * Example: "08 Nov 2026, 11:02 PM"
 */
export function formatIndianDateTime(
  dateOrIso?: Date | string | number | null,
  options?: { includeYear?: boolean; fallback?: string }
): string {
  if (!dateOrIso) return options?.fallback ?? '—';
  try {
    const d =
      typeof dateOrIso === 'string' || typeof dateOrIso === 'number'
        ? new Date(dateOrIso)
        : dateOrIso;
    if (isNaN(d.getTime())) return options?.fallback ?? '—';

    return d.toLocaleString('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: options?.includeYear !== false ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return options?.fallback ?? '—';
  }
}

/**
 * Formats a Date or ISO timestamp into Indian Date in IST.
 * Example: "8 Nov 2026"
 */
export function formatIndianDate(
  dateOrIso?: Date | string | number | null,
  options?: { weekday?: boolean; fallback?: string }
): string {
  if (!dateOrIso) return options?.fallback ?? '—';
  try {
    const d =
      typeof dateOrIso === 'string' || typeof dateOrIso === 'number'
        ? new Date(dateOrIso)
        : dateOrIso;
    if (isNaN(d.getTime())) return options?.fallback ?? '—';

    return d.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      weekday: options?.weekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return options?.fallback ?? '—';
  }
}

/**
 * Strips unwanted static boilerplate prefixes/suffixes from reminder messages
 * so that only user-entered data is displayed.
 */
export function cleanNotificationMessage(msg?: string, title?: string): string {
  if (!msg) return '';
  let cleaned = msg.trim();
  // Strip robotic boilerplate prefixes
  cleaned = cleaned.replace(/^Reminder for candidate\s*/i, '');
  cleaned = cleaned.replace(/^Reminder for\s*/i, '');
  cleaned = cleaned.replace(/^Candidate:\s*/i, '');
  // Strip trailing " (Scheduled for ...)" or " scheduled at ..." or " scheduled for ..."
  cleaned = cleaned.replace(/\s*\(Scheduled for[^)]*\)/i, '');
  cleaned = cleaned.replace(/\s*scheduled (at|for) \d{1,2}:\d{2}(\s*(AM|PM))?\.?/i, '');
  cleaned = cleaned.replace(/^Reminder scheduled for \d{1,2}:\d{2}(\s*(AM|PM))?\.?/i, '');
  cleaned = cleaned.replace(/^Scheduled for \d{1,2}:\d{2}(\s*(AM|PM))?\.?/i, '');
  cleaned = cleaned.trim();
  // If cleaned message is just a generic category name or identical to title, return empty string
  const lower = cleaned.toLowerCase();
  if (
    lower === 'reminder' ||
    lower === 'general reminder' ||
    lower === 'candidate callback' ||
    lower === 'callback' ||
    lower === 'follow-up' ||
    lower === 'followup' ||
    lower === 'event' ||
    lower === 'meeting' ||
    (title && lower === title.trim().toLowerCase())
  ) {
    return '';
  }
  return cleaned;
}


