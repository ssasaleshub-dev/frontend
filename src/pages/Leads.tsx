import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Phone,
  MessageCircle,
  MapPin,
  Trash2,
  Edit3,
  AlertCircle,
  Eye,
  X,
  Briefcase,
  GraduationCap,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Globe,
  Shield,
  UserCheck,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import adminService from '../services/api/adminService';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  CANONICAL_LEAD_STATUSES,
  KNOWN_STAFF_USERS,
  AGE_BRACKETS,
  EDUCATION_QUALIFICATIONS,
  filterLeadsByUserRole,
} from '../config/constants';
import {
  isAdmin as checkIsAdmin,
  isWorkVisaStaff,
  isStudyVisaStaff,
  isOtherVisaStaff,
  getRoleBadgeInfo,
} from '../utils/rbac';
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
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'NAME'>('NEWEST');

  // Pagination for 1000s of data records
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Selection & Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number | string>>(new Set());

  // Slide-over Drawer Dossier & Modals
  const [dossierLead, setDossierLead] = useState<Lead | null>(null);
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null);
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string }>({
    status: 'CONTACTED',
    notes: '',
  });
  const [showAddModal, setShowAddModal] = useState<boolean>(searchParams.get('action') === 'create');
  const [bulkStatusModal, setBulkStatusModal] = useState<boolean>(false);
  const [bulkStatus, setBulkStatus] = useState<string>('CONTACTED');

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      navigate(`/leads/${idParam}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const isAdmin = checkIsAdmin(currentUser);
  const isWorkVisa = isWorkVisaStaff(currentUser);
  const isStudyVisa = isStudyVisaStaff(currentUser);
  const isOtherVisa = isOtherVisaStaff(currentUser);
  const isWorkVisaCounselor = !isAdmin && isWorkVisa;
  const isStudyVisaCounselor = !isAdmin && isStudyVisa;
  const roleBadge = getRoleBadgeInfo(currentUser);

  // Available staff for admin inline assignment
  const [availableStaff, setAvailableStaff] = useState<Array<{ login: string; name?: string }>>([...KNOWN_STAFF_USERS]);
  const [assigningLeadId, setAssigningLeadId] = useState<number | string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      adminService
        .getUsers()
        .then((users) => {
          if (Array.isArray(users) && users.length > 0) {
            setAvailableStaff(
              users.map((u) => ({
                login: u.login,
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.login,
              }))
            );
          }
        })
        .catch(() => {
          // Keep default test staff accounts
        });
    }
  }, [isAdmin]);

  const handleAssignStaff = async (leadId: number | string, assignedTo: string) => {
    setAssigningLeadId(leadId);
    try {
      await crmService.assignLead(leadId, assignedTo);
      setRawLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, assignedTo } : l))
      );
      if (dossierLead && dossierLead.id === leadId) {
        setDossierLead((prev) => (prev ? { ...prev, assignedTo } : null));
      }
    } catch (err: any) {
      alert(`Staff assignment failed: ${err?.message || 'Server error'}`);
    } finally {
      setAssigningLeadId(null);
    }
  };

  const defaultVisaType = isStudyVisa ? 'STUDY_VISA' : isOtherVisa ? 'OTHER_VISA' : 'WORK_VISA';

  const [newLeadForm, setNewLeadForm] = useState<{
    customerName: string;
    phoneNumber: string;
    email: string;
    visaType: string;
  }>({
    customerName: '',
    phoneNumber: '',
    email: '',
    visaType: defaultVisaType,
  });

  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchLeads = useCallback(async (typeParam?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeParam = typeof typeParam === 'string' ? typeParam : visaTypeFilter;
      const data = await crmService.getDetailedLeads(
        activeParam && activeParam !== 'ALL' ? activeParam : undefined
      );
      setRawLeads(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load candidate leads');
      setRawLeads([]);
    } finally {
      setLoading(false);
    }
  }, [visaTypeFilter]);

  const handleVisaTabChange = (vt: string) => {
    setVisaTypeFilter(vt);
    fetchLeads(vt);
  };

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchLeads();
    }

    const handleUpdate = () => fetchLeads();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, [fetchLeads]);

  // Handle URL query lead inspect
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && rawLeads.length > 0) {
      const found = rawLeads.find((l) => String(l.id) === idParam);
      if (found) setDossierLead(found);
    }
  }, [searchParams, rawLeads]);

  // 1. Role Scoping
  const roleScopedLeads = useMemo(() => {
    return filterLeadsByUserRole(rawLeads, currentUser);
  }, [rawLeads, currentUser]);

  // 2. Multi-Dimension Filtering & Search
  const filteredLeads = useMemo(() => {
    let result = roleScopedLeads.filter((lead) => {
      // Visa Type filter
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

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'NAME') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      const timeA = new Date(a.createdTime || a.createdAt || 0).getTime();
      const timeB = new Date(b.createdTime || b.createdAt || 0).getTime();
      return sortBy === 'OLDEST' ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [roleScopedLeads, visaTypeFilter, statusFilter, platformFilter, searchTerm, sortBy]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, platformFilter, visaTypeFilter, pageSize]);

  // 3. Pagination Slicing for 1000s of records
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Selection handlers
  const handleSelectAllOnPage = () => {
    const pageIds = paginatedLeads.map((l) => l.id);
    const allSelected = pageIds.every((id) => selectedLeadIds.has(id));

    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectRow = (id: number | string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export CSV of currently filtered leads
  const handleExportCSV = () => {
    const leadsToExport = selectedLeadIds.size > 0
      ? filteredLeads.filter((l) => selectedLeadIds.has(l.id))
      : filteredLeads;

    if (leadsToExport.length === 0) {
      alert('No candidate records available to export.');
      return;
    }

    const headers = [
      'ID',
      'Candidate Name',
      'Phone Number',
      'Email',
      'City',
      'Visa Program',
      'Qualification',
      'Age',
      'Employed',
      'Platform',
      'Campaign',
      'Status',
      'Date',
      'Notes',
    ];

    const rows = leadsToExport.map((l) => [
      `"${l.id}"`,
      `"${l.customerName || ''}"`,
      `"${l.phoneNumber || ''}"`,
      `"${l.email || ''}"`,
      `"${l.city || l.location || ''}"`,
      `"${l.visaType || ''}"`,
      `"${l.educationalQualification || ''}"`,
      `"${l.age || ''}"`,
      `"${l.areYouWorking || ''}"`,
      `"${l.platform || ''}"`,
      `"${l.campaignName || ''}"`,
      `"${l.status || ''}"`,
      `"${l.createdTime || l.createdAt || ''}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `visa_candidates_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Status Update
  const handleExecuteBulkStatus = async () => {
    if (selectedLeadIds.size === 0) return;
    setSubmitting(true);
    try {
      const promises = Array.from(selectedLeadIds).map((id) =>
        crmService.updateLeadStatus(id, bulkStatus, `Bulk status update to ${bulkStatus}`)
      );
      await Promise.allSettled(promises);
      setSelectedLeadIds(new Set());
      setBulkStatusModal(false);
      await fetchLeads();
    } catch (err: any) {
      alert(`Bulk update completed with some errors: ${err?.message || 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalLead) return;
    try {
      await crmService.updateLeadStatus(statusModalLead.id, statusForm.status, statusForm.notes);
      setStatusModalLead(null);
      if (dossierLead && dossierLead.id === statusModalLead.id) {
        setDossierLead({ ...dossierLead, status: statusForm.status, notes: statusForm.notes });
      }
      await fetchLeads();
    } catch (err: any) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleDeleteLead = async (id: number | string, name?: string) => {
    if (!window.confirm(`Delete candidate lead #${id} (${name || 'record'})? This action cannot be undone.`)) return;
    try {
      await crmService.deleteLead(id);
      if (dossierLead && dossierLead.id === id) setDossierLead(null);
      await fetchLeads();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newCustomer = await crmService.createCustomer({
        fullName: newLeadForm.customerName,
        phoneNumber: newLeadForm.phoneNumber,
      });

      await crmService.createLead({
        platform: 'OTHER',
        status: 'CREATED',
        isOrganic: true,
        visaType: newLeadForm.visaType,
        customer: { id: newCustomer.id },
      });

      setShowAddModal(false);
      if (searchParams.get('action') === 'create') {
        navigate('/leads', { replace: true });
      }
      setNewLeadForm({
        customerName: '',
        phoneNumber: '',
        email: '',
        visaType: defaultVisaType,
      });
      await fetchLeads();
    } catch (err: any) {
      alert(`Failed to save candidate: ${err?.message || 'Server error'}`);
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
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const renderVisaBadge = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'WORK_VISA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
          <Briefcase size={10} className="text-indigo-600" />
          <span>Work Visa</span>
        </span>
      );
    }
    if (t === 'STUDY_VISA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <GraduationCap size={10} className="text-emerald-600" />
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
        <Globe size={10} className="text-amber-600" />
        <span>{t === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}</span>
      </span>
    );
  };

  const allPageIdsSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.has(l.id));

  return (
    <div className="space-y-4">
      {/* High-Profile Control Header */}
      <div className="ios-card p-3 sm:p-4 space-y-3">
        {/* Row 1: Search, Desk Segmented Control, and Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search 1,000s of candidates by name, phone, email, city, campaign..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Visa Segmented Control: Tab filters for Admin (All Leads, Work Visa, Study Visa, Other Visa) */}
            {isAdmin ? (
              <div className="ios-segmented flex items-center">
                <button
                  onClick={() => handleVisaTabChange('ALL')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'ALL' ? 'active' : 'text-slate-600'}`}
                >
                  All Leads
                </button>
                <button
                  onClick={() => handleVisaTabChange('WORK_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'WORK_VISA' ? 'active' : 'text-slate-600'}`}
                >
                  Work Visa
                </button>
                <button
                  onClick={() => handleVisaTabChange('STUDY_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'STUDY_VISA' ? 'active' : 'text-slate-600'}`}
                >
                  Study Visa
                </button>
                <button
                  onClick={() => handleVisaTabChange('OTHER_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'OTHER_VISA' ? 'active' : 'text-slate-600'}`}
                >
                  Other Visa
                </button>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <Shield size={12} className="text-slate-500" />
                <span>Desk Scope: {roleBadge.displayText}</span>
              </div>
            )}

            {/* Platform Filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Sources</option>
              <option value="IG">Instagram Ads</option>
              <option value="FB">Facebook Ads</option>
              <option value="WHATSAPP">WhatsApp Direct</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="NEWEST">Newest Inquiries</option>
              <option value="OLDEST">Oldest Inquiries</option>
              <option value="NAME">Name (A–Z)</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/90 text-xs font-medium shadow-2xs transition-colors"
              title="Export filtered records to CSV"
            >
              <Download size={13} className="text-slate-500" />
              <span>Export CSV</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchLeads()}
              disabled={loading}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/90 shadow-2xs transition-colors"
              title="Refresh leads"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-slate-900' : 'text-slate-500'} />
            </button>
          </div>
        </div>

        {/* Row 2: Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Candidates ({roleScopedLeads.length})
          </button>
          {LEAD_STATUS_LIST.map((st) => {
            const count = roleScopedLeads.filter((l) => l.status === st.value).length;
            const active = statusFilter === st.value;
            return (
              <button
                key={st.value}
                onClick={() => setStatusFilter(st.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
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

      {/* Bulk Action Bar (When rows are selected) */}
      {selectedLeadIds.size > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[11px]">
              {selectedLeadIds.size}
            </span>
            <span className="font-semibold">candidates selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkStatusModal(true)}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-lg shadow-xs"
            >
              Batch Update Stage
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium"
            >
              Export Selected
            </button>
            <button
              onClick={() => setSelectedLeadIds(new Set())}
              className="text-slate-400 hover:text-white px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchLeads()} className="underline font-semibold hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* High-Density Candidate Data Table */}
      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th className="py-2.5 px-3 w-8">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="text-slate-400 hover:text-slate-700"
                    title="Select all on this page"
                  >
                    {allPageIdsSelected ? <CheckSquare size={14} className="text-slate-900" /> : <Square size={14} />}
                  </button>
                </th>
                <th className="py-2.5 px-3">Candidate / Dossier</th>
                <th className="py-2.5 px-3">Phone & Location</th>
                <th className="py-2.5 px-3">Visa Type</th>
                <th className="py-2.5 px-3">Assigned To</th>
                <th className="py-2.5 px-3">Qualification & Age</th>
                <th className="py-2.5 px-3">Marketing Source</th>
                <th className="py-2.5 px-3">Lifecycle Stage</th>
                <th className="py-2.5 px-3">Inquiry Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={15} className="animate-spin text-slate-600" />
                        Loading candidates...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-700 font-semibold text-sm">No candidate records match your criteria</p>
                        <p className="text-slate-400 text-xs mt-1">
                          Try clearing filters or search keywords, or ingest new records from Meta ads.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedLeadIds.has(lead.id);
                  const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                  const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                    label: lead.status || 'New',
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleSelectRow(lead.id)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare size={14} className="text-slate-900" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>

                      {/* Candidate Name & Email */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <span>{lead.customerName || `Candidate #${lead.id}`}</span>
                        </div>
                        {lead.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {lead.email}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">
                          {lead.externalId ? `ID: ${lead.externalId}` : `#${lead.id}`}
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-slate-800 font-medium">{lead.phoneNumber || '—'}</div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-slate-500 capitalize flex items-center gap-1">
                            <MapPin size={10} className="text-slate-400 shrink-0" />
                            <span>{lead.city || lead.location}</span>
                          </div>
                        )}
                      </td>

                      {/* Visa Type Column with styled pill badges */}
                      <td className="py-2.5 px-3">
                        {renderVisaBadge(lead.visaType)}
                        {lead.leadConfirm && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Confirm: <span className="font-medium text-slate-700">{lead.leadConfirm}</span>
                          </div>
                        )}
                      </td>

                      {/* Assigned To Column: Admin inline dropdown vs Staff read-only */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={lead.assignedTo || ''}
                              onChange={(e) => handleAssignStaff(lead.id, e.target.value)}
                              disabled={assigningLeadId === lead.id}
                              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none max-w-[130px] shadow-2xs hover:border-slate-400 transition-colors"
                              title="Admin: Reassign staff"
                            >
                              <option value="">Unassigned</option>
                              {availableStaff.map((st) => (
                                <option key={st.login} value={st.login}>
                                  {st.name || st.login}
                                </option>
                              ))}
                            </select>
                            {assigningLeadId === lead.id && (
                              <RefreshCw size={11} className="animate-spin text-slate-500 shrink-0" />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                              {(lead.assignedTo?.[0] || '—').toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-700 truncate max-w-[100px]">
                              {lead.assignedTo || 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Qualification & Age */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 truncate max-w-[140px]" title={lead.educationalQualification}>
                          {lead.educationalQualification || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {lead.age ? `${lead.age}` : ''}
                          {lead.areYouWorking ? ` · Working: ${lead.areYouWorking}` : ''}
                        </div>
                      </td>

                      {/* Source & Attribution */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${plat.color}`}>
                            {plat.label}
                          </span>
                          <span className="text-slate-700 font-medium truncate max-w-[120px]" title={lead.campaignName}>
                            {lead.campaignName || 'Direct'}
                          </span>
                        </div>
                        {lead.adName && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5" title={lead.adName}>
                            Ad: {lead.adName}
                          </div>
                        )}
                      </td>

                      {/* Lifecycle Stage */}
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({
                              status: lead.status || 'CONTACTED',
                              notes: lead.notes || '',
                            });
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${stConfig.color} border-slate-200/90 shadow-2xs hover:scale-102 transition-transform`}
                          title="Click to advance stage"
                        >
                          <span>{stConfig.label}</span>
                          <Edit3 size={10} className="opacity-60 ml-0.5" />
                        </button>
                      </td>

                      {/* Inquiry Date */}
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(lead.createdTime || lead.createdAt)}
                      </td>

                      {/* Outreach & Actions */}
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                title="WhatsApp Direct Chat"
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200/70"
                              >
                                <MessageCircle size={13} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call Candidate"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/70"
                              >
                                <Phone size={13} />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            title="Inspect Full Candidate Dossier"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200/70 transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.customerName)}
                            title="Delete Lead"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200/70 transition-colors"
                          >
                            <Trash2 size={13} />
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

        {/* High-Capacity Pagination Toolbar (Built for 1,000s of Records) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span>
              Showing <strong className="text-slate-900 font-semibold">{filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-900 font-semibold">{Math.min(currentPage * pageSize, filteredLeads.length)}</strong> of{' '}
              <strong className="text-slate-900 font-semibold">{filteredLeads.length}</strong> candidates
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-[11px] text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800 text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS-Style Slide-Over Candidate Dossier Drawer */}
      {dossierLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-2xs transition-opacity animate-in fade-in">
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right duration-200">
              {/* Drawer Top Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    {(dossierLead.customerName?.[0] || 'C').toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {dossierLead.customerName || 'Candidate Profile'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {renderVisaBadge(dossierLead.visaType)}
                      <span className="text-[11px] text-slate-400 font-mono">
                        {dossierLead.externalId ? `ID: ${dossierLead.externalId}` : `#${dossierLead.id}`}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDossierLead(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Dossier Body Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Direct Action Hub */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Direct Contact</p>
                    <p className="font-mono text-sm font-semibold text-slate-900 truncate">
                      {dossierLead.phoneNumber || 'No phone'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dossierLead.phoneNumber && (
                      <>
                        <a
                          href={`https://wa.me/${dossierLead.phoneNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(dossierLead.customerName || '')},%20greetings%20from%20our%20Overseas%20Visa%20Consultancy!`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors"
                        >
                          <MessageCircle size={13} />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`tel:${dossierLead.phoneNumber}`}
                          className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg border border-slate-300 transition-colors"
                          title="Call phone"
                        >
                          <Phone size={14} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Candidate Eligibility Profile */}
                <div className="ios-card p-4 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-slate-500" />
                    <span>Eligibility & Survey Answers</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[11px]">Highest Education</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{dossierLead.educationalQualification || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Age Bracket</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{dossierLead.age || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Currently Employed?</span>
                      <p className="font-semibold text-slate-900 mt-0.5 capitalize">{dossierLead.areYouWorking || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Interested in Process?</span>
                      <p className="font-semibold text-slate-900 mt-0.5 capitalize">{dossierLead.areYouInterested || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Email Address</span>
                      <p className="font-semibold text-slate-900 mt-0.5 truncate">{dossierLead.email || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">City / Region</span>
                      <p className="font-semibold text-slate-900 mt-0.5 capitalize">{dossierLead.city || dossierLead.location || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Marketing Origin & Telemetry */}
                <div className="ios-card p-4 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <FileSpreadsheet size={14} className="text-slate-500" />
                    <span>Marketing Attribution Telemetry</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[11px]">Platform</span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {dossierLead.platform === 'IG' ? 'Instagram' : dossierLead.platform === 'FB' ? 'Facebook' : dossierLead.platform === 'WHATSAPP' ? 'WhatsApp Direct' : 'Organic'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Inquiry Timestamp</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{formatDate(dossierLead.createdTime || dossierLead.createdAt)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[11px]">Campaign Name</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{dossierLead.campaignName || 'Direct / Organic'}</p>
                    </div>
                    {dossierLead.adName && (
                      <div className="col-span-2">
                        <span className="text-slate-400 text-[11px]">Ad Creative</span>
                        <p className="font-semibold text-slate-900 mt-0.5">{dossierLead.adName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lifecycle Stage & Counselor Discussion Notes */}
                <div className="ios-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Lifecycle Discussion</span>
                    <button
                      onClick={() => {
                        setStatusModalLead(dossierLead);
                        setStatusForm({
                          status: dossierLead.status || 'CONTACTED',
                          notes: dossierLead.notes || '',
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-semibold text-[11px] hover:bg-slate-800"
                    >
                      Update Stage
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">Current Stage:</span>
                      <span className="font-bold text-slate-900">{dossierLead.status}</span>
                    </div>
                    {dossierLead.notes && (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700 italic mt-2">
                        "{dossierLead.notes}"
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  onClick={() => handleDeleteLead(dossierLead.id, dossierLead.customerName)}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl font-medium border border-rose-200 transition-colors"
                >
                  Delete Record
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cid = dossierLead.id;
                      setDossierLead(null);
                      navigate(`/leads/${cid}`);
                    }}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border border-slate-300 transition-colors flex items-center gap-1"
                  >
                    <span>Open Full Page</span>
                    <ChevronRight size={13} />
                  </button>
                  <button
                    onClick={() => setDossierLead(null)}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Status Update Modal */}
      {statusModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900">
              Update Stage: {statusModalLead.customerName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Current stage: <strong className="text-slate-800">{statusModalLead.status}</strong>
            </p>

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-2">
                  Transition Status
                </label>
                {/* Canonical Status Selector Chips */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  {CANONICAL_LEAD_STATUSES.map((cs) => {
                    const isSelected = statusForm.status === cs.value;
                    return (
                      <button
                        key={cs.value}
                        type="button"
                        onClick={() => setStatusForm({ ...statusForm, status: cs.value })}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{cs.label}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                          {cs.value}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
                >
                  {LEAD_STATUS_LIST.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label} ({st.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Counselor Notes / Transition Details
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record discussion notes, target country, or next callback..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalLead(null)}
                  className="px-3.5 py-1.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs"
                >
                  Save Status Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Stage Update Modal */}
      {bulkStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900">
              Batch Update Stage
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Apply new lifecycle stage to <strong className="text-slate-800">{selectedLeadIds.size}</strong> selected candidates.
            </p>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Stage</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
                >
                  {LEAD_STATUS_LIST.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkStatusModal(false)}
                  className="px-3.5 py-1.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulkStatus}
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : `Update ${selectedLeadIds.size} Leads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Candidate Modal (Apple iOS HIG Frosted Glass) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="ios-glass-modal max-w-lg w-full p-6 my-6 border border-white/60">
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(60,60,67,0.1)]">
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e]">New Candidate Intake</h3>
                <p className="text-[11px] text-[#8e8e93]">Record an overseas work or study visa candidate</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  if (searchParams.get('action') === 'create') {
                    navigate('/leads', { replace: true });
                  }
                }}
                className="w-7 h-7 rounded-full bg-[rgba(118,118,128,0.12)] flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[rgba(118,118,128,0.2)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1">Candidate Full Name <span className="text-[#ff3b30]">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Praveen Selvaraj"
                  value={newLeadForm.customerName}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, customerName: e.target.value })}
                  className="w-full ios-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">Phone Number <span className="text-[#ff3b30]">*</span></label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={newLeadForm.phoneNumber}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phoneNumber: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1c1c1e] mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="candidate@gmail.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full ios-input"
                  />
                </div>
              </div>


              {/* Visa Program Selection */}
              <div>
                <label className="block font-semibold text-[#1c1c1e] mb-1">Visa Program <span className="text-[#ff3b30]">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isStudyVisaCounselor}
                    onClick={() => setNewLeadForm({ ...newLeadForm, visaType: 'WORK_VISA' })}
                    className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      newLeadForm.visaType === 'WORK_VISA'
                        ? 'border-[#007aff] bg-[#007aff]/10 text-[#007aff] font-semibold ring-1 ring-[#007aff]'
                        : 'border-[rgba(60,60,67,0.12)] hover:border-[rgba(60,60,67,0.25)] bg-white text-[#1c1c1e]'
                    } disabled:opacity-40`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={14} className="text-[#007aff]" />
                      <span>Work Visa</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isWorkVisaCounselor}
                    onClick={() => setNewLeadForm({ ...newLeadForm, visaType: 'STUDY_VISA' })}
                    className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      newLeadForm.visaType === 'STUDY_VISA'
                        ? 'border-[#34c759] bg-[#34c759]/10 text-[#34c759] font-semibold ring-1 ring-[#34c759]'
                        : 'border-[rgba(60,60,67,0.12)] hover:border-[rgba(60,60,67,0.25)] bg-white text-[#1c1c1e]'
                    } disabled:opacity-40`}
                  >
                    <div className="flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-[#34c759]" />
                      <span>Study Visa</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(60,60,67,0.1)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    if (searchParams.get('action') === 'create') {
                      navigate('/leads', { replace: true });
                    }
                  }}
                  className="ios-btn-gray"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ios-btn-primary disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
