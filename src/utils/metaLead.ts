/**
 * Helpers for displaying everything Meta sent for a lead: every Instant Form answer and the full
 * ad attribution chain (campaign → ad set → ad → form → page).
 */

export interface FormResponse {
  key: string;
  label: string;
  value: string;
}

export interface AttributionRow {
  label: string;
  value: string;
  /** Meta's own ID for this item (shown small, copyable). */
  metaId?: string;
  /** The row's value is the ID itself (don't show it twice). */
  idIsValue?: boolean;
}

/** Form answers stored as JSON on the lead; tolerant of missing/invalid data. */
export function parseFormResponses(json?: string | null): FormResponse[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.key === 'string')
      .map((r) => ({
        key: r.key,
        label: typeof r.label === 'string' && r.label ? r.label : humanizeKey(r.key),
        value: typeof r.value === 'string' ? r.value : String(r.value ?? ''),
      }))
      .filter((r) => r.value.trim() !== '');
  } catch {
    return [];
  }
}

// Meta export columns that describe the ad itself (stored in their own fields), not the candidate's answers
const ATTRIBUTION_COLUMNS = new Set([
  'id', 'lead_id', 'created_time', 'created_at', 'time', 'date',
  'ad_id', 'ad_name', 'adset_id', 'ad_set_id', 'adset_name', 'ad_set_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name',
  'is_organic', 'organic', 'platform', 'publisher_platform', 'lead_status', 'status',
]);

/**
 * Every answer column from one row of a Meta lead export (as read by SheetJS), in column order,
 * as the JSON stored on the lead. Returns undefined when there is nothing to keep.
 */
export function formResponsesFromSheetRow(row: Record<string, unknown>): string | undefined {
  const out: FormResponse[] = [];
  Object.keys(row || {}).forEach((key) => {
    const norm = key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!norm || norm.startsWith('__empty') || ATTRIBUTION_COLUMNS.has(norm)) return;
    const value = String(row[key] ?? '').trim();
    if (!value) return;
    out.push({ key: key.trim(), label: humanizeKey(key.trim()), value });
  });
  return out.length ? JSON.stringify(out) : undefined;
}

/** "what_is_your_current_status?" → "What is your current status?" */
export function humanizeKey(key: string): string {
  const text = (key || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * Meta answer codes are often snake_case option values ("completed_ug", "60-70%_/6.0-7.0_cgpa").
 * Show them readably without changing their meaning.
 */
export function humanizeAnswer(value: string): string {
  const text = (value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Leave emails, phone numbers and URLs untouched
  if (/@|^\+?\d[\d\s-]{6,}$|^https?:\/\//i.test(value.trim())) return value.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** How Meta classified the lead's origin. */
export function getOriginLabel(isOrganic?: boolean | null): { text: string; tone: 'organic' | 'paid' | 'unknown' } {
  if (isOrganic === true) return { text: 'Organic', tone: 'organic' };
  if (isOrganic === false) return { text: 'Paid ad', tone: 'paid' };
  return { text: 'Not reported', tone: 'unknown' };
}

const PLATFORM_NAMES: Record<string, string> = {
  IG: 'Instagram',
  FB: 'Facebook',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Direct / Walk-in',
};

/** The ad attribution chain for a lead, skipping rows Meta didn't provide. */
export function getAttributionRows(lead: Record<string, any>): AttributionRow[] {
  const rows: AttributionRow[] = [];
  const add = (label: string, value?: string | null, metaId?: string | null) => {
    const v = (value || '').toString().trim();
    const id = (metaId || '').toString().trim();
    if (!v && !id) return;
    rows.push({ label, value: v || '—', metaId: id || undefined });
  };

  add('Platform', PLATFORM_NAMES[lead.platform] || lead.platform);
  add('Origin', getOriginLabel(lead.isOrganic).text);
  add('Campaign', lead.campaignName, lead.campaignExternalId);
  add('Ad set', lead.adSetName, lead.adSetExternalId);
  add('Ad', lead.adName, lead.adExternalId);
  add('Lead form', lead.leadFormName, lead.leadFormExternalId);
  // For these two the ID *is* the value
  if (lead.metaPageId) rows.push({ label: 'Facebook Page ID', value: String(lead.metaPageId), metaId: String(lead.metaPageId), idIsValue: true });
  if (lead.externalId && !String(lead.externalId).startsWith('lead_') && !String(lead.externalId).startsWith('meta_')) {
    rows.push({ label: 'Meta lead ID', value: String(lead.externalId), metaId: String(lead.externalId), idIsValue: true });
  }
  return rows;
}
