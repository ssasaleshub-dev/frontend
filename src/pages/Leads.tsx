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
  Plus,
  UploadCloud,
  CheckCircle2,
  FileUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import crmService from '../services/api/crmService';
import adminService from '../services/api/adminService';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  CANONICAL_LEAD_STATUSES,
  AGE_BRACKETS,
  EDUCATION_QUALIFICATIONS,
  filterLeadsByUserRole,
  isStudyVisaType,
  isWorkVisaType,
  isOtherVisaType,
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

export interface ParsedLeadPreview {
  id: number;
  externalId?: string;
  createdTime?: string;
  name: string;
  phone: string;
  email: string;
  visaType: string;
  city: string;
  qualification: string;
  age: string;
  platform: string;
  isOrganic: boolean;
  campaignName?: string;
  campaignId?: string;
  adSetName?: string;
  adSetId?: string;
  adName?: string;
  adId?: string;
  formName?: string;
  formId?: string;
  surveyStatus?: string;
  surveyCgpa?: string;
  leadStatus?: string;
  rawNotes?: string;
  isValid: boolean;
}

export default function Leads() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const isAdmin = checkIsAdmin(currentUser);
  const isWorkVisa = isWorkVisaStaff(currentUser);
  const isStudyVisa = isStudyVisaStaff(currentUser);
  const isOtherVisa = isOtherVisaStaff(currentUser);
  const isWorkVisaCounselor = !isAdmin && isWorkVisa;
  const isStudyVisaCounselor = !isAdmin && isStudyVisa;
  const isOtherVisaCounselor = !isAdmin && isOtherVisa;
  const roleBadge = getRoleBadgeInfo(currentUser);

  // Determine user's desk scope
  const roleDesk: string = useMemo(() => {
    if (isAdmin) return 'ALL';
    if (isStudyVisa) return 'STUDY_VISA';
    if (isWorkVisa) return 'WORK_VISA';
    if (isOtherVisa) return 'OTHER_VISA';
    return 'ALL';
  }, [isAdmin, isStudyVisa, isWorkVisa, isOtherVisa]);

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Filters & Search: Default visaTypeFilter according to role
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [visaTypeFilter, setVisaTypeFilter] = useState<string>(() => {
    const queryParam = searchParams.get('visaType');
    if (isAdmin && queryParam) return queryParam;
    return roleDesk;
  });
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'NAME'>('NEWEST');

  // Sync visaTypeFilter when user role is available
  useEffect(() => {
    if (!isAdmin) {
      setVisaTypeFilter(roleDesk);
    }
  }, [isAdmin, roleDesk]);

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
  const [showAddModal, setShowAddModal] = useState<boolean>(
    searchParams.get('action') === 'create' || searchParams.get('action') === 'import'
  );
  const [modalTab, setModalTab] = useState<'manual' | 'excel'>(
    searchParams.get('action') === 'import' ? 'excel' : 'manual'
  );
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedLeadPreview[]>([]);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [importError, setImportError] = useState<string | null>(null);
  const [excelDefaultVisaType, setExcelDefaultVisaType] = useState<string>('AUTO');
  const [importMethod, setImportMethod] = useState<'direct' | 'server'>('direct');
  const [bulkStatusModal, setBulkStatusModal] = useState<boolean>(false);
  const [bulkStatus, setBulkStatus] = useState<string>('CONTACTED');

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      navigate(`/leads/${idParam}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Available staff for admin inline assignment (loaded dynamically from database)
  const [availableStaff, setAvailableStaff] = useState<Array<{ login: string; name?: string }>>([]);
  const [assigningLeadId, setAssigningLeadId] = useState<number | string | null>(null);

  useEffect(() => {
    adminService
      .getUsers(0, 100)
      .then((users) => {
        const list = Array.isArray(users) ? users : (users as any)?.content || [];
        if (Array.isArray(list)) {
          setAvailableStaff(
            list.map((u) => ({
              login: u.login,
              name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.login,
            }))
          );
        }
      })
      .catch(() => {
        setAvailableStaff([]);
      });
  }, []);

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
      const activeParam = !isAdmin ? roleDesk : (typeof typeParam === 'string' ? typeParam : visaTypeFilter);
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
  }, [visaTypeFilter, isAdmin, roleDesk]);

  const handleVisaTabChange = (vt: string) => {
    if (!isAdmin) return; // Non-admin cannot switch desks
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
        if (visaTypeFilter === 'STUDY_VISA' && !isStudyVisaType(lead.visaType)) return false;
        if (visaTypeFilter === 'WORK_VISA' && !isWorkVisaType(lead.visaType)) return false;
        if (visaTypeFilter === 'OTHER_VISA' && !isOtherVisaType(lead.visaType)) return false;
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
        email: newLeadForm.email || undefined,
      });

      const newLead = await crmService.createLead({
        externalId: 'lead_' + Date.now(),
        createdTime: new Date().toISOString(),
        platform: 'OTHER',
        status: 'CREATED',
        isOrganic: true,
        visaType: newLeadForm.visaType,
        customer: { id: newCustomer.id },
      });

      try {
        await crmService.createLeadPreference({
          lead: { id: newLead.id },
          visaType: newLeadForm.visaType,
          educationalQualification: EDUCATION_QUALIFICATIONS[2],
          age: AGE_BRACKETS[0],
        });
      } catch {
        // Preference creation non-fatal fallback
      }

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

  const parseMetaDate = (raw: any): string => {
    if (!raw) return new Date().toISOString();
    if (typeof raw === 'number') {
      const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return !isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
    }
    const s = String(raw).trim();
    // Match "10-18-24 12:52:17" or "10/18/24 12:52"
    const parts = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) {
      let year = parseInt(parts[3], 10);
      if (year < 100) year += 2000;
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const hh = parts[4] ? parseInt(parts[4], 10) : 0;
      const mm = parts[5] ? parseInt(parts[5], 10) : 0;
      const ss = parts[6] ? parseInt(parts[6], 10) : 0;
      const dt = new Date(Date.UTC(year, m, d, hh, mm, ss));
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct.toISOString();
    return new Date().toISOString();
  };

  const formatMetaPhone = (raw: any): string => {
    if (!raw) return '';
    let s = String(raw).trim().replace(/[^\d+]/g, '');
    if (!s.startsWith('+')) {
      if (s.startsWith('91') && s.length === 12) {
        s = '+' + s;
      } else if (s.length === 10) {
        s = '+91' + s;
      } else if (s) {
        s = '+' + s;
      }
    }
    return s;
  };

  const formatEducation = (currentStatus: string, rawQual: string): string => {
    const s = (currentStatus || '').toLowerCase().trim();
    if (s.includes('completed_ug') || s.includes('complete_ug') || s.includes('graduate')) {
      return 'Bachelor Degree / UG Graduate';
    }
    if (s.includes('finallyear') || s.includes('final_year') || s.includes('final year')) {
      return 'Final Year UG Student';
    }
    if (s.includes('master') || s.includes('pg') || s.includes('post_graduate')) {
      return 'Master Degree / Post Graduate';
    }
    if (s.includes('diploma')) {
      return 'Diploma / Poly';
    }
    if (s.includes('12th') || s.includes('hsc')) {
      return '12th Standard / HSC';
    }
    if (s.includes('10th') || s.includes('sslc')) {
      return '10th Standard';
    }
    if (s && s !== 'other') {
      return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return rawQual || 'Bachelor Degree';
  };

  const detectVisaType = (
    adsetName: string,
    campaignName: string,
    formName: string,
    rawVisa: string,
    fallback: string
  ): string => {
    const combined = `${adsetName} ${campaignName} ${formName} ${rawVisa}`.toUpperCase();
    if (
      combined.includes('WORK') ||
      combined.includes('PERMIT') ||
      combined.includes('EMPLOY') ||
      combined.includes('JOB')
    ) {
      return 'WORK_VISA';
    }
    if (
      combined.includes('STUDY') ||
      combined.includes('STUDENT') ||
      combined.includes('ADMISSION') ||
      combined.includes('COLLEGE') ||
      combined.includes('UNIV')
    ) {
      return 'STUDY_VISA';
    }
    if (
      combined.includes('TOURIST') ||
      combined.includes('VISIT') ||
      combined.includes('OTHER')
    ) {
      return 'OTHER_VISA';
    }
    return fallback || 'WORK_VISA';
  };

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setImportError('The selected spreadsheet appears to have no data rows.');
          setPreviewRows([]);
          return;
        }

        const parsed: ParsedLeadPreview[] = rawJson.map((row, idx) => {
          const getVal = (...keys: string[]) => {
            // 1. Direct exact key match
            for (const k of keys) {
              if (row[k] !== undefined && String(row[k]).trim() !== '') {
                return String(row[k]).trim();
              }
            }
            // 2. Normalized alphanumeric key match (ignores _, -, spaces, ?, parentheses)
            const cleanTargets = keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
            for (const rk of Object.keys(row)) {
              const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
              for (const ct of cleanTargets) {
                if (cleanRk === ct && String(row[rk]).trim() !== '') {
                  return String(row[rk]).trim();
                }
              }
            }
            // 3. Substring matching for questionnaire keys like 'what_is_your_current_status?'
            for (const rk of Object.keys(row)) {
              const lowerRk = rk.toLowerCase();
              for (const k of keys) {
                if (lowerRk.includes(k.toLowerCase()) && String(row[rk]).trim() !== '') {
                  return String(row[rk]).trim();
                }
              }
            }
            return '';
          };

          const externalId = getVal('id', 'lead_id', 'leadid', 'external_id');
          const createdTimeRaw = getVal('created_time', 'createdtime', 'created_at', 'timestamp', 'date');
          const createdTime = parseMetaDate(createdTimeRaw);

          const adId = getVal('ad_id', 'adid');
          const adName = getVal('ad_name', 'adname');
          const adSetId = getVal('adset_id', 'adsetid');
          const adSetName = getVal('adset_name', 'adsetname');
          const campaignId = getVal('campaign_id', 'campaignid');
          const campaignName = getVal('campaign_name', 'campaignname', 'campaign');
          const formId = getVal('form_id', 'formid');
          const formName = getVal('form_name', 'formname', 'leadform');

          const rawOrganic = getVal('is_organic', 'isorganic', 'organic').toLowerCase();
          const isOrganic = rawOrganic === 'true' || rawOrganic === '1';

          let platform = getVal('platform', 'source', 'channel').toUpperCase();
          if (platform.includes('IG') || platform.includes('INSTA')) platform = 'IG';
          else if (platform.includes('FB') || platform.includes('FACEBOOK')) platform = 'FB';
          else if (platform.includes('WHATSAPP') || platform.includes('WA')) platform = 'WHATSAPP';
          else if (!platform) platform = 'IG';

          // Custom questionnaire fields from Meta lead forms (matching user's Excel)
          const surveyStatus = getVal(
            'what_is_your_current_status',
            'current_status',
            'currentstatus',
            'status_ug'
          );
          const surveyCgpa = getVal(
            'what_is_your_cgpa_or_current_percentage',
            'cgpa',
            'current_percentage',
            'percentage',
            'marks'
          );

          const rawQual = getVal(
            'educationalqualification',
            'educational_qualification',
            'qualification',
            'education',
            'degree'
          );
          const qualification = formatEducation(surveyStatus, rawQual);

          const name = getVal('full_name', 'fullname', 'name', 'customername', 'candidatename', 'candidate');
          const rawPhone = getVal('phone_number', 'phonenumber', 'phone', 'mobile', 'contact', 'mobilenumber');
          const phone = formatMetaPhone(rawPhone);
          const email = getVal('email', 'emailaddress', 'mail');
          const city = getVal('city', 'location', 'place', 'town', 'district');
          const age = getVal('age', 'agebracket', 'age_bracket') || AGE_BRACKETS[0];
          const leadStatus = getVal('lead_status', 'leadstatus', 'status') || 'complete';

          const rawVisa = getVal('visatype', 'visa_type', 'visa', 'visaprogram', 'program');
          const visaType = detectVisaType(adSetName, campaignName, formName, rawVisa, defaultVisaType);

          const notesParts: string[] = [];
          if (surveyStatus) notesParts.push(`Status: ${surveyStatus}`);
          if (surveyCgpa) notesParts.push(`CGPA: ${surveyCgpa}`);
          if (campaignName) notesParts.push(`Campaign: ${campaignName}`);
          if (adSetName) notesParts.push(`AdSet: ${adSetName}`);
          if (formName) notesParts.push(`Form: ${formName}`);
          if (leadStatus) notesParts.push(`Meta Status: ${leadStatus}`);

          return {
            id: idx + 1,
            externalId: externalId || undefined,
            createdTime,
            name: name || `Candidate #${idx + 1}`,
            phone: phone || '',
            email: email || '',
            visaType,
            city: city || '',
            qualification,
            age,
            platform,
            isOrganic,
            campaignName: campaignName || undefined,
            campaignId: campaignId || undefined,
            adSetName: adSetName || undefined,
            adSetId: adSetId || undefined,
            adName: adName || undefined,
            adId: adId || undefined,
            formName: formName || undefined,
            formId: formId || undefined,
            surveyStatus: surveyStatus || undefined,
            surveyCgpa: surveyCgpa || undefined,
            leadStatus: leadStatus || undefined,
            rawNotes: notesParts.join(' | '),
            isValid: Boolean(name || phone),
          };
        });

        const validCandidates = parsed.filter((r) => r.name || r.phone);
        if (validCandidates.length === 0) {
          setImportError('No candidate records with valid names or phones found. Please check your Excel headers.');
          setPreviewRows([]);
        } else {
          setPreviewRows(validCandidates);
        }
      } catch (err: any) {
        setImportError(`Could not read Excel file: ${err?.message || 'Unsupported format'}`);
        setPreviewRows([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        id: '1282110291197702',
        created_time: '10-18-24 12:52:17',
        ad_id: '120203712472010612',
        ad_name: 'SSA_A01_SSA-01_feed_PVC_G110203712472010612',
        adset_id: '120203712472010612',
        adset_name: 'SSA_A01_WorkPermit_20-30_TN',
        campaign_id: '120203712472010612',
        campaign_name: 'SSA_LeadGen_USA+UK_TN_12',
        form_id: '10000017290030499',
        form_name: 'SSA_Form_A01_UG/USM-CG',
        is_organic: 'false',
        platform: 'ig',
        'what_is_your_current_status?': 'completed_ug',
        'what_is_your_cgpa_or_current_percentage?': '60-70% /6.0-7.0 CGPA',
        full_name: 'Bhuvanesh R',
        email: 'bhuvanesh.sample@gmail.com',
        phone_number: '+919025099944',
        city: 'Coimbatore',
        lead_status: 'complete',
      },
      {
        id: '21773179453315223',
        created_time: '10-18-24 12:47:20',
        ad_id: '120203712472010612',
        ad_name: 'SSA_A01_SSA-01_feed_PVC_G110203712472010612',
        adset_id: '120203712472010612',
        adset_name: 'SSA_A01_WorkPermit_20-30_TN',
        campaign_id: '120203712472010612',
        campaign_name: 'SSA_LeadGen_USA+UK_TN_12',
        form_id: '10000017290030499',
        form_name: 'SSA_Form_A01_UG/USM-CG',
        is_organic: 'false',
        platform: 'ig',
        'what_is_your_current_status?': 'completed_ug',
        'what_is_your_cgpa_or_current_percentage?': '70% and above /7.0+ cgpa',
        full_name: 'Kavitha R',
        email: 'kavitha.sample@gmail.com',
        phone_number: '+919788057933',
        city: 'Chennai',
        lead_status: 'complete',
      },
      {
        id: '1810156249179606',
        created_time: '10-18-24 12:30:15',
        ad_id: '120203712472010612',
        ad_name: 'SSA_A02_StudyAbroad_UG',
        adset_id: '120203712472010612',
        adset_name: 'SSA_A02_StudyAbroad_18-25_TN',
        campaign_id: '120203712472010612',
        campaign_name: 'SSA_LeadGen_Study_Canada+UK',
        form_id: '10000017290030500',
        form_name: 'SSA_Form_A02_StudyVisa',
        is_organic: 'false',
        platform: 'ig',
        'what_is_your_current_status?': 'finallyear_ug_student',
        'what_is_your_cgpa_or_current_percentage?': '70% and above /7.0+ cgpa',
        full_name: 'Soundaravel V',
        email: 'soundar.sample@gmail.com',
        phone_number: '+919840330773',
        city: 'Madurai',
        lead_status: 'complete',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MetaLeadAds');
    XLSX.writeFile(wb, 'meta_lead_ads_import_template.xlsx');
  };

  const handleConfirmImport = async () => {
    if (previewRows.length === 0) return;
    setImportLoading(true);
    setImportProgress({ current: 0, total: previewRows.length });
    setImportError(null);

    // Option A: If server upload mode is explicitly selected and file is present
    if (importMethod === 'server' && importFile) {
      try {
        const res = await crmService.importLeadsFile(importFile);
        setShowAddModal(false);
        setPreviewRows([]);
        setImportFile(null);
        window.dispatchEvent(new CustomEvent('crm-data-updated'));
        await fetchLeads();
        alert(
          `Server Ingestion Complete! Processed: ${res.totalRowsProcessed || previewRows.length}, Successful: ${res.successfulRows || previewRows.length}, Failed: ${res.failedRows || 0}`
        );
        return;
      } catch (serverErr: any) {
        const msg = serverErr?.response?.data?.message || serverErr?.message || 'Server upload failed';
        const fallbackDirect = window.confirm(
          `Server upload endpoint returned: "${msg}".\n\nWould you like to proceed with Direct Browser Ingestion directly into your database instead?`
        );
        if (!fallbackDirect) {
          setImportLoading(false);
          return;
        }
        // Fall through to direct ingestion
      }
    }

    // Option B: Direct Browser-to-DB Ingestion (Fast & Reliable batch creation)
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      try {
        const targetVisaType =
          excelDefaultVisaType === 'AUTO'
            ? row.visaType || 'WORK_VISA'
            : excelDefaultVisaType || row.visaType || 'WORK_VISA';

        const customer = await crmService.createCustomer({
          fullName: row.name,
          phoneNumber: row.phone || undefined,
          email: row.email || undefined,
          location: row.city || undefined,
          city: row.city || undefined,
        });

        const newLead = await crmService.createLead({
          externalId: row.externalId || ('meta_' + Date.now() + '_' + i),
          createdTime: row.createdTime || new Date().toISOString(),
          platform: (row.platform as any) || 'IG',
          status: 'CREATED',
          isOrganic: row.isOrganic ?? false,
          visaType: targetVisaType,
          campaignName: row.campaignName,
          adSetName: row.adSetName,
          adName: row.adName,
          leadFormName: row.formName,
          notes: row.rawNotes || undefined,
          customer: { id: customer.id },
        });

        try {
          await crmService.createLeadPreference({
            lead: { id: newLead.id },
            visaType: targetVisaType,
            educationalQualification: row.qualification || EDUCATION_QUALIFICATIONS[2],
            age: row.age || AGE_BRACKETS[0],
            notes: row.surveyCgpa ? `CGPA: ${row.surveyCgpa}` : undefined,
          });
        } catch {
          // preference non-fatal
        }

        successCount++;
      } catch {
        failCount++;
      }
      setImportProgress({ current: i + 1, total: previewRows.length });
    }

    setImportLoading(false);
    setShowAddModal(false);
    setPreviewRows([]);
    setImportFile(null);
    window.dispatchEvent(new CustomEvent('crm-data-updated'));
    await fetchLeads();
    alert(
      `Successfully loaded ${successCount} candidate lead${successCount === 1 ? '' : 's'} into database!${
        failCount > 0 ? ` (${failCount} entries had errors)` : ''
      }`
    );
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
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
          <span className="w-2 h-2 rounded-full bg-[#5856d6] shadow-2xs shrink-0"></span>
          <span>Work Visa</span>
        </span>
      );
    }
    if (t === 'STUDY_VISA') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
          <span className="w-2 h-2 rounded-full bg-[#34c759] shadow-2xs shrink-0"></span>
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
        <span className="w-2 h-2 rounded-full bg-[#ff9500] shadow-2xs shrink-0"></span>
        <span>{t === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}</span>
      </span>
    );
  };

  const renderStageBadge = (leadItem: Lead) => {
    const s = (leadItem.status || 'CREATED').toUpperCase();
    let badgeClasses = 'bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff]/20';
    let label = 'New Lead';

    if (s === 'CONTACTED') {
      badgeClasses = 'bg-[#5856d6]/10 text-[#5856d6] hover:bg-[#5856d6]/20';
      label = 'Contacted';
    } else if (s === 'QUALIFIED') {
      badgeClasses = 'bg-[#af52de]/10 text-[#af52de] hover:bg-[#af52de]/20';
      label = 'Qualified';
    } else if (s === 'CONVERTED' || s === 'WON') {
      badgeClasses = 'bg-[#34c759]/10 text-[#34c759] hover:bg-[#34c759]/20';
      label = s === 'WON' ? 'Approved' : 'Converted';
    } else if (s === 'PROPOSAL_SENT') {
      badgeClasses = 'bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500]/20';
      label = 'Docs Requested';
    } else if (s === 'NEGOTIATION') {
      badgeClasses = 'bg-[#5856d6]/10 text-[#5856d6] hover:bg-[#5856d6]/20';
      label = 'In Process';
    } else if (s === 'LOST') {
      badgeClasses = 'bg-black/[0.05] text-[#636366] hover:bg-black/[0.08]';
      label = 'Lost / Closed';
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setStatusModalLead(leadItem);
          setStatusForm({
            status: leadItem.status || 'CONTACTED',
            notes: leadItem.notes || '',
          });
        }}
        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:scale-102 cursor-pointer ${badgeClasses}`}
        title="Click to advance stage"
      >
        <span>{label}</span>
      </button>
    );
  };

  const allPageIdsSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.has(l.id));

  const excelStats = useMemo(() => {
    const work = previewRows.filter(
      (r) => (excelDefaultVisaType === 'AUTO' ? r.visaType : excelDefaultVisaType) === 'WORK_VISA'
    ).length;
    const study = previewRows.filter(
      (r) => (excelDefaultVisaType === 'AUTO' ? r.visaType : excelDefaultVisaType) === 'STUDY_VISA'
    ).length;
    const other = previewRows.filter(
      (r) => (excelDefaultVisaType === 'AUTO' ? r.visaType : excelDefaultVisaType) === 'OTHER_VISA'
    ).length;
    const ig = previewRows.filter((r) => r.platform === 'IG').length;
    const fb = previewRows.filter((r) => r.platform === 'FB').length;
    return { work, study, other, ig, fb };
  }, [previewRows, excelDefaultVisaType]);

  return (
    <div className="space-y-4">
      {/* Executive iOS Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1c1c1e] font-sf-display">
              Candidates
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/[0.05] text-[#3c3c43]">
              {filteredLeads.length}
            </span>
          </div>
          <p className="text-[12px] text-[#8e8e93] mt-0.5 flex items-center gap-1.5">
            {isAdmin ? (
              <span>Overseas Immigration & Admissions Global Directory</span>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
                <span className="font-medium text-[#3c3c43]">{roleBadge.displayText} Scope</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-xl border border-black/[0.08] text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download size={13} className="text-[#8e8e93]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setModalTab('excel');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007aff]/10 hover:bg-[#007aff]/15 text-[#007aff] hover:text-[#005bb5] rounded-xl border border-[#007aff]/25 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Import candidate leads directly from Excel sheet (.xlsx, .xls, .csv)"
          >
            <FileSpreadsheet size={13} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => fetchLeads()}
            disabled={loading}
            className="p-1.5 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-xl border border-black/[0.08] shadow-2xs transition-colors cursor-pointer"
            title="Refresh candidates"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#1c1c1e]' : 'text-[#8e8e93]'} />
          </button>

          <button
            onClick={() => {
              setModalTab('manual');
              setShowAddModal(true);
            }}
            className="ios-btn-primary"
          >
            <Plus size={14} />
            <span>New Candidate</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar Card */}
      <div className="ios-card p-3 sm:p-4 space-y-3">
        {/* Row 1: Search, Desk Segmented Control, and Select Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2 bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] focus:bg-white border border-transparent focus:border-[#007aff]/30 rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/15 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8e8e93] hover:text-[#1c1c1e]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Visa Segmented Control: Tab filters for Admin */}
            {isAdmin && (
              <div className="ios-segmented flex items-center">
                <button
                  onClick={() => handleVisaTabChange('ALL')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'ALL' ? 'active' : ''}`}
                >
                  All Desks
                </button>
                <button
                  onClick={() => handleVisaTabChange('WORK_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'WORK_VISA' ? 'active' : ''}`}
                >
                  Work Visa
                </button>
                <button
                  onClick={() => handleVisaTabChange('STUDY_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'STUDY_VISA' ? 'active' : ''}`}
                >
                  Study Visa
                </button>
                <button
                  onClick={() => handleVisaTabChange('OTHER_VISA')}
                  className={`ios-segmented-btn ${visaTypeFilter === 'OTHER_VISA' ? 'active' : ''}`}
                >
                  Other Visa
                </button>
              </div>
            )}

            {/* Platform Filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] border-0 rounded-xl text-xs text-[#1c1c1e] font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-black/10 transition-colors cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="IG">Instagram</option>
              <option value="FB">Facebook</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] border-0 rounded-xl text-xs text-[#1c1c1e] font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-black/10 transition-colors cursor-pointer"
            >
              <option value="NEWEST">Newest Inquiries</option>
              <option value="OLDEST">Oldest Inquiries</option>
              <option value="NAME">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Filter Tabs (Apple HIG Segmented Filter Bar) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 border-t border-black/[0.05]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#1c1c1e] text-white font-semibold shadow-xs'
                : 'text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.04]'
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
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#1c1c1e] text-white font-semibold shadow-xs'
                    : 'text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.04]'
                }`}
              >
                <span>{st.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      active ? 'bg-white/20 text-white' : 'bg-black/[0.06] text-[#1c1c1e]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Action Bar (When rows are selected) */}
      {selectedLeadIds.size > 0 && (
        <div className="p-3 bg-[#1c1c1e] text-white rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center font-bold text-[11px]">
              {selectedLeadIds.size}
            </span>
            <span className="font-semibold">candidates selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkStatusModal(true)}
              className="px-3 py-1 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] font-semibold rounded-lg shadow-xs"
            >
              Batch Update Stage
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded-lg border border-white/10 font-medium"
            >
              Export Selected
            </button>
            <button
              onClick={() => setSelectedLeadIds(new Set())}
              className="text-[#8e8e93] hover:text-white px-2 py-1"
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

      {/* Apple Inset Grouped Candidate Data Table */}
      <div className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#fbfbfd] border-b border-black/[0.06] text-[11px] font-semibold text-[#8e8e93] select-none">
                <th className="py-3 px-3.5 w-8">
                  <button
                    onClick={handleSelectAllOnPage}
                    className="text-[#8e8e93] hover:text-[#1c1c1e]"
                    title="Select all on this page"
                  >
                    {allPageIdsSelected ? <CheckSquare size={14} className="text-[#007aff]" /> : <Square size={14} className="text-[#c7c7cc]" />}
                  </button>
                </th>
                <th className="py-3 px-3.5">Candidate</th>
                <th className="py-3 px-3.5">Contact & City</th>
                <th className="py-3 px-3.5">Visa Program</th>
                <th className="py-3 px-3.5">Counselor</th>
                <th className="py-3 px-3.5">Profile</th>
                <th className="py-3 px-3.5">Source</th>
                <th className="py-3 px-3.5">Stage</th>
                <th className="py-3 px-3.5">Inquiry Date</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#8e8e93]">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={15} className="animate-spin text-[#1c1c1e]" />
                        Loading candidates...
                      </span>
                    ) : (
                      <div>
                        <p className="text-[#1c1c1e] font-semibold text-sm">No candidate records match your criteria</p>
                        <p className="text-[#8e8e93] text-xs mt-1">
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

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`hover:bg-[#007aff]/[0.02] transition-colors cursor-pointer group ${
                        isSelected ? 'bg-[#007aff]/[0.05]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleSelectRow(lead.id)}
                          className="text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare size={14} className="text-[#007aff]" />
                          ) : (
                            <Square size={14} className="text-[#c7c7cc]" />
                          )}
                        </button>
                      </td>

                      {/* Candidate Name & Email */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-[13px] text-[#1c1c1e] group-hover:text-[#007aff] transition-colors">
                          {lead.customerName || `Candidate #${lead.id}`}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] mt-0.5">
                          {lead.email && <span className="truncate max-w-[150px]">{lead.email}</span>}
                          {lead.email && <span>·</span>}
                          <span className="font-sf-mono text-[10px]">
                            {lead.externalId ? lead.externalId : `#${lead.id}`}
                          </span>
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="py-3 px-3.5">
                        <div className="font-sf-mono text-[12px] text-[#1c1c1e] font-medium tracking-tight">
                          {lead.phoneNumber || '—'}
                        </div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-[#8e8e93] capitalize flex items-center gap-1 mt-0.5">
                            <MapPin size={10} className="text-[#8e8e93] shrink-0" />
                            <span>{lead.city || lead.location}</span>
                          </div>
                        )}
                      </td>

                      {/* Visa Type Column with refined Apple dot indicator */}
                      <td className="py-3 px-3.5">
                        {renderVisaBadge(lead.visaType)}
                        {lead.leadConfirm && (
                          <div className="text-[10px] text-[#8e8e93] mt-0.5">
                            Status: <span className="font-medium text-[#3c3c43]">{lead.leadConfirm}</span>
                          </div>
                        )}
                      </td>

                      {/* Assigned To Column: Admin inline dropdown vs Staff read-only */}
                      <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={lead.assignedTo || ''}
                              onChange={(e) => handleAssignStaff(lead.id, e.target.value)}
                              disabled={assigningLeadId === lead.id}
                              className="px-2 py-1 bg-black/[0.04] hover:bg-black/[0.07] border-0 rounded-lg text-xs font-medium text-[#1c1c1e] focus:bg-white focus:ring-1 focus:ring-[#007aff]/30 focus:outline-none max-w-[130px] transition-all cursor-pointer"
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
                              <RefreshCw size={11} className="animate-spin text-[#8e8e93] shrink-0" />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-black/[0.05] border border-black/[0.05] flex items-center justify-center text-[10px] font-semibold text-[#1c1c1e] shrink-0">
                              {(lead.assignedTo?.[0] || '—').toUpperCase()}
                            </div>
                            <span className={`text-xs ${lead.assignedTo ? 'font-medium text-[#1c1c1e]' : 'text-[#8e8e93] italic'} truncate max-w-[100px]`}>
                              {lead.assignedTo || 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Qualification & Age */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-[#1c1c1e] truncate max-w-[140px]" title={lead.educationalQualification}>
                          {lead.educationalQualification || '—'}
                        </div>
                        <div className="text-[11px] text-[#8e8e93] mt-0.5">
                          {lead.age ? `${lead.age}` : ''}
                          {lead.areYouWorking ? ` · ${lead.areYouWorking}` : ''}
                        </div>
                      </td>

                      {/* Source & Attribution (Clean iOS Typography - No loud AI Badges) */}
                      <td className="py-3 px-3.5">
                        <div className="text-xs font-medium text-[#1c1c1e]">
                          {plat.label}
                        </div>
                        <div className="text-[11px] text-[#8e8e93] truncate max-w-[120px] mt-0.5" title={lead.campaignName}>
                          {lead.campaignName || 'Direct'}
                        </div>
                      </td>

                      {/* Lifecycle Stage without dot */}
                      <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                        {renderStageBadge(lead)}
                      </td>

                      {/* Inquiry Date */}
                      <td className="py-3 px-3.5 text-[#8e8e93] text-[11px] whitespace-nowrap font-normal">
                        {formatDate(lead.createdTime || lead.createdAt)}
                      </td>

                      {/* Outreach & Actions (Clean macOS Style Icon Buttons) */}
                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
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
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8e8e93] hover:text-[#34c759] hover:bg-[#34c759]/10 transition-colors"
                              >
                                <MessageCircle size={14} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call Candidate"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8e8e93] hover:text-[#007aff] hover:bg-[#007aff]/10 transition-colors"
                              >
                                <Phone size={14} />
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            title="Inspect Candidate Dossier"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.05] transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.customerName)}
                            title="Delete Lead"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8e8e93] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
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

        {/* High-Capacity Pagination Toolbar (iOS / macOS HIG Status Bar) */}
        <div className="p-3.5 border-t border-black/[0.05] bg-[#fbfbfd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-[#8e8e93]">
            <span>
              Showing <strong className="text-[#1c1c1e] font-semibold">{filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-[#1c1c1e] font-semibold">{Math.min(currentPage * pageSize, filteredLeads.length)}</strong> of{' '}
              <strong className="text-[#1c1c1e] font-semibold">{filteredLeads.length}</strong> candidates
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-black/[0.08]">
              <span className="text-[11px] text-[#8e8e93]">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-0.5 bg-black/[0.04] hover:bg-black/[0.08] border-0 rounded-md text-xs font-semibold text-[#1c1c1e] focus:outline-none transition-colors cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Switcher */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[#1c1c1e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 font-medium text-[#1c1c1e] text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[#1c1c1e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

      {/* Quick Status Update Modal (Zoho CRM Modal & Field UI) */}
      {statusModalLead && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Update Stage
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalLead(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Candidate Information
            </div>

            <form onSubmit={handleUpdateStatus} className="text-xs">
              {/* Candidate Name */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Name of the Candidate">
                  Name of the Can...
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    value={statusModalLead.customerName || `Candidate #${statusModalLead.id}`}
                    className="ios-input w-full font-medium text-slate-800 opacity-90 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Current Stage */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Current Stage">
                  Current Stage
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    value={statusModalLead.status}
                    className="ios-input w-full text-slate-700 opacity-90 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              {/* Transition Status */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Transition Status">
                  New Stage
                </label>
                <div className="flex-1">
                  <select
                    value={statusForm.status}
                    onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    className="zoho-select zoho-input-required font-medium"
                  >
                    {LEAD_STATUS_LIST.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label} ({st.value})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Counselor Notes */}
              <div className="zoho-form-row items-start">
                <label className="zoho-form-label pt-2" title="Counselor Notes">
                  Transition Notes
                </label>
                <div className="flex-1">
                  <textarea
                    value={statusForm.notes}
                    onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                    rows={3}
                    className="ios-input w-full resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Date & Time of Status Update (Compound Input matching screenshot) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="zoho-btn-done"
                >
                  Done
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Stage Update Modal (Zoho CRM Modal & Field UI) */}
      {bulkStatusModal && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Batch Update Stage
              </h3>
              <button
                type="button"
                onClick={() => setBulkStatusModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Order Information
            </div>

            <div className="text-xs">
              {/* Selected Candidates Count */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Selected Count">
                  Candidate Count
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    value={`${selectedLeadIds.size} candidates selected`}
                    className="ios-input w-full text-slate-700 opacity-90 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              {/* Target Stage (Dropdown) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Target Stage">
                  Target Stage
                </label>
                <div className="flex-1">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="zoho-select font-medium"
                  >
                    {LEAD_STATUS_LIST.map((st) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date and Time */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleExecuteBulkStatus}
                  disabled={submitting}
                  className="zoho-btn-done"
                >
                  {submitting ? 'Updating...' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Candidate Modal (Manual Entry + Excel Sheet Import with Preview) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`ios-glass-modal ${
              modalTab === 'excel' && previewRows.length > 0 ? 'max-w-5xl' : 'max-w-lg'
            } w-full p-6 my-6 border border-white/60 transition-all duration-200`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(60,60,67,0.1)]">
              <div>
                <h3 className="text-sm font-bold text-[#1c1c1e]">New Candidate Intake</h3>
                <p className="text-[11px] text-[#8e8e93]">
                  {modalTab === 'manual'
                    ? 'Record an overseas work or study visa candidate'
                    : 'Import and preview Meta Ads / Excel candidate spreadsheets'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setPreviewRows([]);
                  setImportFile(null);
                  setImportError(null);
                  if (searchParams.get('action') === 'create' || searchParams.get('action') === 'import') {
                    navigate('/leads', { replace: true });
                  }
                }}
                className="w-7 h-7 rounded-full bg-[rgba(118,118,128,0.12)] flex items-center justify-center text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-[rgba(118,118,128,0.2)] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Simple Human Mode Switcher */}
            <div className="mt-3.5 mb-4 flex items-center gap-1.5 p-1 bg-black/[0.04] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setModalTab('manual');
                  setImportError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  modalTab === 'manual'
                    ? 'bg-white text-[#1c1c1e] shadow-xs'
                    : 'text-[#8e8e93] hover:text-[#1c1c1e]'
                }`}
              >
                Single Candidate
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('excel');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modalTab === 'excel'
                    ? 'bg-white text-[#1c1c1e] shadow-xs'
                    : 'text-[#8e8e93] hover:text-[#1c1c1e]'
                }`}
              >
                <FileSpreadsheet size={13} />
                <span>Import Excel Sheet</span>
              </button>
            </div>

            {/* TAB 1: Manual Single Candidate Intake Form (Zoho CRM Modal & Field UI) */}
            {modalTab === 'manual' && (
              <form onSubmit={handleCreateLead} className="mt-4 text-xs">
                {/* Section Subheading matching screenshot */}
                <div className="text-xs font-semibold text-slate-500 mb-4 px-1">
                  Candidate Information
                </div>

                {/* Name of the Candidate (Required: Red Left Accent Bar) */}
                <div className="zoho-form-row">
                  <label className="zoho-form-label" title="Name of the Candidate">
                    Name of the Can...
                  </label>
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      value={newLeadForm.customerName}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, customerName: e.target.value })}
                      className="ios-input ios-input-required w-full font-medium"
                    />
                  </div>
                </div>

                {/* Customer Email */}
                <div className="zoho-form-row">
                  <label className="zoho-form-label" title="Customer Email">
                    Customer Email
                  </label>
                  <div className="flex-1">
                    <input
                      type="email"
                      value={newLeadForm.email}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                      className="ios-input w-full"
                    />
                  </div>
                </div>

                {/* Phone Number (Required: Red Left Accent Bar) */}
                <div className="zoho-form-row">
                  <label className="zoho-form-label" title="Phone Number">
                    Phone Number
                  </label>
                  <div className="flex-1">
                    <input
                      type="tel"
                      required
                      value={newLeadForm.phoneNumber}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, phoneNumber: e.target.value })}
                      className="ios-input ios-input-required w-full font-medium"
                    />
                  </div>
                </div>

                {/* Visa Program / Product (Dropdown matching screenshot) */}
                <div className="zoho-form-row">
                  <label className="zoho-form-label" title="Visa Program">
                    Visa Program
                  </label>
                  <div className="flex-1">
                    <select
                      value={newLeadForm.visaType}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, visaType: e.target.value })}
                      className="zoho-select font-medium"
                    >
                      <option value="WORK_VISA">Work Visa</option>
                      <option value="STUDY_VISA">Study Visa</option>
                      <option value="OTHER_VISA">Other Visa / Tourist</option>
                    </select>
                  </div>
                </div>

                {/* Date and Time of Intake (Compound Field matching screenshot) */}
                <div className="zoho-form-row">
                  <label className="zoho-form-label" title="Date and Time of Intake">
                    Date and Time of ...
                  </label>
                  <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                    <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Action Confirmation Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="zoho-btn-done"
                  >
                    {submitting ? 'Saving...' : 'Done'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Import from Excel Sheet with Instant Preview */}
            {modalTab === 'excel' && (
              <div className="space-y-4 text-xs">
                {importError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-amber-600" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* State A: File not chosen yet -> Simple Human Dropzone */}
                {previewRows.length === 0 ? (
                  <div className="space-y-3">
                    <div className="border border-dashed border-black/15 hover:border-[#007aff]/50 rounded-2xl p-7 text-center bg-[#f9f9fa] hover:bg-[#007aff]/[0.02] transition-colors relative cursor-pointer">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleExcelFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center">
                        <div className="w-13 h-13 rounded-2xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center mb-3 shadow-2xs">
                          <FileSpreadsheet size={26} />
                        </div>
                        <p className="font-semibold text-sm text-[#1c1c1e]">
                          Choose Excel Sheet (.xlsx, .xls, .csv)
                        </p>
                        <p className="text-[11px] text-[#8e8e93] mt-1 max-w-sm mx-auto">
                          Click to browse from your computer or drag and drop your spreadsheet here.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-md">
                          <span className="text-[10px] text-[#007aff] font-medium px-2 py-0.5 rounded-md bg-[#007aff]/10">
                            Meta Ads Compatible
                          </span>
                          <span className="text-[10px] text-[#3c3c43] font-medium px-2 py-0.5 rounded-md bg-black/[0.04]">
                            Auto-detects Work / Study Visa
                          </span>
                          <span className="text-[10px] text-[#3c3c43] font-medium px-2 py-0.5 rounded-md bg-black/[0.04]">
                            IG & FB Form Questions
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Template Download Option */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/[0.02] border border-black/[0.05]">
                      <div>
                        <p className="text-xs font-semibold text-[#1c1c1e]">Need a sample spreadsheet format?</p>
                        <p className="text-[11px] text-[#8e8e93] mt-0.5">
                          Download our template with Meta Ads Manager columns (ID, Campaign, Questions, Full Name, Phone, City).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadSampleTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-lg border border-black/[0.08] text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 ml-3"
                      >
                        <Download size={13} className="text-[#007aff]" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(60,60,67,0.1)]">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          if (searchParams.get('action') === 'create' || searchParams.get('action') === 'import') {
                            navigate('/leads', { replace: true });
                          }
                        }}
                        className="ios-btn-gray"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* State B: Sheet Uploaded -> Clean Preview Table & Confirmation */
                  <div className="space-y-3 animate-in fade-in">
                    {/* Preview Summary Bar */}
                    <div className="p-3.5 bg-black/[0.02] border border-black/[0.06] rounded-xl space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#007aff]/10 text-[#007aff] flex items-center justify-center shrink-0">
                            <FileSpreadsheet size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-[#1c1c1e] truncate max-w-xs">
                              {importFile?.name || 'Spreadsheet Data'}
                            </p>
                            <p className="text-[11px] text-[#34c759] font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
                              <span>{previewRows.length} candidates parsed & ready</span>
                            </p>
                          </div>
                        </div>

                        {/* Top Controls: Desk & Ingestion Mode */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-black/[0.08] shadow-2xs">
                            <span className="text-[11px] text-[#8e8e93]">Desk:</span>
                            <select
                              value={excelDefaultVisaType}
                              onChange={(e) => setExcelDefaultVisaType(e.target.value)}
                              className="text-xs font-semibold text-[#1c1c1e] bg-transparent focus:outline-none cursor-pointer"
                            >
                              <option value="AUTO">Auto-detect from AdSet / Campaign</option>
                              <option value="WORK_VISA">Force Work Visa Desk</option>
                              <option value="STUDY_VISA">Force Study Visa Desk</option>
                              <option value="OTHER_VISA">Force Other Visa Desk</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-black/[0.08] shadow-2xs">
                            <span className="text-[11px] text-[#8e8e93]">Mode:</span>
                            <select
                              value={importMethod}
                              onChange={(e) => setImportMethod(e.target.value as 'direct' | 'server')}
                              className="text-xs font-semibold text-[#1c1c1e] bg-transparent focus:outline-none cursor-pointer"
                            >
                              <option value="direct">Direct DB Ingest (Browser)</option>
                              <option value="server">Server Upload (/api/leads/import)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setPreviewRows([]);
                              setImportFile(null);
                            }}
                            className="text-[11px] text-[#ff3b30] hover:bg-[#ff3b30]/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
                          >
                            Change File
                          </button>
                        </div>
                      </div>

                      {/* Stat Breakdown Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/[0.04]">
                        <span className="text-[10px] font-semibold text-[#5856d6] bg-[#5856d6]/10 px-2 py-0.5 rounded-full">
                          {excelStats.work} Work Visa
                        </span>
                        <span className="text-[10px] font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                          {excelStats.study} Study Visa
                        </span>
                        {excelStats.other > 0 && (
                          <span className="text-[10px] font-semibold text-[#ff9500] bg-[#ff9500]/10 px-2 py-0.5 rounded-full">
                            {excelStats.other} Other
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-[#e1306c] bg-[#e1306c]/10 px-2 py-0.5 rounded-full">
                          {excelStats.ig} Instagram
                        </span>
                        {excelStats.fb > 0 && (
                          <span className="text-[10px] font-semibold text-[#1877f2] bg-[#1877f2]/10 px-2 py-0.5 rounded-full">
                            {excelStats.fb} Facebook
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Preview Table */}
                    <div className="border border-black/[0.08] rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#fbfbfd] border-b border-black/[0.06] text-[11px] font-semibold text-[#8e8e93] sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-8">#</th>
                            <th className="py-2.5 px-3">Candidate</th>
                            <th className="py-2.5 px-3">Contact</th>
                            <th className="py-2.5 px-3">Location</th>
                            <th className="py-2.5 px-3">Visa Desk</th>
                            <th className="py-2.5 px-3">Platform</th>
                            <th className="py-2.5 px-3">Survey & Profile</th>
                            <th className="py-2.5 px-3">Campaign / Adset</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                          {previewRows.map((r, i) => (
                            <tr key={i} className="hover:bg-black/[0.02]">
                              <td className="py-2.5 px-3 text-[#8e8e93] text-[10px] font-mono">{i + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-[#1c1c1e]">{r.name}</div>
                                {r.externalId && (
                                  <div className="text-[10px] text-[#8e8e93] font-mono truncate max-w-[110px]" title={r.externalId}>
                                    ID: {r.externalId}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-sf-mono text-[11px] text-[#3c3c43]">{r.phone || '—'}</div>
                                <div className="text-[10px] text-[#8e8e93] truncate max-w-[130px]">{r.email || '—'}</div>
                              </td>
                              <td className="py-2.5 px-3 text-[#3c3c43] font-medium">{r.city || '—'}</td>
                              <td className="py-2.5 px-3">
                                {renderVisaBadge(
                                  excelDefaultVisaType === 'AUTO' ? r.visaType : excelDefaultVisaType
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  r.platform === 'IG' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {r.platform}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-[11px] font-medium text-[#1c1c1e]">{r.qualification}</div>
                                {r.surveyCgpa && (
                                  <div className="text-[10px] text-[#8e8e93]">{r.surveyCgpa}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-[11px] font-medium text-[#1c1c1e] truncate max-w-[150px]" title={r.campaignName}>
                                  {r.campaignName || 'Meta Ads'}
                                </div>
                                {r.adSetName && (
                                  <div className="text-[10px] text-[#8e8e93] truncate max-w-[150px]" title={r.adSetName}>
                                    {r.adSetName}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Progress Bar when Ingesting */}
                    {importLoading && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-[#007aff]/[0.05] border border-[#007aff]/20">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#007aff] flex items-center gap-1.5">
                            <RefreshCw size={13} className="animate-spin" />
                            <span>
                              Loading {importProgress.current} of {importProgress.total} into CRM database...
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-[#007aff] font-bold">
                            {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#007aff] transition-all duration-150 rounded-full"
                            style={{
                              width: `${Math.round(
                                (importProgress.current / (importProgress.total || 1)) * 100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Action Confirmation Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-[rgba(60,60,67,0.1)]">
                      <span className="text-[11px] text-[#8e8e93]">
                        {importLoading ? (
                          'Writing records and linking candidate preferences...'
                        ) : (
                          `Verify columns above before confirming intake.`
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={importLoading}
                          onClick={() => {
                            setPreviewRows([]);
                            setImportFile(null);
                          }}
                          className="ios-btn-gray disabled:opacity-40"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          disabled={importLoading || previewRows.length === 0}
                          onClick={handleConfirmImport}
                          className="ios-btn-primary disabled:opacity-50"
                        >
                          {importLoading ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              <span>Ingesting...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={13} />
                              <span>Confirm & Load {previewRows.length} Candidates</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
