import React from 'react';

export interface BrandIconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

/**
 * SSA Brand Custom Activity & Audit Trail Icon
 * Replaces generic circular-arrow Lucide History icon.
 * Features an Apple HIG enterprise ledger with an embedded audit clock index.
 */
export const BrandActivityIcon: React.FC<BrandIconProps> = ({
  size = 16,
  className = '',
  strokeWidth = 1.75,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Dossier ledger boundary */}
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    {/* Audit record timeline entries */}
    <path d="M7.5 8h6M7.5 12h4" />
    {/* Chronological audit marker */}
    <circle cx="15.5" cy="14.5" r="3" />
    <path d="M15.5 13v1.5l1 1" />
  </svg>
);

/**
 * SSA Brand Marketing Origin & Lead Attribution Telemetry Icon
 * Replaces generic Android 3-node Share2 icon.
 * Features a precision attribution beacon with concentric broadcast rings and target core.
 */
export const BrandAttributionIcon: React.FC<BrandIconProps> = ({
  size = 14,
  className = '',
  strokeWidth = 1.75,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Inbound attribution core */}
    <circle cx="12" cy="12" r="3" />
    {/* Precision telemetry crosshairs */}
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" />
    {/* Outer source orbit */}
    <circle cx="12" cy="12" r="7.5" strokeDasharray="3.5 2.5" opacity="0.6" />
  </svg>
);

/**
 * SSA Brand Pipeline Won / Approved Icon
 * Replaces generic cartoon ThumbsUp icon.
 * Features an Apple HIG verified crest with a solid completion stroke.
 */
export const BrandWonIcon: React.FC<BrandIconProps> = ({
  size = 13,
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 5-5" />
  </svg>
);

/**
 * SSA Brand Pipeline Closed Lost Icon
 * Replaces generic cartoon ThumbsDown icon.
 * Features a minimalist Apple HIG dismissal circle.
 */
export const BrandLostIcon: React.FC<BrandIconProps> = ({
  size = 13,
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m14.5 9.5-5 5m0-5 5 5" />
  </svg>
);

/**
 * SSA Brand Candidate Dossier Icon
 * Replaces generic FileText or Briefcase.
 * Features an official passport / dossier portfolio with ribbon.
 */
export const BrandDossierIcon: React.FC<BrandIconProps> = ({
  size = 14,
  className = '',
  strokeWidth = 1.75,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M6 7h9M6 11h9M6 15h5" />
  </svg>
);

/**
 * SSA Brand Reminder & Alarm Icon
 * Bespoke clean Apple HIG notification bell with subtle soundwave arc.
 */
export const BrandReminderIcon: React.FC<BrandIconProps> = ({
  size = 14,
  className = '',
  strokeWidth = 1.75,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 9a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
