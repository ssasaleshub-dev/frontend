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
 * Detects whether a string is an academic score / CGPA / percentage rather than a monetary budget.
 * (e.g. "65-75%_(6.5-7.5_cgpa)", "75%", "8.5 CGPA", "6.5-7.5 cgpa").
 */
export function isAcademicScore(val?: string | null): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'not specified' || s === 'null' || s === 'undefined') return false;
  // If it contains % or cgpa or gpa or marks or score
  if (/%|cgpa|gpa|percent|marks?|grade/i.test(s)) return true;
  // Range pattern like 6.5-7.5 or 60-70 without currency signs
  if (/^\d{1,2}(?:\.\d+)?\s*[-–—]\s*\d{1,2}(?:\.\d+)?\s*(?:cgpa|gpa|%)?$/i.test(s)) return true;
  return false;
}

/**
 * Cleans academic score strings for human-readable display.
 * e.g. "65-75%_(6.5-7.5_cgpa)" -> "65–75% (6.5–7.5 CGPA)"
 */
export function formatAcademicScore(val?: string | null): string {
  if (!val) return '';
  let s = String(val).trim();
  if (!s || s === '—' || s === '-' || s.toLowerCase() === 'not specified' || s.toLowerCase() === 'null') return '';
  // Replace underscores with spaces
  s = s.replace(/_/g, ' ');
  // Normalize double spaces
  s = s.replace(/\s+/g, ' ');
  // Standardize hyphens between numbers: e.g. "65-75" -> "65–75"
  s = s.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
  // Capitalize CGPA / GPA acronyms
  s = s.replace(/\bcgpa\b/gi, 'CGPA').replace(/\bgpa\b/gi, 'GPA');
  return s;
}

/**
 * Normalizes and formats currency strings with a single Indian Rupee (₹) symbol.
 * Eliminates duplicate or redundant symbols (e.g., "₹₹50K" -> "₹50K", "Rs. 50K" -> "₹50K").
 * Rejects academic scores (percentages/CGPAs) so they are never presented as budgets.
 */
export function formatCurrencyDisplay(val?: string | null): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'not specified' || trimmed.toLowerCase() === 'null') {
    return '';
  }
  // If this string represents an academic score or percentage, it is NOT a monetary budget!
  if (isAcademicScore(trimmed)) {
    return '';
  }
  // Strip duplicate or leading rupee signs, spaces, or currency keywords like "Rs.", "INR"
  const cleaned = trimmed.replace(/^[₹\sRs\.INRinr]+/i, '').trim();
  if (!cleaned) return '';
  return `₹${cleaned}`;
}


