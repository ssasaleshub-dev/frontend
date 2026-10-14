import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  RefreshCw,
  Phone,
  MessageCircle,
  MapPin,
  Trash2,
  Edit3,
  UploadCloud,
  AlertCircle,
  Eye,
  X,
  Mail,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  AGE_BRACKETS,
  EDUCATION_QUALIFICATIONS,
  filterLeadsByUserRole,
} from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { Lead } from '../types';

export default function Leads() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [visaTypeFilter, setVisaTypeFilter] = useState<string>('ALL');

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null); // Full Detail Modal
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null); // Status Update Modal
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string }>({
    status: 'CONTACTED',
    notes: '',
  });
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Initial New Lead Form
  const isAdmin = currentUser?.authorities?.includes(USER_ROLES.ADMIN);
  const isWorkVisaCounselor = currentUser?.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR);
  const isStudyVisaCounselor = currentUser?.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR);

  const defaultVisaType = isStudyVisaCounselor ? 'STUDY_VISA' : 'WORK_VISA';

  const [newLeadForm, setNewLeadForm] = useState<{
    customerName: string;
    phoneNumber: string;
    email: string;
    city: string;
    visaType: string;
    platform: string;
    age: string;
    educationalQualification: string;
    areYouWorking: string;
    areYouInterested: string;
    leadConfirm: string;
    notes: string;
  }>({
    customerName: '',
    phoneNumber: '',
    email: '',
    city: '',
    visaType: defaultVisaType,
    platform: 'IG',
    age: AGE_BRACKETS[0],
    educationalQualification: EDUCATION_QUALIFICATIONS[2],
    areYouWorking: 'yes',
    areYouInterested: 'yes',
    leadConfirm: 'Confirmed',
    notes: '',
  });

  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmService.getDetailedLeads();
      setRawLeads(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load candidate leads from backend');
      setRawLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchLeads();
    }

    const handleUpdate = () => fetchLeads();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, [fetchLeads]);

  // 1. Filter raw leads by logged-in user role
  const roleScopedLeads = useMemo(() => {
    return filterLeadsByUserRole(rawLeads, currentUser);
  }, [rawLeads, currentUser]);

  // 2. Filter by search, platform, status, and visaType (for admin)
  const filteredLeads = useMemo(() => {
    return roleScopedLeads.filter((lead) => {
      // Visa Type filter (for Admin)
      if (visaTypeFilter !== 'ALL') {
        if ((lead.visaType || '').toUpperCase() !== visaTypeFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;

      // Platform filter
      if (platformFilter !== 'ALL' && lead.platform !== platformFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const nameMatch = (lead.customerName || '').toLowerCase().includes(query);
        const phoneMatch = (lead.phoneNumber || '').toLowerCase().includes(query);
        const emailMatch = (lead.email || '').toLowerCase().includes(query);
        const cityMatch = (lead.city || lead.location || '').toLowerCase().includes(query);
        const campMatch = (lead.campaignName || '').toLowerCase().includes(query);
        const qualMatch = (lead.educationalQualification || '').toLowerCase().includes(query);
        const idMatch = String(lead.id).includes(query) || (lead.externalId || '').toLowerCase().includes(query);
        return nameMatch || phoneMatch || emailMatch || cityMatch || campMatch || qualMatch || idMatch;
      }

      return true;
    });
  }, [roleScopedLeads, visaTypeFilter, statusFilter, platformFilter, searchTerm]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalLead) return;
    try {
      await crmService.updateLeadStatus(statusModalLead.id, statusForm.status, statusForm.notes);
      setStatusModalLead(null);
      await fetchLeads();
    } catch (err: any) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleDeleteLead = async (id: number | string, name?: string) => {
    if (!window.confirm(`Are you sure you want to delete lead #${id} (${name || 'candidate'})?`)) return;
    try {
      await crmService.deleteLead(id);
      await fetchLeads();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create or ensure customer exists
      const newCustomer = await crmService.createCustomer({
        fullName: newLeadForm.customerName,
        phoneNumber: newLeadForm.phoneNumber,
        location: newLeadForm.city,
      });

      // 2. Create Lead referencing Customer and candidate survey
      await crmService.createLead({
        platform: newLeadForm.platform,
        status: 'CREATED',
        isOrganic: true,
        visaType: newLeadForm.visaType,
        age: newLeadForm.age,
        educationalQualification: newLeadForm.educationalQualification,
        areYouWorking: newLeadForm.areYouWorking,
        areYouInterested: newLeadForm.areYouInterested,
        leadConfirm: newLeadForm.leadConfirm,
        notes: newLeadForm.notes,
        customer: { id: newCustomer.id },
      });

      setShowAddModal(false);
      setNewLeadForm({
        customerName: '',
        phoneNumber: '',
        email: '',
        city: '',
        visaType: defaultVisaType,
        platform: 'IG',
        age: AGE_BRACKETS[0],
        educationalQualification: EDUCATION_QUALIFICATIONS[2],
        areYouWorking: 'yes',
        areYouInterested: 'yes',
        leadConfirm: 'Confirmed',
        notes: '',
      });
      await fetchLeads();
    } catch (err: any) {
      alert(`Failed to create candidate lead: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr?: string): string => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const renderVisaBadge = (type?: string) => {
    const isWork = (type || '').toUpperCase() === 'WORK_VISA';
    const isStudy = (type || '').toUpperCase() === 'STUDY_VISA';

    if (isWork) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Briefcase size={12} className="text-emerald-700" />
          <span>Work Visa</span>
        </span>
      );
    }
    if (isStudy) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
          <GraduationCap size={12} className="text-indigo-700" />
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span>{type || 'General'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Candidate Visa Pipeline
            </h2>
            {isWorkVisaCounselor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Work Visa Desk
              </span>
            )}
            {isStudyVisaCounselor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                Study Visa Desk
              </span>
            )}
            {isAdmin && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-white">
                Admin All-Access
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing <strong className="text-slate-800">{filteredLeads.length}</strong> of{' '}
            <strong className="text-slate-800">{roleScopedLeads.length}</strong> assigned candidate leads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-300 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/import')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-300 transition-colors"
          >
            <UploadCloud size={14} />
            <span>Import Leads</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
          >
            <Plus size={14} />
            <span>New Candidate Lead</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchLeads} className="underline font-medium hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidate by name, phone, email, city, campaign..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Visa Type Filter (Admin Only) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Visa:
                </span>
                <select
                  value={visaTypeFilter}
                  onChange={(e) => setVisaTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="ALL">All Visas</option>
                  <option value="WORK_VISA">Work Visa</option>
                  <option value="STUDY_VISA">Study Visa</option>
                </select>
              </div>
            )}

            {/* Platform Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Platform:
              </span>
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs font-medium">
                {[
                  { key: 'ALL', label: 'All' },
                  { key: 'IG', label: 'Instagram' },
                  { key: 'FB', label: 'Facebook' },
                  { key: 'WHATSAPP', label: 'WhatsApp' },
                ].map((plat) => (
                  <button
                    key={plat.key}
                    onClick={() => setPlatformFilter(plat.key)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      platformFilter === plat.key
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {plat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-100 pt-3">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Inquiries ({roleScopedLeads.length})
          </button>
          {LEAD_STATUS_LIST.map((st) => {
            const count = roleScopedLeads.filter((l) => l.status === st.value).length;
            const active = statusFilter === st.value;
            return (
              <button
                key={st.value}
                onClick={() => setStatusFilter(st.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded ${
                    active ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Candidate Leads Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Candidate / Lead</th>
                <th className="py-3 px-4">Phone & City</th>
                <th className="py-3 px-4">Visa Program</th>
                <th className="py-3 px-4">Education & Age</th>
                <th className="py-3 px-4">Marketing Attribution</th>
                <th className="py-3 px-4">Lifecycle Status</th>
                <th className="py-3 px-4">Inquiry Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-slate-600" />
                        Loading candidate leads...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-600 font-semibold text-sm">No candidate leads match your criteria</p>
                        <p className="text-slate-400 text-xs mt-1">
                          Try adjusting your search terms or filters, or import new records.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                  const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                    label: lead.status || 'New',
                    color: 'bg-slate-100 text-slate-700',
                  };

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Candidate Name & Email */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {lead.customerName || (lead.customerId ? `Candidate #${lead.customerId}` : `Lead #${lead.id}`)}
                        </div>
                        {lead.email && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail size={10} className="text-slate-400" />
                            <span className="truncate max-w-[150px]">{lead.email}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {lead.externalId ? `ID: ${lead.externalId}` : `#${lead.id}`}
                        </div>
                      </td>

                      {/* Phone & City */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{lead.phoneNumber || '—'}</div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 capitalize mt-0.5">
                            <MapPin size={11} className="text-slate-400" />
                            <span>{lead.city || lead.location}</span>
                          </div>
                        )}
                      </td>

                      {/* Visa Program */}
                      <td className="py-3 px-4">
                        {renderVisaBadge(lead.visaType)}
                        {lead.leadConfirm && (
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <span className="text-slate-400">Confirm:</span>
                            <span className="font-medium text-slate-700">{lead.leadConfirm}</span>
                          </div>
                        )}
                      </td>

                      {/* Education & Age Profile */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {lead.educationalQualification || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lead.age ? `${lead.age}` : ''}
                          {lead.areYouWorking ? ` · Working: ${lead.areYouWorking}` : ''}
                        </div>
                      </td>

                      {/* Attribution */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${plat.color}`}
                          >
                            {plat.label}
                          </span>
                          <span
                            className="text-slate-700 font-medium truncate max-w-[130px]"
                            title={lead.campaignName}
                          >
                            {lead.campaignName || (lead.isOrganic ? 'Direct / Walk-in' : '—')}
                          </span>
                        </div>
                        {lead.adName && (
                          <div
                            className="text-[11px] text-slate-400 truncate max-w-[150px] mt-0.5"
                            title={lead.adName}
                          >
                            Ad: {lead.adName}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({
                              status: lead.status || 'CONTACTED',
                              notes: lead.notes || '',
                            });
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border hover:opacity-90 transition-opacity ${stConfig.color} border-slate-200`}
                          title="Click to update lifecycle stage"
                        >
                          <span>{stConfig.label}</span>
                          <Edit3 size={11} className="opacity-60 ml-0.5" />
                        </button>
                        {lead.assignedTo && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Assigned: <span className="text-slate-600 font-medium">{lead.assignedTo}</span>
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(lead.createdTime || lead.createdAt)}
                      </td>

                      {/* Outreach & Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${lead.phoneNumber.replace(
                                  /\D/g,
                                  ''
                                )}?text=Hello%20${encodeURIComponent(
                                  lead.customerName || ''
                                )},%20greetings%20from%20our%20Overseas%20Visa%20Consultancy!%20We%20received%20your%20${encodeURIComponent(
                                  lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'
                                )}%20inquiry.`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp Outreach"
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs"
                              >
                                <MessageCircle size={14} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call Candidate"
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs"
                              >
                                <Phone size={14} />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedLead(lead)}
                            title="Inspect Candidate Profile"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.customerName)}
                            title="Delete Lead"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Candidate Profile Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  {selectedLead.customerName?.[0] || 'C'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedLead.customerName || 'Candidate Profile'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {renderVisaBadge(selectedLead.visaType)}
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedLead.externalId ? `ID: ${selectedLead.externalId}` : `#${selectedLead.id}`}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {/* Contact Profile */}
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                  Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Full Name:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.customerName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone Number:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.phoneNumber || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Email Address:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">City / Location:</span>
                    <p className="font-semibold text-slate-900 capitalize">{selectedLead.city || selectedLead.location || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Candidate Survey & Eligibility */}
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                  Candidate Profile & Survey Answers
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Visa Program:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedLead.visaType === 'WORK_VISA' ? 'Overseas Work Visa' : 'Overseas Study Visa'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Age Bracket:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.age || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Highest Qualification:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.educationalQualification || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Currently Working?</span>
                    <p className="font-semibold text-slate-900 capitalize">{selectedLead.areYouWorking || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Interested in Process?</span>
                    <p className="font-semibold text-slate-900 capitalize">{selectedLead.areYouInterested || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Lead Confirmation:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.leadConfirm || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Marketing Attribution */}
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                  Source & Marketing Attribution
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Platform:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedLead.platform === 'IG' ? 'Instagram' : selectedLead.platform === 'FB' ? 'Facebook' : selectedLead.platform === 'WHATSAPP' ? 'WhatsApp' : 'Direct'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Campaign Name:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Ad Set:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.adSetName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Ad Creative:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.adName || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Current Status and Counselor */}
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Current Lifecycle Status:</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedLead.status}</p>
                  {selectedLead.notes && (
                    <p className="text-slate-600 mt-1 italic">"{selectedLead.notes}"</p>
                  )}
                  {selectedLead.assignedTo && (
                    <p className="text-slate-500 text-[11px] mt-0.5">Assigned Counselor: {selectedLead.assignedTo}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setStatusModalLead(selectedLead);
                    setStatusForm({
                      status: selectedLead.status || 'CONTACTED',
                      notes: selectedLead.notes || '',
                    });
                    setSelectedLead(null);
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-md font-semibold hover:bg-slate-800"
                >
                  Change Status
                </button>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle Status & Notes Edit Modal */}
      {statusModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Update Status: {statusModalLead.customerName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current stage: <strong className="text-slate-800">{statusModalLead.status}</strong>
            </p>

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {LEAD_STATUS_LIST.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label} ({st.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Counselor Notes / Follow-up Details
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record discussion notes, document collection status, or callback date..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalLead(null)}
                  className="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md font-medium bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Candidate Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Add Candidate Lead</h3>
                <p className="text-[11px] text-slate-500">Record a new overseas work or study visa inquiry</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Candidate Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Praveen Selvaraj"
                  value={newLeadForm.customerName}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={newLeadForm.phoneNumber}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="candidate@gmail.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Rasipuram, Namakkal"
                    value={newLeadForm.city}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lead Source Platform</label>
                  <select
                    value={newLeadForm.platform}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, platform: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="IG">Instagram Ad</option>
                    <option value="FB">Facebook Ad</option>
                    <option value="WHATSAPP">WhatsApp Direct</option>
                    <option value="OTHER">Walk-in / Referral</option>
                  </select>
                </div>
              </div>

              {/* Visa Program Selection */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Visa Program *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isStudyVisaCounselor}
                    onClick={() => setNewLeadForm({ ...newLeadForm, visaType: 'WORK_VISA' })}
                    className={`p-2.5 rounded-md border text-left flex items-center justify-between ${
                      newLeadForm.visaType === 'WORK_VISA'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } disabled:opacity-40`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={14} className="text-emerald-700" />
                      <span>Work Visa</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isWorkVisaCounselor}
                    onClick={() => setNewLeadForm({ ...newLeadForm, visaType: 'STUDY_VISA' })}
                    className={`p-2.5 rounded-md border text-left flex items-center justify-between ${
                      newLeadForm.visaType === 'STUDY_VISA'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } disabled:opacity-40`}
                  >
                    <div className="flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-indigo-700" />
                      <span>Study Visa</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Education and Age Bracket */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Education Qualification</label>
                  <select
                    value={newLeadForm.educationalQualification}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, educationalQualification: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    {EDUCATION_QUALIFICATIONS.map((eq) => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Age Bracket</label>
                  <select
                    value={newLeadForm.age}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, age: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    {AGE_BRACKETS.map((ab) => (
                      <option key={ab} value={ab}>{ab}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Work Status and Lead Confirmation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Currently Employed?</label>
                  <select
                    value={newLeadForm.areYouWorking}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, areYouWorking: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="yes">Yes, currently working</option>
                    <option value="no">No / Fresher</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lead Confirmation</label>
                  <select
                    value={newLeadForm.leadConfirm}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, leadConfirm: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Follow-up">Callback Needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Counselor Discussion Notes</label>
                <textarea
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Record candidate preferences, target country, or background details..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
