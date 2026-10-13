export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const STORAGE_KEYS = {
  TOKEN: 'ssa_id_token',
  USER: 'ssa_user',
};

export const API_ENDPOINTS = {
  AUTHENTICATE: '/api/authenticate',
  ACCOUNT: '/api/account',
  CHANGE_PASSWORD: '/api/account/change-password',
  REGISTER: '/api/register',

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
};

export const LEAD_STATUSES = [
  { value: 'CREATED', label: 'Created', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-700' },
  { value: 'CONVERTED', label: 'Converted', color: 'bg-slate-900 text-white border-slate-900', dot: 'bg-emerald-400' },
  { value: 'LOST', label: 'Lost', color: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-300' },
];

export const PLATFORM_CONFIG = {
  IG: { label: 'Instagram', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
  FB: { label: 'Facebook', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
  OTHER: { label: 'Other', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
};
