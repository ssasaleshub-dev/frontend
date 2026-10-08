export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const STORAGE_KEYS = {
  TOKEN: 'ssa_id_token',
  USER: 'ssa_user',
};

export const API_ENDPOINTS = {
  // Auth & Account
  AUTHENTICATE: '/api/authenticate',
  ACCOUNT: '/api/account',
  CHANGE_PASSWORD: '/api/account/change-password',
  REGISTER: '/api/register',
  USERS: '/api/users',

  // Leads & Analytics
  LEADS_ANALYTICS: '/api/leads/analytics',
  LEADS_DETAILED: '/api/leads/detailed',
  LEADS: '/api/leads',
  LEADS_COUNT: '/api/leads/count',
  LEADS_IMPORT_FILE: '/api/leads/import/file',
  LEADS_IMPORT_RAW: '/api/leads/import/raw',
  LEADS_IMPORT_SAMPLE: '/api/leads/import/sample',

  // Customers
  CUSTOMERS: '/api/customers',

  // Campaigns & Marketing
  CAMPAIGNS: '/api/campaigns',
  AD_SETS: '/api/ad-sets',
  ADS: '/api/ads',

  // Forms & Preferences
  LEAD_FORMS: '/api/lead-forms',
  LEAD_PREFERENCES: '/api/lead-preferences',
};
