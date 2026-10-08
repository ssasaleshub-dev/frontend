import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';

export const crmService = {
  // Analytics
  getLeadAnalytics: () => axiosClient.get(API_ENDPOINTS.LEADS_ANALYTICS),

  // Leads
  getLeads: (page = 0, size = 20, sort = 'id,desc') =>
    axiosClient.get(API_ENDPOINTS.LEADS, { params: { page, size, sort } }),
  getLeadById: (id) => axiosClient.get(`${API_ENDPOINTS.LEADS}/${id}`),
  createLead: (leadData) => axiosClient.post(API_ENDPOINTS.LEADS, leadData),
  updateLead: (id, leadData) => axiosClient.put(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  patchLead: (id, leadData) => axiosClient.patch(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  deleteLead: (id) => axiosClient.delete(`${API_ENDPOINTS.LEADS}/${id}`),
  getLeadsCount: () => axiosClient.get(API_ENDPOINTS.LEADS_COUNT),

  // Enriched / Detailed Leads
  getDetailedLeads: () => axiosClient.get(API_ENDPOINTS.LEADS_DETAILED),
  getDetailedLeadById: (id) => axiosClient.get(`${API_ENDPOINTS.LEADS_DETAILED}/${id}`),
  updateLeadStatus: (id, status, notes) =>
    axiosClient.patch(`/api/leads/${id}/status`, { status, notes }),

  // Lead Imports
  importLeadsFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_FILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importRawLeads: (rawText) =>
    axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_RAW, rawText, {
      headers: { 'Content-Type': 'text/plain' },
    }),
  seedSampleLeads: () => axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_SAMPLE),

  // Customers
  getCustomers: (page = 0, size = 20) =>
    axiosClient.get(API_ENDPOINTS.CUSTOMERS, { params: { page, size } }),
  getCustomerById: (id) => axiosClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`),
  createCustomer: (customer) => axiosClient.post(API_ENDPOINTS.CUSTOMERS, customer),
  updateCustomer: (id, customer) => axiosClient.put(`${API_ENDPOINTS.CUSTOMERS}/${id}`, customer),
  deleteCustomer: (id) => axiosClient.delete(`${API_ENDPOINTS.CUSTOMERS}/${id}`),

  // Campaigns & Marketing
  getCampaigns: () => axiosClient.get(API_ENDPOINTS.CAMPAIGNS),
  createCampaign: (campaign) => axiosClient.post(API_ENDPOINTS.CAMPAIGNS, campaign),

  // Lead Forms & Preferences
  getLeadForms: () => axiosClient.get(API_ENDPOINTS.LEAD_FORMS),
  getLeadPreferences: () => axiosClient.get(API_ENDPOINTS.LEAD_PREFERENCES),
};

export default crmService;
