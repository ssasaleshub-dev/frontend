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
  X
} from 'lucide-react';
import crmService from '../services/api/crmService';
import { LEAD_STATUSES, PLATFORM_CONFIG } from '../config/constants';

export default function Leads() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState(null); // Full Detail Modal
  const [statusModalLead, setStatusModalLead] = useState(null); // Status Update Modal
  const [statusForm, setStatusForm] = useState({ status: 'CONTACTED', notes: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    customerName: '',
    phoneNumber: '',
    location: '',
    platform: 'IG',
    mattressType: '',
    mattressSize: '',
    budgetRange: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // getDetailedLeads provides customer, preference, and marketing resolution
      const data = await crmService.getDetailedLeads();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load detailed leads from backend');
      setLeads([]);
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

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Status filter
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;
      // Platform filter
      if (platformFilter !== 'ALL' && lead.platform !== platformFilter) return false;
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const nameMatch = (lead.customerName || '').toLowerCase().includes(query);
        const phoneMatch = (lead.phoneNumber || '').toLowerCase().includes(query);
        const locMatch = (lead.location || '').toLowerCase().includes(query);
        const adMatch = (lead.adName || lead.campaignName || '').toLowerCase().includes(query);
        const idMatch = String(lead.id).includes(query) || (lead.externalId || '').toLowerCase().includes(query);
        return nameMatch || phoneMatch || locMatch || adMatch || idMatch;
      }
      return true;
    });
  }, [leads, statusFilter, platformFilter, searchTerm]);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!statusModalLead) return;
    try {
      await crmService.updateLeadStatus(statusModalLead.id, statusForm.status, statusForm.notes);
      setStatusModalLead(null);
      await fetchLeads();
    } catch (err) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleDeleteLead = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete lead #${id} (${name || 'lead'})?`)) return;
    try {
      await crmService.deleteLead(id);
      await fetchLeads();
    } catch (err) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create or ensure customer exists
      const newCustomer = await crmService.createCustomer({
        fullName: newLeadForm.customerName,
        phoneNumber: newLeadForm.phoneNumber,
        location: newLeadForm.location,
      });

      // 2. Create Lead referencing Customer
      await crmService.createLead({
        platform: newLeadForm.platform,
        status: 'CREATED',
        isOrganic: true,
        notes: newLeadForm.notes,
        customer: { id: newCustomer.id },
      });

      setShowAddModal(false);
      setNewLeadForm({
        customerName: '',
        phoneNumber: '',
        location: '',
        platform: 'IG',
        mattressType: '',
        mattressSize: '',
        budgetRange: '',
        notes: '',
      });
      await fetchLeads();
    } catch (err) {
      alert(`Failed to create lead: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const cleanLabel = (text) => {
    if (!text) return 'Standard';
    return text.replace(/[?_]+/g, ' ').trim();
  };

  const formatDate = (isoStr) => {
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

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Lead Management Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing <strong className="text-slate-800">{filteredLeads.length}</strong> of{' '}
            <strong className="text-slate-800">{leads.length}</strong> total leads
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
            <span>Create Lead</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
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
              placeholder="Search by customer name, phone, location, campaign..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Platform:
            </span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              {['ALL', 'IG', 'FB'].map((plat) => (
                <button
                  key={plat}
                  onClick={() => setPlatformFilter(plat)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    platformFilter === plat
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {plat === 'ALL' ? 'All Platforms' : plat === 'IG' ? 'Instagram' : 'Facebook'}
                </button>
              ))}
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
            All Leads ({leads.length})
          </button>
          {LEAD_STATUSES.map((st) => {
            const count = leads.filter((l) => l.status === st.value).length;
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

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Lead / Customer</th>
                <th className="py-3.5 px-4">Phone & Location</th>
                <th className="py-3.5 px-4">Meta Attribution</th>
                <th className="py-3.5 px-4">Requirements & Budget</th>
                <th className="py-3.5 px-4">Lifecycle Status</th>
                <th className="py-3.5 px-4">Inquiry Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-600" />
                        Loading leads...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-600 font-semibold text-sm">No leads match your criteria</p>
                        <p className="text-slate-400 text-xs mt-1">
                          Try adjusting your search terms or filters, or import new records.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const plat = PLATFORM_CONFIG[lead.platform] || PLATFORM_CONFIG.OTHER;
                  const stConfig =
                    LEAD_STATUSES.find((s) => s.value === lead.status) || LEAD_STATUSES[0];
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{lead.customerName || `Customer #${lead.customerId}`}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {lead.externalId || `ID: #${lead.id}`}
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{lead.phoneNumber}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 capitalize mt-0.5">
                          <MapPin size={11} className="text-slate-400" />
                          <span>{lead.location || '—'}</span>
                        </div>
                      </td>

                      {/* Meta Attribution */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${plat.bg} ${plat.text} ${plat.border}`}
                          >
                            {plat.label}
                          </span>
                          <span
                            className="text-slate-800 font-medium truncate max-w-[130px]"
                            title={lead.adName}
                          >
                            {lead.adName || (lead.isOrganic ? 'Direct / Organic' : '—')}
                          </span>
                        </div>
                        <div
                          className="text-[11px] text-slate-500 truncate max-w-[170px] mt-0.5"
                          title={lead.campaignName}
                        >
                          {lead.campaignName || '—'}
                        </div>
                      </td>

                      {/* Requirements */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 capitalize">
                          {lead.mattressSize ? `${cleanLabel(lead.mattressSize)} Mattress` : (cleanLabel(lead.mattressType) || '—')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {lead.budgetRange ? cleanLabel(lead.budgetRange) : '—'}
                          {lead.purchaseTimeline ? ` · ${cleanLabel(lead.purchaseTimeline)}` : ''}
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({
                              status: lead.status || 'CONTACTED',
                              notes: lead.notes || '',
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stConfig.dot || 'bg-slate-400'}`} />
                          <span>{stConfig.label}</span>
                          <Edit3 size={11} className="text-slate-400 ml-0.5" />
                        </button>
                        {lead.notes && (
                          <p
                            className="text-[10px] text-slate-400 truncate max-w-[140px] mt-1"
                            title={lead.notes}
                          >
                            Note: {lead.notes}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(lead.createdTime || lead.createdAt)}
                      </td>

                      {/* Outreach & Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${lead.phoneNumber.replace(
                                  /\D/g,
                                  ''
                                )}?text=Hello%20${encodeURIComponent(
                                  lead.customerName || ''
                                )},%20greetings%20from%20SSA%20Sales%20Hub!%20We%20received%20your%20mattress%20inquiry.`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp Outreach"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors shadow-2xs"
                              >
                                <MessageCircle size={14} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call Customer"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors shadow-2xs"
                              >
                                <Phone size={14} />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedLead(lead)}
                            title="Inspect Details"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.customerName)}
                            title="Delete Lead"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors shadow-2xs"
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

      {/* Full Lead Details Drawer / Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  {selectedLead.customerName?.[0] || 'L'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedLead.customerName || 'Lead Detail'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    External ID: {selectedLead.externalId || `#${selectedLead.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-xs">
              {/* Customer Contact */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                  Customer Profile
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Full Name:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.customerName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone Number:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.phoneNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Location:</span>
                    <p className="font-semibold text-slate-900 capitalize">{selectedLead.location || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Customer ID:</span>
                    <p className="font-mono text-slate-900">#{selectedLead.customerId}</p>
                  </div>
                </div>
              </div>

              {/* Marketing Attribution */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60">
                <h4 className="font-bold text-blue-900 uppercase tracking-wider text-[10px] mb-2">
                  Meta Marketing Attribution
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Platform:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedLead.platform === 'IG' ? 'Instagram Ads' : 'Facebook Ads'}
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
                  <div className="col-span-2">
                    <span className="text-slate-400">Meta Instant Form:</span>
                    <p className="font-semibold text-slate-900">{selectedLead.leadFormName || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Product Preference Survey */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                  Survey / Product Requirements
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Mattress Type:</span>
                    <p className="font-semibold text-slate-900 capitalize">
                      {cleanLabel(selectedLead.mattressType)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Requested Size:</span>
                    <p className="font-semibold text-slate-900 capitalize">
                      {cleanLabel(selectedLead.mattressSize)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Budget Range:</span>
                    <p className="font-semibold text-slate-900">
                      {cleanLabel(selectedLead.budgetRange)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Purchase Timeline:</span>
                    <p className="font-semibold text-slate-900">
                      {cleanLabel(selectedLead.purchaseTimeline)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status and Notes */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Current Status:</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedLead.status}</p>
                  {selectedLead.notes && (
                    <p className="text-slate-600 mt-1 italic">"{selectedLead.notes}"</p>
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
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Change Status
                </button>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
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
              Update stage and follow-up notes for this inquiry
            </p>

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label} ({st.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sales Discussion Notes
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record customer preferences, discount offered, or callback date..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalLead(null)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Create New Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter customer full name"
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
                    placeholder="Enter phone number"
                    value={newLeadForm.phoneNumber}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Location / City</label>
                  <input
                    type="text"
                    placeholder="City / Area (optional)"
                    value={newLeadForm.location}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, location: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={newLeadForm.platform}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, platform: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="IG">Instagram Ad</option>
                    <option value="FB">Facebook Ad</option>
                    <option value="OTHER">Direct Walk-in / Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mattress Size</label>
                  <select
                    value={newLeadForm.mattressSize}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, mattressSize: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="">Select Size (optional)</option>
                    <option value="king">King (72x78)</option>
                    <option value="queen">Queen (60x78)</option>
                    <option value="single">Single</option>
                    <option value="custom">Custom Size</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  rows={2}
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
                  {submitting ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
