/**
 * Utility functions for currency and numerical formatting.
 */

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

