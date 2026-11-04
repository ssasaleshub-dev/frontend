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

/* ═══════════════════════════════════════════════════════════════
   SSA DASHBOARD KPI ICONS — Hand-coded, brand-exclusive SVGs.
   Each icon is purpose-built for its KPI metric context:
   visa, immigration, education, and achievement themes.
   Colors are applied via className (text-blue-600 etc.).
   ═══════════════════════════════════════════════════════════════ */

/**
 * KPI 1 — Total Candidates / All Inquiries
 * A stylised silhouette group with a rising inquiry arc above them —
 * represents a pool of people submitting applications.
 */
export const KpiCandidatesIcon: React.FC<BrandIconProps> = ({
  size = 18,
  className = '',
  strokeWidth = 1.6,
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
    {/* Centre person */}
    <circle cx="12" cy="7" r="3" />
    <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    {/* Left ghost silhouette */}
    <circle cx="5" cy="9" r="2.2" opacity="0.45" />
    <path d="M1.5 21v-.5a3.5 3.5 0 0 1 5-3.18" opacity="0.45" />
    {/* Right ghost silhouette */}
    <circle cx="19" cy="9" r="2.2" opacity="0.45" />
    <path d="M22.5 21v-.5a3.5 3.5 0 0 0-5-3.18" opacity="0.45" />
    {/* Rising arc — inquiry wave */}
    <path d="M9 3.5C9.8 2.5 11 2 12 2s2.2.5 3 1.5" strokeWidth="1.3" opacity="0.6" />
  </svg>
);

/**
 * KPI 2 — Work Visa Inquiries / Screened & Qualified
 * A hard-hat-free "overseas job permit" icon:
 * globe hemisphere + briefcase tab at top.
 * Conveys international employment placement.
 */
export const KpiWorkVisaIcon: React.FC<BrandIconProps> = ({
  size = 18,
  className = '',
  strokeWidth = 1.6,
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
    {/* Briefcase body */}
    <rect x="3" y="9" width="18" height="12" rx="2" />
    {/* Briefcase handle */}
    <path d="M8 9V7a4 4 0 0 1 8 0v2" />
    {/* Globe meridian overlay — world placement */}
    <path d="M3 14h18" />
    <path d="M12 9v12" strokeWidth="1.1" opacity="0.5" />
    {/* Permit stamp circle */}
    <circle cx="18.5" cy="18.5" r="3.5" fill="currentColor" fillOpacity="0.12" strokeWidth="1.2" />
    <path d="m17 18.5 1 1 2-2" strokeWidth="1.4" />
  </svg>
);

/**
 * KPI 3 — Study Visa Inquiries / Applications In Process
 * Open book with a graduation mortarboard cap sitting on top.
 * Immediately reads as "academic / university admission".
 */
export const KpiStudyVisaIcon: React.FC<BrandIconProps> = ({
  size = 18,
  className = '',
  strokeWidth = 1.6,
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
    {/* Book spine */}
    <path d="M12 20V8" />
    {/* Left page */}
    <path d="M4 20V8a2 2 0 0 1 2-2h6" />
    {/* Right page */}
    <path d="M20 20V8a2 2 0 0 0-2-2h-6" />
    {/* Book base */}
    <path d="M4 20h16" />
    {/* Mortarboard board */}
    <path d="M8 5.5 12 4l4 1.5" strokeWidth="1.5" />
    {/* Cap flat top */}
    <path d="M7 5.5h10" strokeWidth="1.3" />
    {/* Tassel drop */}
    <path d="M18 5.5v2.5" strokeWidth="1.3" opacity="0.6" />
    <circle cx="18" cy="8.5" r="0.8" fill="currentColor" strokeWidth="0" opacity="0.6" />
  </svg>
);

/**
 * KPI 4 — Enrolled / Visa Approved
 * A passport booklet with a bold check stamp on the cover.
 * Universally read as "approved / cleared / issued".
 */
export const KpiApprovedIcon: React.FC<BrandIconProps> = ({
  size = 18,
  className = '',
  strokeWidth = 1.6,
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
    {/* Passport cover */}
    <rect x="4" y="2" width="16" height="20" rx="2.5" />
    {/* Spine line */}
    <path d="M4 7h16" strokeWidth="1.2" opacity="0.4" />
    {/* Cover emblem circle */}
    <circle cx="12" cy="13" r="4.5" strokeWidth="1.3" />
    {/* Approval check inside emblem */}
    <path d="m9.5 13 2 2 3.5-3.5" strokeWidth="1.8" />
    {/* Title lines on cover */}
    <path d="M7 4.5h4" strokeWidth="1.1" opacity="0.5" />
  </svg>
);


