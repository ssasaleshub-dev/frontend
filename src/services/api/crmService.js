import axiosClient from './axiosClient';
import { API_ENDPOINTS } from '../../config/constants';

export const crmService = {
  getLeadAnalytics: () => axiosClient.get(API_ENDPOINTS.LEADS_ANALYTICS),

  getDetailedLeads: () => axiosClient.get(API_ENDPOINTS.LEADS_DETAILED),
  getDetailedLeadById: (id) => axiosClient.get(`${API_ENDPOINTS.LEADS_DETAILED}/${id}`),

  updateLeadStatus: (id, status, notes) =>
    axiosClient.patch(`/api/leads/${id}/status`, { status, notes }),

  getLeads: (page = 0, size = 50, sort = 'id,desc') =>
    axiosClient.get(API_ENDPOINTS.LEADS, { params: { page, size, sort } }),
  getLeadById: (id) => axiosClient.get(`${API_ENDPOINTS.LEADS}/${id}`),
  createLead: (leadData) => axiosClient.post(API_ENDPOINTS.LEADS, leadData),
  updateLead: (id, leadData) => axiosClient.put(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  patchLead: (id, leadData) => axiosClient.patch(`${API_ENDPOINTS.LEADS}/${id}`, leadData),
  deleteLead: (id) => axiosClient.delete(`${API_ENDPOINTS.LEADS}/${id}`),

  importLeadsFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_FILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importRawLeads: (rawData) =>
    axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_RAW, rawData, {
      headers: { 'Content-Type': 'text/plain' },
    }),
  seedSampleLeads: () => axiosClient.post(API_ENDPOINTS.LEADS_IMPORT_SAMPLE),

  getCustomers: (page = 0, size = 50) =>
    axiosClient.get(API_ENDPOINTS.CUSTOMERS, { params: { page, size } }),
  getCustomerById: (id) => axiosClient.get(`${API_ENDPOINTS.CUSTOMERS}/${id}`),
  createCustomer: (customerData) => axiosClient.post(API_ENDPOINTS.CUSTOMERS, customerData),
  updateCustomer: (id, customerData) => axiosClient.put(`${API_ENDPOINTS.CUSTOMERS}/${id}`, customerData),
  deleteCustomer: (id) => axiosClient.delete(`${API_ENDPOINTS.CUSTOMERS}/${id}`),

  getCampaigns: (page = 0, size = 50) =>
    axiosClient.get(API_ENDPOINTS.CAMPAIGNS, { params: { page, size } }),
  createCampaign: (campaignData) => axiosClient.post(API_ENDPOINTS.CAMPAIGNS, campaignData),
  getAdSets: (page = 0, size = 50) =>
    axiosClient.get(API_ENDPOINTS.AD_SETS, { params: { page, size } }),
  getAds: (page = 0, size = 50) =>
    axiosClient.get(API_ENDPOINTS.ADS, { params: { page, size } }),

  getLeadForms: () => axiosClient.get(API_ENDPOINTS.LEAD_FORMS),
  getLeadPreferences: () => axiosClient.get(API_ENDPOINTS.LEAD_PREFERENCES),
};

export default crmService;
