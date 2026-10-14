/**
 * Application Constants for Overseas Work & Study Visa Consultancy CRM
 */

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '';

export const STORAGE_KEYS = {
  TOKEN: 'ssa_id_token',
  USER: 'ssa_user',
} as const;

export const API_ENDPOINTS = {
  AUTHENTICATE: '/api/authenticate',
  ACCOUNT: '/api/account',
  CHANGE_PASSWORD: '/api/account/change-password',
  REGISTER: '/api/register',
  ADMIN_USERS: '/api/admin/users',
  ADMIN_USER_AUTHORITIES: '/api/admin/users/authorities',

  LEADS_ANALYTICS: '/api/leads/analytics',
  LEADS_DETAILED: '/api/leads/detailed',
  LEADS: '/api/leads',
  LEADS_IMPORT_FILE: '/api/leads/import/file',
  LEADS_IMPORT_RAW: '/api/leads/import/raw',
  LEADS_IMPORT_SAMPLE: '/api/leads/import/sample',

  CUSTOMERS: '/api/customers',

  CAMPAIGNS: '/api/campaigns',
  AD_SETS: '/api/ad-sets',
  ADS: '/api/ads',

  LEAD_FORMS: '/api/lead-forms',
  LEAD_PREFERENCES: '/api/lead-preferences',

  MESSAGES: '/api/messages',
} as const;

export const VISA_TYPES = {
  WORK_VISA: {
    key: 'WORK_VISA',
    label: 'Work Visa',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Candidates seeking international employment & work permits',
  },
  STUDY_VISA: {
    key: 'STUDY_VISA',
    label: 'Study Visa',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Students seeking overseas university admissions & study permits',
  },
} as const;

export const USER_ROLES = {
  ADMIN: 'ROLE_ADMIN',
  WORK_VISA_COUNSELOR: 'ROLE_WORK_VISA',
  STUDY_VISA_COUNSELOR: 'ROLE_STUDY_VISA',
  GENERAL_USER: 'ROLE_USER',
} as const;

export const USER_ROLE_CONFIG = [
  { value: 'ROLE_ADMIN', label: 'Admin (All Access)', desc: 'Full administrative access across all leads and users' },
  { value: 'ROLE_WORK_VISA', label: 'Work Visa Counselor', desc: 'Handles international employment & work permit inquiries' },
  { value: 'ROLE_STUDY_VISA', label: 'Study Visa Counselor', desc: 'Handles student admissions & university study permits' },
  { value: 'ROLE_USER', label: 'General Counselor', desc: 'General inquiry support and assistance' },
] as const;

export const PLATFORMS: Record<string, { label: string; color: string; bg?: string; text?: string; border?: string }> = {
  IG: { label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  FB: { label: 'Facebook', color: 'bg-blue-50 text-blue-700 border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  WHATSAPP: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  OTHER: { label: 'Direct / Walk-in', color: 'bg-slate-50 text-slate-700 border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

// Backward-compatible alias
export const PLATFORM_CONFIG = PLATFORMS;

export const LEAD_STATUSES: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'New Lead', color: 'bg-slate-100 text-slate-700' },
  CONTACTED: { label: 'Contacted', color: 'bg-sky-100 text-sky-700' },
  QUALIFIED: { label: 'Qualified', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL_SENT: { label: 'Docs Requested', color: 'bg-amber-100 text-amber-700' },
  NEGOTIATION: { label: 'In Process', color: 'bg-purple-100 text-purple-700' },
  WON: { label: 'Visa Approved / Enrolled', color: 'bg-emerald-100 text-emerald-800' },
  LOST: { label: 'Not Interested / Rejected', color: 'bg-rose-100 text-rose-700' },
};

export const LEAD_STATUS_LIST = Object.entries(LEAD_STATUSES).map(([value, conf]) => ({
  value,
  ...conf,
}));

export const AGE_BRACKETS = [
  '18 - 25 years',
  '26 - 35 years',
  '36 - 45 years',
  '45+ years',
] as const;

export const EDUCATION_QUALIFICATIONS = [
  '10th / 12th',
  'Diploma',
  'Bachelor Degree',
  'Master Degree / Post Graduate',
  'Any Degree',
] as const;

/**
 * Filter leads based on the logged-in counselor's role:
 * - Admin: sees all leads
 * - ROLE_WORK_VISA: sees WORK_VISA leads only
 * - ROLE_STUDY_VISA: sees STUDY_VISA leads only
 */
export function filterLeadsByUserRole(leads: any[] = [], currentUser: any = null): any[] {
  if (!leads || !Array.isArray(leads)) return [];
  if (!currentUser) return leads;

  const authorities: string[] = currentUser.authorities || [];
  if (authorities.includes(USER_ROLES.ADMIN)) {
    return leads;
  }
  if (authorities.includes(USER_ROLES.WORK_VISA_COUNSELOR)) {
    return leads.filter(
      (lead) => (lead.visaType || '').toUpperCase() === 'WORK_VISA'
    );
  }
  if (authorities.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) {
    return leads.filter(
      (lead) => (lead.visaType || '').toUpperCase() === 'STUDY_VISA'
    );
  }
  return leads;
}
