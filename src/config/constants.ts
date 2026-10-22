/**
 * Application Constants for Overseas Work & Study Visa Consultancy CRM
 */

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '';

export const STORAGE_KEYS = {
  TOKEN: 'ssa_id_token',
  ID_TOKEN: 'id_token',
  USER: 'ssa_user',
} as const;

export const API_ENDPOINTS = {
  AUTHENTICATE: '/api/authenticate',
  ACCOUNT: '/api/account',
  CHANGE_PASSWORD: '/api/account/change-password',
  REGISTER: '/api/register',
  ADMIN_USERS: '/api/admin/users',
  ADMIN_USER_AUTHORITIES: '/api/admin/users/authorities',
  AUTHORITIES: '/api/authorities',

  LEADS_ANALYTICS: '/api/leads/analytics',
  LEADS_DETAILED: '/api/leads/detailed',
  LEADS: '/api/leads',
  LEADS_IMPORT_FILE: '/api/leads/import/file',
  LEADS_IMPORT_RAW: '/api/leads/import/raw',
  LEADS_IMPORT_SAMPLE: '/api/leads/import/sample',

  CUSTOMERS: '/api/customers',

  LEAD_FORMS: '/api/lead-forms',
  LEAD_PREFERENCES: '/api/lead-preferences',

  MESSAGES: '/api/messages',
  MESSAGES_P2P: '/api/messages/p2p',
  FILES_UPLOAD: '/api/files/upload',
} as const;

export const VISA_TYPES = {
  WORK_VISA: {
    key: 'WORK_VISA',
    label: 'Work Visa',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Candidates seeking international employment & work permits',
  },
  STUDY_VISA: {
    key: 'STUDY_VISA',
    label: 'Study Visa',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Students seeking overseas university admissions & study permits',
  },
  OTHER_VISA: {
    key: 'OTHER_VISA',
    label: 'Other Visa',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: '3rd category / Other Visa inquiries and candidates',
  },
} as const;

export const USER_ROLES = {
  ADMIN: 'ROLE_ADMIN',
  WORK_VISA_COUNSELOR: 'ROLE_WORK_VISA',
  STUDY_VISA_COUNSELOR: 'ROLE_STUDY_VISA',
  DOMESTIC_COLLEGE_ADMISSION: 'ROLE_DOMESTIC_COLLEGE_ADMISSION',
  OTHER_VISA_COUNSELOR: 'ROLE_OTHER_VISA',
  GENERAL_USER: 'ROLE_USER',
} as const;

export const USER_ROLE_CONFIG = [
  { value: 'ROLE_ADMIN', label: 'Admin', desc: 'Super Administrator with global access across all desks and user management' },
  { value: 'ROLE_WORK_VISA', label: 'Work Visa Staff', desc: 'Handles international employment & work permit inquiries' },
  { value: 'ROLE_STUDY_VISA', label: 'Study Visa Staff', desc: 'Handles university admissions & study permits' },
  { value: 'ROLE_DOMESTIC_COLLEGE_ADMISSION', label: 'Domestic College Admission Staff', desc: 'Handles domestic college and university admissions' },
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
  CREATED: { label: 'New Lead', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  CONTACTED: { label: 'Contacted', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  QUALIFIED: { label: 'Qualified', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  CONVERTED: { label: 'Converted', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PROPOSAL_SENT: { label: 'Docs Requested', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  NEGOTIATION: { label: 'In Process', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  WON: { label: 'Visa Approved / Enrolled', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  LOST: { label: 'Lost / Closed', color: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const CANONICAL_LEAD_STATUSES = [
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'CONVERTED', label: 'Converted', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'LOST', label: 'Lost', color: 'bg-rose-100 text-rose-800 border-rose-200' },
] as const;

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

export function isStudyVisaType(vt?: string | null): boolean {
  if (!vt) return false;
  const upper = vt.toUpperCase();
  return upper === 'STUDY_VISA' || upper.includes('STUDY') || upper.includes('STUDENT');
}

export function isWorkVisaType(vt?: string | null): boolean {
  if (!vt) return false;
  const upper = vt.toUpperCase();
  return upper === 'WORK_VISA' || upper.includes('WORK') || upper.includes('EMPLOY');
}

export function isDomesticAdmissionType(vt?: string | null): boolean {
  if (!vt) return false;
  const upper = vt.toUpperCase();
  return upper.includes('DOMESTIC') || upper.includes('COLLEGE') || upper.includes('ADMISSION');
}

export function isOtherVisaType(vt?: string | null): boolean {
  if (!vt) return false;
  return !isStudyVisaType(vt) && !isWorkVisaType(vt) && !isDomesticAdmissionType(vt);
}

/**
 * Filter leads based on the logged-in counselor's role:
 * - Admin: sees all leads across all visa types
 * - ROLE_WORK_VISA: sees WORK_VISA leads or leads assigned to them
 * - ROLE_STUDY_VISA: sees STUDY_VISA leads or leads assigned to them
 * - ROLE_DOMESTIC_COLLEGE_ADMISSION: sees Domestic College Admission leads or leads assigned to them
 * - ROLE_OTHER_VISA: sees 3rd category / OTHER_VISA leads or leads assigned to them
 */
export function filterLeadsByUserRole(leads: any[] = [], currentUser: any = null): any[] {
  if (!leads || !Array.isArray(leads)) return [];
  if (!currentUser) return leads;

  const authorities: string[] = currentUser.authorities || [];
  const userLogin = (currentUser.login || '').toLowerCase();

  // ROLE_ADMIN: Super Administrator can see all leads
  if (authorities.includes(USER_ROLES.ADMIN)) {
    return leads;
  }

  // ROLE_STUDY_VISA: Staff handling Study Visa leads
  if (authorities.includes(USER_ROLES.STUDY_VISA_COUNSELOR)) {
    return leads.filter((lead) => {
      const isStudy = isStudyVisaType(lead.visaType);
      const isAssigned = (lead.assignedTo || '').toLowerCase() === userLogin;
      return isStudy || isAssigned;
    });
  }

  // ROLE_WORK_VISA: Staff handling Work Visa leads
  if (authorities.includes(USER_ROLES.WORK_VISA_COUNSELOR)) {
    return leads.filter((lead) => {
      const isWork = isWorkVisaType(lead.visaType);
      const isAssigned = (lead.assignedTo || '').toLowerCase() === userLogin;
      return isWork || isAssigned;
    });
  }

  // ROLE_DOMESTIC_COLLEGE_ADMISSION: Staff handling domestic college admission leads
  if (authorities.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION)) {
    return leads.filter((lead) => {
      const isDomestic = isDomesticAdmissionType(lead.visaType);
      const isAssigned = (lead.assignedTo || '').toLowerCase() === userLogin;
      return isDomestic || isAssigned;
    });
  }

  // ROLE_OTHER_VISA: Staff handling 3rd category / Other Visa leads
  if (authorities.includes(USER_ROLES.OTHER_VISA_COUNSELOR)) {
    return leads.filter((lead) => {
      const isOther = isOtherVisaType(lead.visaType);
      const isAssigned = (lead.assignedTo || '').toLowerCase() === userLogin;
      return isOther || isAssigned;
    });
  }

  return leads.filter((lead) => (lead.assignedTo || '').toLowerCase() === userLogin);
}
