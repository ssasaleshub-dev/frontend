/**
 * Counselor remarks storage helpers.
 *
 * The backend keeps all remarks in the lead's single `notes` text field, joined with " | ".
 * New entries are stored as "[YYYY-MM-DD HH:mm · author] text" (time in IST) so each remark keeps
 * its own date and author. Older entries without that prefix still parse, falling back to the
 * provided date/author.
 */

export interface RemarkEntry {
  note: string;
  date: string;
  author: string;
  /** The exact stored segment, used to rebuild the notes field without altering other entries. */
  raw: string;
}

const REMARK_SEPARATOR = ' | ';
const ENTRY_PREFIX = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · ([^\]]+)\]\s*([\s\S]*)$/;

/** The separator character can't appear inside a remark, or the entry would be split in two. */
export function sanitizeRemarkText(text: string): string {
  return text.replace(/\|/g, '/').trim();
}

function formatISTStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function buildRemarkEntry(text: string, author: string, date: Date = new Date()): string {
  const safeAuthor = (author || 'Counselor').replace(/[\]|]/g, '').trim() || 'Counselor';
  return `[${formatISTStamp(date)} · ${safeAuthor}] ${sanitizeRemarkText(text)}`;
}

/** Parses the notes field into entries, in stored order (oldest first). */
export function parseRemarks(
  notes: string | undefined | null,
  fallbackDate: string,
  fallbackAuthor: string
): RemarkEntry[] {
  if (!notes) return [];
  return notes
    .split(/\s*\|\s*/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(ENTRY_PREFIX);
      if (m) {
        return { note: m[4], date: `${m[1]}T${m[2]}:00+05:30`, author: m[3].trim(), raw };
      }
      return { note: raw, date: fallbackDate, author: fallbackAuthor, raw };
    });
}

/** Rebuilds the notes field from entries given in stored order. */
export function joinRemarks(entries: RemarkEntry[]): string {
  return entries.map((e) => e.raw).join(REMARK_SEPARATOR);
}
