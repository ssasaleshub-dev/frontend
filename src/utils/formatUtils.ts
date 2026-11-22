/**
 * Utility functions for currency and numerical formatting.
 */

export type LeadSourceLabelKind = 'campaign' | 'organic' | 'unmapped' | 'unknown';

export interface LeadSourceLabel {
  text: string;
  kind: LeadSourceLabelKind;
}

/**
 * Resolves what to show in the "Campaign Name" column so a blank value is never ambiguous.
 * A lead can have no campaign name for three different reasons, and each means something
 * different to a counselor:
 *  - `campaign`: a real campaign/ad is attached — show its name.
 *  - `organic`: Meta marked this lead `isOrganic: true` — it was never run through any ad,
 *    so there IS no campaign to show. This is expected, not missing data.
 *  - `unmapped`: stored `isOrganic: false` but no campaign/ad is linked. For leads saved before
 *    the tri-state fix this is ambiguous (false was the default for "not reported"); for newer
 *    leads it means Meta reported a paid lead without returning campaign details.
 *  - `unknown`: older or manually-created leads with no isOrganic flag recorded at all.
 */
export function getLeadSourceLabel(lead: { campaignName?: string | null; isOrganic?: boolean | null }): LeadSourceLabel {
  const campaign = (lead.campaignName || '').trim();
  if (campaign) {
    return { text: campaign, kind: 'campaign' };
  }
  if (lead.isOrganic === true) {
    return { text: 'Direct / Organic', kind: 'organic' };
  }
  if (lead.isOrganic === false) {
    return { text: 'Unattributed', kind: 'unmapped' };
  }
  return { text: '—', kind: 'unknown' };
}

/**
 * Normalizes and formats currency strings with a single Indian Rupee (₹) symbol.
 * Eliminates duplicate or redundant symbols (e.g., "₹₹50K" -> "₹50K", "Rs. 50K" -> "₹50K").
 */
export function formatCurrencyDisplay(val?: string | null): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'not specified') {
    return '';
  }
  // Strip duplicate or leading rupee signs, spaces, or currency keywords like "Rs.", "INR"
  const cleaned = trimmed.replace(/^[₹\sRs\.INRinr]+/i, '').trim();
  if (!cleaned) return '';
  return `₹${cleaned}`;
}

