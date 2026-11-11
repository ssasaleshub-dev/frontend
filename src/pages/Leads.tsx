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
  FileSpreadsheet,
  Globe,
  Shield,
  UserCheck,
  Plus,
  UploadCloud,
  CheckCircle2,
  FileUp,
  LayoutList,
  Table,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import IosLeadList from '../components/leads/IosLeadList';
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
import { useAlert } from '../context/AlertContext';
import { Lead } from '../types';
import { encryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';
import { formatIndianDateTime, formatIndianDate, formatIndianTime, toISTDateKey } from '../utils/dateTimeUtils';
import { formatCurrencyDisplay } from '../utils/formatUtils';

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
  isDuplicate?: boolean;
  duplicateReason?: string;
  isValid: boolean;
}

interface ColumnFiltersState {
  campaignName: string;
  candidateName: string;
  mobileNumber: string;
  whatsapp: string;
  city: string;
  budget: string;
  quality: string;
  followUpDate: string;
  followUpStatus: string;
  remarks: string;
}

const DEFAULT_COLUMN_FILTERS: ColumnFiltersState = {
  campaignName: 'ALL',
  candidateName: '',
  mobileNumber: '',
  whatsapp: 'ALL',
  city: '',
  budget: 'ALL',
  quality: 'ALL',
  followUpDate: '',
  followUpStatus: 'ALL',
  remarks: '',
};

type TableColumnKey =
  | 'leadSource'
  | 'campaignName'
  | 'candidateName'
  | 'mobileNumber'
  | 'whatsapp'
  | 'city'
  | 'budget'
  | 'quality'
  | 'followUpDate'
  | 'followUpStatus'
  | 'currentStage'
  | 'remarks'
  | 'actions';

const TABLE_COLUMNS: Array<{ key: TableColumnKey; label: string; alignRight?: boolean }> = [
  { key: 'leadSource', label: 'Lead Source' },
  { key: 'campaignName', label: 'Campaign Name' },
  { key: 'candidateName', label: 'Candidate Name' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'whatsapp', label: 'WhatsApp Number' },
  { key: 'city', label: 'City' },
  { key: 'budget', label: 'Budget / Payment' },
  { key: 'quality', label: 'Lead Quality' },
  { key: 'followUpDate', label: 'Follow-up Date' },
  { key: 'followUpStatus', label: 'Follow-up Status' },
  { key: 'currentStage', label: 'Current Stage' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'actions', label: 'Actions', alignRight: true },
];

const DEFAULT_TABLE_COLUMN_WIDTHS: Record<TableColumnKey, number> = {
  leadSource: 110,
  campaignName: 145,
  candidateName: 185,
  mobileNumber: 135,
  whatsapp: 120,
  city: 115,
  budget: 130,
  quality: 100,
  followUpDate: 155,
  followUpStatus: 125,
  currentStage: 125,
  remarks: 180,
  actions: 175,
};

const TABLE_COL_WIDTHS_STORAGE_KEY = 'ssa_leads_table_col_widths_v1';
const MIN_COLUMN_WIDTH = 70;
const MAX_COLUMN_WIDTH = 640;

let textMeasureCtx: CanvasRenderingContext2D | null = null;
function measureTextPx(text: string, font = '500 13px "SF Pro Display", -apple-system, sans-serif'): number {
  if (!text) return 0;
  if (typeof document === 'undefined') return text.length * 7;
  if (!textMeasureCtx) {
    const canvas = document.createElement('canvas');
    textMeasureCtx = canvas.getContext('2d');
  }
  if (!textMeasureCtx) return text.length * 7;
  textMeasureCtx.font = font;
  return textMeasureCtx.measureText(text).width;
}

interface LeadBudgetDetails {
  formattedBudget: string;
  paymentStatus: string;
  fallbackLabel: string;
}

/**
 * Resolves the formatted budget amount, payment status, or readiness label for a lead.
 */
function getLeadBudgetDetails(leadItem: Lead): LeadBudgetDetails {
  const cachedBudget = localStorage.getItem(`ssa_lead_budget_${leadItem.id}`);
  const cachedPayment = localStorage.getItem(`ssa_lead_payment_status_${leadItem.id}`);
  const rawBudget = (leadItem as any).budgetRange || (leadItem as any).clientBudget || cachedBudget;
  const formattedBudget = formatCurrencyDisplay(rawBudget);
  const paymentStatus = ((leadItem as any).paymentStatus || cachedPayment || '').toUpperCase();

  if (formattedBudget || (paymentStatus && paymentStatus !== 'UNPAID')) {
    return { formattedBudget, paymentStatus, fallbackLabel: '' };
  }

  let fallbackLabel = '—';
  if (leadItem.budgetReady) {
    fallbackLabel = leadItem.budgetReady;
  } else {
    const notesLower = (leadItem.notes || '').toLowerCase();
    if (notesLower.includes('budget: no') || notesLower.includes('budget no') || notesLower.includes('budget_ready: no')) {
      fallbackLabel = 'No';
    } else if (notesLower.includes('budget: yes') || notesLower.includes('budget yes') || notesLower.includes('budget_ready: yes')) {
      fallbackLabel = 'Yes';
    } else if (leadItem.status === 'CONVERTED' || leadItem.status === 'WON' || leadItem.status === 'QUALIFIED') {
      fallbackLabel = 'Yes';
    }
  }

  return { formattedBudget: '', paymentStatus, fallbackLabel };
}

/**
 * Computes the displayed quality tier ('Hot' | 'Warm' | 'Cold' | '—') for a lead.
 */
function getLeadQualityText(leadItem: Lead): string {
  if (leadItem.leadQuality) return leadItem.leadQuality;
  const n = (leadItem.notes || '').toLowerCase();
  if (n.includes('quality: hot') || n.includes('hot')) return 'Hot';
  if (n.includes('quality: warm') || n.includes('warm')) return 'Warm';
  if (n.includes('quality: cold') || n.includes('cold')) return 'Cold';
  if (leadItem.status === 'QUALIFIED' || leadItem.status === 'CONVERTED' || leadItem.status === 'WON') return 'Hot';
  if (leadItem.status === 'CONTACTED' || leadItem.status === 'PROPOSAL_SENT') return 'Warm';
  return '—';
}

/**
 * Computes the displayed follow-up status text for a lead.
 */
function getFollowUpStatusText(leadItem: Lead): string {
  return leadItem.followUpStatus || leadItem.leadConfirm || ((leadItem.status || 'CREATED') === 'CREATED' ? 'Pending' : 'Interested');
}

const TableTextFilterCell: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}> = ({ value, onChange, placeholder, ariaLabel }) => {
  const active = value.trim().length > 0;
  return (
    <th className="py-2 px-2 align-middle font-normal overflow-hidden border-r border-black/[0.04] last:border-r-0">
      <div className="relative w-full min-w-0">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`font-sf h-[30px] w-full min-w-0 pl-2.5 pr-6 rounded-[8px] text-[12px] font-normal border transition-colors focus:outline-none focus:bg-white focus:border-[#007aff]/50 ${
            active
              ? 'bg-white border-black/[0.16] text-[#1c1c1e] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
              : 'bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] border-transparent text-[#1c1c1e] placeholder:text-[#8e8e93]'
          }`}
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange('')}
            title={`Clear ${ariaLabel}`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#1c1c1e] p-0.5 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </th>
  );
};

const TableSelectFilterCell: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  ariaLabel: string;
}> = ({ value, onChange, options, defaultValue = 'ALL', ariaLabel }) => {
  const active = value !== defaultValue;
  return (
    <th className="py-2 px-2 align-middle font-normal overflow-hidden border-r border-black/[0.04] last:border-r-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`font-sf h-[30px] w-full min-w-0 px-2 rounded-[8px] text-[12px] border transition-colors cursor-pointer focus:outline-none focus:bg-white focus:border-[#007aff]/50 ${
          active
            ? 'bg-white border-black/[0.16] text-[#1c1c1e] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
            : 'bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] border-transparent text-[#3c3c43] font-normal'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-[#1c1c1e] font-normal">
            {opt.label}
          </option>
        ))}
      </select>
    </th>
  );
};

export default function Leads() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showAlert, showConfirm } = useAlert();

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

  // Apple HIG View Mode: Inset Grouped List vs Table Grid (Default: table)
  const [viewMode, setViewMode] = useState<'list' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ssa_leads_view_mode_v2');
      if (saved === 'list' || saved === 'table') {
        return saved;
      }
      return 'table';
    }
    return 'table';
  });

  // Column-wise Table Filters
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(DEFAULT_COLUMN_FILTERS);
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ssa_leads_show_col_filters');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  const updateColumnFilter = useCallback(
    <K extends keyof ColumnFiltersState>(key: K, value: ColumnFiltersState[K]) => {
      setColumnFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleColumnFiltersRow = useCallback(() => {
    setShowColumnFilters((prev) => {
      const next = !prev;
      localStorage.setItem('ssa_leads_show_col_filters', String(next));
      return next;
    });
  }, []);

  // Excel-like Adjustable Column Widths (persisted in localStorage)
  const tableRef = useRef<HTMLTableElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const [resizingCol, setResizingCol] = useState<TableColumnKey | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<TableColumnKey, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(TABLE_COL_WIDTHS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Record<TableColumnKey, unknown>>;
          const merged = { ...DEFAULT_TABLE_COLUMN_WIDTHS };
          (Object.keys(DEFAULT_TABLE_COLUMN_WIDTHS) as TableColumnKey[]).forEach((k) => {
            const val = Number(parsed[k]);
            if (Number.isFinite(val) && val >= MIN_COLUMN_WIDTH && val <= MAX_COLUMN_WIDTH) {
              merged[k] = Math.round(val);
            }
          });
          return merged;
        }
      } catch {
        // Ignore malformed saved widths
      }
    }
    return { ...DEFAULT_TABLE_COLUMN_WIDTHS };
  });

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const persistColumnWidths = useCallback((widths: Record<TableColumnKey, number>) => {
    try {
      localStorage.setItem(TABLE_COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } catch {
      // ignore storage errors
    }
  }, []);

  const totalTableWidth = useMemo(
    () => (Object.values(columnWidths) as number[]).reduce((sum, w) => sum + w, 0),
    [columnWidths]
  );

  const hasCustomColumnWidths = useMemo(
    () =>
      (Object.keys(DEFAULT_TABLE_COLUMN_WIDTHS) as TableColumnKey[]).some(
        (k) => columnWidths[k] !== DEFAULT_TABLE_COLUMN_WIDTHS[k]
      ),
    [columnWidths]
  );

  const resetColumnWidths = useCallback(() => {
    const defaults = { ...DEFAULT_TABLE_COLUMN_WIDTHS };
    setColumnWidths(defaults);
    try {
      localStorage.removeItem(TABLE_COL_WIDTHS_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleStartColumnResize = useCallback(
    (colKey: TableColumnKey, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeCleanupRef.current?.();

      const startX = e.clientX;
      const startWidth = columnWidths[colKey] ?? DEFAULT_TABLE_COLUMN_WIDTHS[colKey];
      const minWidth = colKey === 'actions' ? 110 : MIN_COLUMN_WIDTH;
      let latestWidth = startWidth;

      setResizingCol(colKey);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextWidth = Math.round(
          Math.max(minWidth, Math.min(MAX_COLUMN_WIDTH, startWidth + deltaX))
        );
        latestWidth = nextWidth;
        setColumnWidths((prev) =>
          prev[colKey] === nextWidth ? prev : { ...prev, [colKey]: nextWidth }
        );
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setResizingCol(null);
        resizeCleanupRef.current = null;
      };

      const handlePointerUp = () => {
        cleanup();
        if (latestWidth !== startWidth) {
          persistColumnWidths({ ...columnWidths, [colKey]: latestWidth });
        }
      };

      resizeCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [columnWidths, persistColumnWidths]
  );

  const handleAutoFitColumn = useCallback(
    (colKey: TableColumnKey) => {
      let targetWidth = DEFAULT_TABLE_COLUMN_WIDTHS.actions;

      if (colKey !== 'actions') {
        const headerDef = TABLE_COLUMNS.find((c) => c.key === colKey);
        let maxTextPx = measureTextPx(headerDef?.label || '');

        const tableEl = tableRef.current;
        if (tableEl) {
          const cells = tableEl.querySelectorAll<HTMLElement>(`tbody td[data-col="${colKey}"]`);
          cells.forEach((cell) => {
            const lines = (cell.innerText || cell.textContent || '')
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);
            lines.forEach((line) => {
              const px = measureTextPx(line);
              if (px > maxTextPx) maxTextPx = px;
            });
          });
        }

        targetWidth = Math.round(
          Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, maxTextPx + 36))
        );
      }

      const next = { ...columnWidths, [colKey]: targetWidth };
      setColumnWidths(next);
      persistColumnWidths(next);
    },
    [columnWidths, persistColumnWidths]
  );

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
  const [excelDefaultVisaType, setExcelDefaultVisaType] = useState<string>(() => {
    if (!isAdmin && roleDesk && roleDesk !== 'ALL') return roleDesk;
    return 'AUTO';
  });
  const [importMethod, setImportMethod] = useState<'direct' | 'server'>('direct');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  useEffect(() => {
    if (!isAdmin && roleDesk && roleDesk !== 'ALL') {
      setExcelDefaultVisaType(roleDesk);
    }
  }, [isAdmin, roleDesk]);

  const duplicateStats = useMemo(() => {
    const duplicates = previewRows.filter((r) => r.isDuplicate);
    return {
      duplicateCount: duplicates.length,
      newCount: previewRows.length - duplicates.length,
      hasDuplicates: duplicates.length > 0,
      allDuplicates: previewRows.length > 0 && duplicates.length === previewRows.length,
    };
  }, [previewRows]);

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      navigate(`/leads/${encryptLeadId(idParam)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Available staff for admin inline assignment (loaded dynamically from database)
  const [availableStaff, setAvailableStaff] = useState<Array<{ login: string; name?: string }>>([]);
  const [assigningLeadId, setAssigningLeadId] = useState<number | string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
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
      showAlert({ title: 'App', message: `Staff assignment failed: ${err?.message || 'Server error'}` });
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
      const list = Array.isArray(data) ? data : (data as any)?.content || [];
      const normalized = list.map((l: any) => ({
        ...l,
        customerName: l.customerName || l.customer?.fullName || l.customer?.name || l.name || '',
        phoneNumber: l.phoneNumber || l.customer?.phoneNumber || l.customer?.rawPhoneNumber || l.customer?.phone || '',
        email: l.email || l.customer?.email || '',
        city: l.city || l.location || l.customer?.location || l.customer?.city || '',
        visaType: l.visaType || l.leadPreference?.visaType || l.preference?.visaType || '',
        assignedTo: l.assignedTo || l.leadPreference?.assignedTo || l.preference?.assignedTo || '',
      }));
      setRawLeads(normalized);
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

  // 1. Role Scoping: Ensure user only accesses leads within their role permissions
  const roleScopedLeads = useMemo(() => {
    return filterLeadsByUserRole(rawLeads, currentUser);
  }, [rawLeads, currentUser]);

  // 2. Desk & Platform Scoping: Used for Status Tabs counts and preserving counselor-assigned candidates
  const deskAndPlatformScopedLeads = useMemo(() => {
    const userLogin = (currentUser?.login || '').toLowerCase();
    return roleScopedLeads.filter((lead) => {
      // If a candidate is directly assigned to the logged-in counselor, always keep it in their view
      const isAssignedToMe = !isAdmin && !!userLogin && (lead.assignedTo || '').toLowerCase() === userLogin;

      // Visa Type / Desk filter (only filter out if not assigned to this counselor)
      if (visaTypeFilter !== 'ALL' && !isAssignedToMe) {
        if (visaTypeFilter === 'STUDY_VISA' && !isStudyVisaType(lead.visaType)) return false;
        if (visaTypeFilter === 'WORK_VISA' && !isWorkVisaType(lead.visaType)) return false;
        if (visaTypeFilter === 'OTHER_VISA' && !isOtherVisaType(lead.visaType)) return false;
      }

      // Platform filter
      if (platformFilter !== 'ALL') {
        const normalizedPlatform =
          lead.platform && PLATFORMS[lead.platform] ? lead.platform : 'OTHER';
        if (normalizedPlatform !== platformFilter) return false;
      }

      return true;
    });
  }, [roleScopedLeads, visaTypeFilter, platformFilter, isAdmin, currentUser?.login]);

  // Cache resolved budget/payment metadata once per scoped lead list so typing in column filters stays instant
  const budgetMetaByLeadId = useMemo(() => {
    const map = new Map<string | number, LeadBudgetDetails>();
    roleScopedLeads.forEach((lead) => {
      map.set(lead.id, getLeadBudgetDetails(lead));
    });
    return map;
  }, [roleScopedLeads]);

  // Dynamic dropdown option lists derived from active desk/platform scope
  const { campaignFilterOptions, budgetFilterOptions, followUpStatusFilterOptions } = useMemo(() => {
    const campaigns = new Set<string>();
    let hasEmptyCampaign = false;
    const budgetAmounts = new Set<string>();
    const followUpStatuses = new Set<string>();

    deskAndPlatformScopedLeads.forEach((lead) => {
      const camp = (lead.campaignName || '').trim();
      if (camp) campaigns.add(camp);
      else hasEmptyCampaign = true;

      const meta = budgetMetaByLeadId.get(lead.id) ?? getLeadBudgetDetails(lead);
      if (meta.formattedBudget) budgetAmounts.add(meta.formattedBudget);

      followUpStatuses.add(getFollowUpStatusText(lead));
    });

    const sortedCampaigns = Array.from(campaigns).sort((a, b) => a.localeCompare(b));
    if (
      columnFilters.campaignName !== 'ALL' &&
      columnFilters.campaignName !== '__NONE__' &&
      !campaigns.has(columnFilters.campaignName)
    ) {
      sortedCampaigns.unshift(columnFilters.campaignName);
    }

    const campaignOpts: Array<{ value: string; label: string }> = [
      { value: 'ALL', label: 'All' },
      ...sortedCampaigns.map((c) => ({ value: c, label: c })),
      ...(hasEmptyCampaign ? [{ value: '__NONE__', label: 'No Campaign (—)' }] : []),
    ];

    const sortedAmounts = Array.from(budgetAmounts).sort((a, b) => a.localeCompare(b));
    const budgetOpts: Array<{ value: string; label: string }> = [
      { value: 'ALL', label: 'All' },
      { value: 'HAS_VALUE', label: 'Has Budget / Yes' },
      { value: 'PAID', label: 'Paid' },
      { value: 'PARTIAL', label: 'Partial' },
      { value: 'YES', label: 'Yes' },
      { value: 'NO', label: 'No' },
      { value: 'NONE', label: 'Not Set (—)' },
      ...sortedAmounts.map((amt) => ({ value: `AMT:${amt}`, label: amt })),
    ];

    const sortedFollowUps = Array.from(followUpStatuses).sort((a, b) => a.localeCompare(b));
    if (
      columnFilters.followUpStatus !== 'ALL' &&
      !followUpStatuses.has(columnFilters.followUpStatus)
    ) {
      sortedFollowUps.unshift(columnFilters.followUpStatus);
    }
    const followUpOpts: Array<{ value: string; label: string }> = [
      { value: 'ALL', label: 'All' },
      ...sortedFollowUps.map((st) => ({ value: st, label: st })),
    ];

    return {
      campaignFilterOptions: campaignOpts,
      budgetFilterOptions: budgetOpts,
      followUpStatusFilterOptions: followUpOpts,
    };
  }, [deskAndPlatformScopedLeads, budgetMetaByLeadId, columnFilters.campaignName, columnFilters.followUpStatus]);

  const activeColumnFilterCount = useMemo(() => {
    let count = 0;
    if (platformFilter !== 'ALL') count += 1;
    if (statusFilter !== 'ALL') count += 1;
    if (columnFilters.campaignName !== 'ALL') count += 1;
    if (columnFilters.candidateName.trim()) count += 1;
    if (columnFilters.mobileNumber.trim()) count += 1;
    if (columnFilters.whatsapp !== 'ALL') count += 1;
    if (columnFilters.city.trim()) count += 1;
    if (columnFilters.budget !== 'ALL') count += 1;
    if (columnFilters.quality !== 'ALL') count += 1;
    if (columnFilters.followUpDate) count += 1;
    if (columnFilters.followUpStatus !== 'ALL') count += 1;
    if (columnFilters.remarks.trim()) count += 1;
    return count;
  }, [platformFilter, statusFilter, columnFilters]);

  const clearColumnFilters = useCallback((clearGlobalSearch = false) => {
    setColumnFilters(DEFAULT_COLUMN_FILTERS);
    setPlatformFilter('ALL');
    setStatusFilter('ALL');
    if (clearGlobalSearch) {
      setSearchTerm('');
    }
  }, []);

  // 3. Multi-Dimension Filtering (Status, Global Search & Column Filters) & Sorting
  const filteredLeads = useMemo(() => {
    const candQuery = columnFilters.candidateName.trim().toLowerCase();
    const mobileQuery = columnFilters.mobileNumber.trim().toLowerCase();
    const mobileDigits = columnFilters.mobileNumber.replace(/\D/g, '');
    const cityQuery = columnFilters.city.trim().toLowerCase();
    const remarksQuery = columnFilters.remarks.trim().toLowerCase();

    let result = deskAndPlatformScopedLeads.filter((lead) => {
      // Status / Current Stage filter
      const leadStatus = lead.status || 'CREATED';
      if (statusFilter !== 'ALL' && leadStatus !== statusFilter) return false;

      // Global search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const nameMatch = (lead.customerName || '').toLowerCase().includes(query);
        const phoneMatch = (lead.phoneNumber || '').toLowerCase().includes(query);
        const emailMatch = (lead.email || '').toLowerCase().includes(query);
        const cityMatch = (lead.city || lead.location || '').toLowerCase().includes(query);
        const campMatch = (lead.campaignName || '').toLowerCase().includes(query);
        const qualMatch = (lead.educationalQualification || '').toLowerCase().includes(query);
        const idMatch = String(lead.id).includes(query) || (lead.externalId || '').toLowerCase().includes(query);
        if (!(nameMatch || phoneMatch || emailMatch || cityMatch || campMatch || qualMatch || idMatch)) {
          return false;
        }
      }

      // Column: Campaign Name
      if (columnFilters.campaignName !== 'ALL') {
        const camp = (lead.campaignName || '').trim();
        if (columnFilters.campaignName === '__NONE__') {
          if (camp) return false;
        } else if (camp !== columnFilters.campaignName) {
          return false;
        }
      }

      // Column: Candidate Name / Email / ID
      if (candQuery) {
        const nameMatch = (lead.customerName || '').toLowerCase().includes(candQuery);
        const emailMatch = (lead.email || '').toLowerCase().includes(candQuery);
        const idMatch =
          String(lead.id).includes(candQuery) ||
          (lead.externalId || '').toLowerCase().includes(candQuery);
        if (!nameMatch && !emailMatch && !idMatch) return false;
      }

      // Column: Mobile Number
      if (mobileQuery) {
        const phoneStr = (lead.phoneNumber || '').toLowerCase();
        const rawDigits = phoneStr.replace(/\D/g, '');
        const textMatches = phoneStr.includes(mobileQuery);
        const digitMatches =
          mobileDigits.length > 0 &&
          /^[\d+\s()-]+$/.test(mobileQuery) &&
          rawDigits.includes(mobileDigits);
        if (!textMatches && !digitMatches) return false;
      }

      // Column: WhatsApp Number
      if (columnFilters.whatsapp !== 'ALL') {
        const hasPhone = Boolean(lead.phoneNumber && String(lead.phoneNumber).trim());
        if (columnFilters.whatsapp === 'YES' && !hasPhone) return false;
        if (columnFilters.whatsapp === 'NO' && hasPhone) return false;
      }

      // Column: City
      if (cityQuery) {
        const leadCity = (lead.city || lead.location || '').toLowerCase();
        if (!leadCity.includes(cityQuery)) return false;
      }

      // Column: Budget / Payment
      if (columnFilters.budget !== 'ALL') {
        const meta = budgetMetaByLeadId.get(lead.id) ?? getLeadBudgetDetails(lead);
        const fBudget = columnFilters.budget;
        if (fBudget === 'NONE') {
          if (meta.formattedBudget || (meta.paymentStatus && meta.paymentStatus !== 'UNPAID') || meta.fallbackLabel !== '—') {
            return false;
          }
        } else if (fBudget === 'PAID') {
          if (meta.paymentStatus !== 'PAID') return false;
        } else if (fBudget === 'PARTIAL') {
          if (meta.paymentStatus !== 'PARTIAL') return false;
        } else if (fBudget === 'YES') {
          if (meta.fallbackLabel.trim().toLowerCase() !== 'yes') return false;
        } else if (fBudget === 'NO') {
          if (meta.fallbackLabel.trim().toLowerCase() !== 'no') return false;
        } else if (fBudget === 'HAS_VALUE') {
          const hasPositive =
            Boolean(meta.formattedBudget) ||
            meta.paymentStatus === 'PAID' ||
            meta.paymentStatus === 'PARTIAL' ||
            meta.fallbackLabel.toLowerCase() === 'yes';
          if (!hasPositive) return false;
        } else if (fBudget.startsWith('AMT:')) {
          if (meta.formattedBudget !== fBudget.slice(4)) return false;
        }
      }

      // Column: Lead Quality
      if (columnFilters.quality !== 'ALL') {
        const q = getLeadQualityText(lead);
        if (columnFilters.quality === 'NONE') {
          if (q !== '—') return false;
        } else if (q !== columnFilters.quality) {
          return false;
        }
      }

      // Column: Follow-up Date
      if (columnFilters.followUpDate) {
        const dateKey = toISTDateKey(lead.followUpDate || lead.createdTime || lead.createdAt);
        if (dateKey !== columnFilters.followUpDate) return false;
      }

      // Column: Follow-up Status
      if (columnFilters.followUpStatus !== 'ALL') {
        if (getFollowUpStatusText(lead) !== columnFilters.followUpStatus) return false;
      }

      // Column: Remarks
      if (remarksQuery) {
        const notesStr = (lead.notes || '').toLowerCase();
        if (!notesStr.includes(remarksQuery)) return false;
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
  }, [deskAndPlatformScopedLeads, statusFilter, searchTerm, sortBy, columnFilters, budgetMetaByLeadId]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, platformFilter, visaTypeFilter, pageSize, columnFilters]);

  // 3. Pagination Slicing for 1000s of records
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);



  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalLead) return;
    const targetStatusLabel = LEAD_STATUSES[statusForm.status]?.label || statusForm.status;
    try {
      await crmService.updateLeadStatus(statusModalLead.id, statusForm.status, statusForm.notes);
      setStatusModalLead(null);
      if (dossierLead && dossierLead.id === statusModalLead.id) {
        setDossierLead({ ...dossierLead, status: statusForm.status, notes: statusForm.notes });
      }
      await fetchLeads();

      showAlert({
        title: 'Status Updated',
        message: `Candidate status updated to "${targetStatusLabel}".`,
        icon: 'success',
        buttonText: 'Done',
        autoCloseMs: 2200,
      });
    } catch (err: any) {
      showAlert({
        title: 'Update Failed',
        message: err?.message || 'Server error while updating status.',
        icon: 'error',
        buttonText: 'OK',
      });
    }
  };

  const handleToggleContacted = async (leadItem: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyActive = leadItem.status !== 'CREATED' && leadItem.status !== 'LOST';
    const newStatus = isCurrentlyActive ? 'CREATED' : 'CONTACTED';
    const targetLabel = LEAD_STATUSES[newStatus]?.label || (newStatus === 'CONTACTED' ? 'Contacted' : 'New Lead');

    // Optimistically update raw leads
    setRawLeads((prev) =>
      prev.map((l) => (l.id === leadItem.id ? { ...l, status: newStatus } : l))
    );

    try {
      await crmService.updateLeadStatus(leadItem.id, newStatus);
      showAlert({
        title: 'Status Updated',
        message: `Candidate marked as "${targetLabel}".`,
        icon: 'success',
        buttonText: 'Done',
        autoCloseMs: 2000,
      });
    } catch (err: any) {
      // Revert on failure
      setRawLeads((prev) =>
        prev.map((l) => (l.id === leadItem.id ? { ...l, status: leadItem.status } : l))
      );
      showAlert({
        title: 'Update Failed',
        message: err?.message || 'Server error while updating status.',
        icon: 'error',
        buttonText: 'OK',
      });
    }
  };

  const handleDeleteLead = async (id: number | string, name?: string) => {
    const confirmed = await showConfirm({
      title: 'App',
      message: `Delete candidate lead #${id} (${name || 'record'})? This action cannot be undone.`,
      confirmText: 'Delete',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await crmService.deleteLead(id);
      if (dossierLead && dossierLead.id === id) setDossierLead(null);
      await fetchLeads();
    } catch (err: any) {
      showAlert({ title: 'App', message: `Delete failed: ${err?.message || 'Server error'}` });
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
        assignedTo: !isAdmin && currentUser?.login ? currentUser.login : undefined,
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
      showAlert({ title: 'App', message: `Failed to save candidate: ${err?.message || 'Server error'}` });
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

  const normalizePlatform = (
    val?: string,
    context?: string
  ): 'IG' | 'FB' | 'WHATSAPP' | 'OTHER' => {
    if (!val) return 'IG';
    const s = String(val).toUpperCase().trim();
    if (s === 'IG' || s === 'FB' || s === 'WHATSAPP' || s === 'OTHER') {
      return s as any;
    }
    if (s.includes('IG') || s.includes('INSTA')) return 'IG';
    if (s.includes('FB') || s.includes('FACEBOOK')) return 'FB';
    if (s.includes('WHATSAPP') || s.includes('WA')) return 'WHATSAPP';
    if (s.includes('META') || s.includes('ADS')) {
      const ctx = (context || '').toLowerCase();
      if (ctx.includes('ig') || ctx.includes('insta')) return 'IG';
      return 'FB';
    }
    return 'OTHER';
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError(null);

    // Pre-fetch all existing leads from DB so preview accurately flags duplicates upfront
    const dbLeads: any[] = [...rawLeads];
    try {
      const res = await crmService.getDetailedLeads();
      const list = Array.isArray(res) ? res : (res as any)?.content || [];
      if (Array.isArray(list) && list.length > 0) dbLeads.push(...list);
    } catch {
      // non-fatal
    }
    try {
      const pageRes = await crmService.getLeads(0, 1000);
      const pageList = Array.isArray(pageRes) ? pageRes : (pageRes as any)?.content || [];
      if (Array.isArray(pageList) && pageList.length > 0) dbLeads.push(...pageList);
    } catch {
      // non-fatal
    }

    const dbExtMap = new Map<string, any>();
    const dbPhoneMap = new Map<string, any>();
    dbLeads.forEach((l) => {
      const ext = (l.externalId || '').trim();
      if (ext) dbExtMap.set(ext, l);
      const p = (l.phoneNumber || l.customer?.phoneNumber || '').replace(/[^\d]/g, '');
      if (p.length >= 10) dbPhoneMap.set(p.slice(-10), l);
    });

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

          const rawPlat = getVal('platform', 'source', 'channel');
          const platform = normalizePlatform(rawPlat, `${adSetName} ${campaignName} ${formName}`);

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

          const cleanExt = (externalId || '').trim();
          const cleanP = (phone || '').replace(/[^\d]/g, '');
          const last10 = cleanP.length >= 10 ? cleanP.slice(-10) : '';

          let matchedLead: any;
          if (cleanExt && dbExtMap.has(cleanExt)) {
            matchedLead = dbExtMap.get(cleanExt);
          } else if (last10 && dbPhoneMap.has(last10)) {
            matchedLead = dbPhoneMap.get(last10);
          }

          const isDuplicate = Boolean(matchedLead);
          const duplicateReason = matchedLead
            ? matchedLead.externalId && String(matchedLead.externalId).trim() === cleanExt
              ? `Already saved in CRM (Lead #${matchedLead.id || 'Existing'})`
              : `Phone matches Lead #${matchedLead.id || 'Existing'}`
            : undefined;

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
            isDuplicate,
            duplicateReason,
            isValid: Boolean(name || phone),
          };
        });

        // Filter out blank/junk Excel rows (candidates must have a phone number or valid contact)
        const validCandidates = parsed.filter((r) => {
          const digits = (r.phone || '').replace(/[^\d]/g, '');
          const hasPhone = digits.length >= 7;
          const hasEmail = Boolean(r.email && r.email.includes('@'));
          const hasRealName = Boolean(r.name && !r.name.startsWith('Candidate #') && r.name.trim().length > 1);
          return hasPhone || (hasRealName && hasEmail);
        });

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
        await showAlert({
          title: 'App',
          message: `Server Ingestion Complete!\nProcessed: ${res.totalRowsProcessed || previewRows.length}, Successful: ${res.successfulRows || previewRows.length}, Failed: ${res.failedRows || 0}`,
        });
        return;
      } catch (serverErr: any) {
        const msg = serverErr?.response?.data?.message || serverErr?.message || 'Server upload failed';
        const fallbackDirect = await showConfirm({
          title: 'App',
          message: `Server upload endpoint returned:\n"${msg}"\n\nWould you like to proceed with Direct Browser Ingestion directly into your database instead?`,
          confirmText: 'Continue',
        });
        if (!fallbackDirect) {
          setImportLoading(false);
          return;
        }
        // Fall through to direct ingestion
      }
    }

    // Option B: Direct Browser-to-DB Ingestion with Duplicate Protection
    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    // Build fresh set of existing external IDs and phone numbers from database
    const existingExtIds = new Set<string>();
    const existingPhoneSet = new Set<string>();
    const phoneToCustomerMap = new Map<string, any>();

    try {
      const allLeads = await crmService.getDetailedLeads();
      const list = Array.isArray(allLeads) ? allLeads : (allLeads as any)?.content || [];
      list.forEach((l: any) => {
        if (l.externalId) existingExtIds.add(String(l.externalId).trim());
        const p = (l.phoneNumber || l.customer?.phoneNumber || '').replace(/[^\d]/g, '');
        if (p.length >= 10) existingPhoneSet.add(p.slice(-10));
      });
    } catch {
      // non-fatal
    }

    try {
      const pageRes = await crmService.getLeads(0, 1000);
      const pageList = Array.isArray(pageRes) ? pageRes : (pageRes as any)?.content || [];
      pageList.forEach((l: any) => {
        if (l.externalId) existingExtIds.add(String(l.externalId).trim());
        const p = (l.phoneNumber || l.customer?.phoneNumber || '').replace(/[^\d]/g, '');
        if (p.length >= 10) existingPhoneSet.add(p.slice(-10));
      });
    } catch {
      // non-fatal
    }

    rawLeads.forEach((l: any) => {
      if (l.externalId) existingExtIds.add(String(l.externalId).trim());
      const p = (l.phoneNumber || l.customer?.phoneNumber || '').replace(/[^\d]/g, '');
      if (p.length >= 10) existingPhoneSet.add(p.slice(-10));
    });

    // Fetch existing customers so we can REUSE existing customer IDs instead of creating duplicate customer records
    try {
      const custRes = await crmService.getCustomers(0, 500);
      const custList = Array.isArray(custRes) ? custRes : (custRes as any)?.content || [];
      custList.forEach((c: any) => {
        const p = (c.phoneNumber || c.rawPhoneNumber || c.phone || '').replace(/[^\d]/g, '');
        if (p.length >= 10 && c.id) {
          phoneToCustomerMap.set(p.slice(-10), c.id);
        }
      });
    } catch {
      // non-fatal
    }

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      const rowExt = (row.externalId || '').trim();
      const rowPhone = (row.phone || '').replace(/[^\d]/g, '');
      const last10 = rowPhone.length >= 10 ? rowPhone.slice(-10) : '';

      const isKnownDuplicate =
        row.isDuplicate ||
        Boolean(rowExt && existingExtIds.has(rowExt)) ||
        Boolean(last10 && existingPhoneSet.has(last10));

      // If user enabled "Skip duplicate records", bypass insert entirely - 0 API calls!
      if (skipDuplicates && isKnownDuplicate) {
        skippedCount++;
        setImportProgress({ current: i + 1, total: previewRows.length });
        continue;
      }

      try {
        const targetVisaType =
          excelDefaultVisaType === 'AUTO'
            ? row.visaType || 'WORK_VISA'
            : excelDefaultVisaType || row.visaType || 'WORK_VISA';

        // Effective phone number guaranteed non-null (satisfies backend Customer @NotNull validation)
        const effectivePhone =
          (row.phone || '').trim() ||
          (last10 ? `+91${last10}` : `+910000${String(100000 + i).slice(-6)}`);

        // Check if a customer record with this phone number already exists to avoid redundant createCustomer API calls
        let customerId: any = last10 ? phoneToCustomerMap.get(last10) : undefined;
        if (!customerId) {
          const customer = await crmService.createCustomer({
            fullName: row.name || 'Candidate Lead',
            name: row.name || 'Candidate Lead',
            phoneNumber: effectivePhone,
            phone: effectivePhone,
            rawPhoneNumber: effectivePhone,
            email: row.email || undefined,
            location: row.city || undefined,
            city: row.city || undefined,
          } as any);
          customerId = customer.id;
          if (last10 && customerId) {
            phoneToCustomerMap.set(last10, customerId);
          }
        }

        const targetPlatform = normalizePlatform(
          row.platform,
          `${row.adSetName || ''} ${row.campaignName || ''} ${row.formName || ''}`
        );

        const assignedStaffLogin = !isAdmin && currentUser?.login ? currentUser.login : undefined;

        const newLead = await crmService.createLead({
          externalId: row.externalId || ('meta_' + Date.now() + '_' + i),
          createdTime: row.createdTime || new Date().toISOString(),
          platform: targetPlatform,
          status: 'CREATED',
          isOrganic: row.isOrganic ?? false,
          visaType: targetVisaType,
          campaignName: row.campaignName,
          adSetName: row.adSetName,
          adName: row.adName,
          leadFormName: row.formName,
          notes: row.rawNotes || undefined,
          assignedTo: assignedStaffLogin,
          customer: { id: customerId },
          customerId: customerId,
        } as any);

        try {
          await crmService.createLeadPreference({
            lead: { id: newLead.id },
            leadId: newLead.id,
            visaType: targetVisaType,
            educationalQualification: row.qualification || EDUCATION_QUALIFICATIONS[2],
            age: row.age || AGE_BRACKETS[0],
            notes: row.surveyCgpa ? `CGPA: ${row.surveyCgpa}` : undefined,
          });
        } catch {
          // preference non-fatal
        }

        successCount++;
        if (rowExt) existingExtIds.add(rowExt);
        if (last10) existingPhoneSet.add(last10);
      } catch (rowErr: any) {
        const errMsg = String(
          rowErr?.response?.data?.message ||
          rowErr?.response?.data?.detail ||
          rowErr?.response?.data?.title ||
          rowErr?.message ||
          ''
        );
        const isConstraint =
          errMsg.includes('ux_lead__external_id') ||
          errMsg.includes('duplicate key') ||
          errMsg.includes('unique constraint') ||
          rowErr?.response?.status === 409 ||
          (rowErr?.response?.status === 500 &&
            (errMsg.includes('constraint') || errMsg.includes('external_id') || errMsg.includes('Failure during data access')));

        if (isConstraint) {
          skippedCount++;
        } else {
          failCount++;
        }
      }
      setImportProgress({ current: i + 1, total: previewRows.length });
    }

    setImportLoading(false);
    setShowAddModal(false);
    setPreviewRows([]);
    setImportFile(null);
    window.dispatchEvent(new CustomEvent('crm-data-updated'));
    await fetchLeads();

    if (successCount === 0 && skippedCount > 0 && failCount === 0) {
      await showAlert({
        title: 'App',
        message: `All ${skippedCount} candidate leads in this spreadsheet already exist in your CRM database.\n\nDuplicate records were safely skipped without any database conflicts.`,
      });
    } else {
      await showAlert({
        title: 'App',
        message: `Import Summary:\n• ${successCount} new candidate lead${successCount === 1 ? '' : 's'} created\n• ${skippedCount} duplicate lead${skippedCount === 1 ? '' : 's'} skipped${
          failCount > 0 ? `\n• ${failCount} entries had unexpected errors` : ''
        }`,
      });
    }
  };

  const formatDate = (isoStr?: string): string => {
    if (!isoStr) return '—';
    return formatIndianDateTime(isoStr, { fallback: isoStr });
  };

  const renderVisaBadge = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'WORK_VISA') {
      return (
        <span className="text-xs font-medium text-[#1c1c1e]">
          Work Visa
        </span>
      );
    }
    if (t === 'STUDY_VISA') {
      return (
        <span className="text-xs font-medium text-[#1c1c1e]">
          Study Visa
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-[#1c1c1e]">
        {t === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}
      </span>
    );
  };

  const renderStageBadge = (leadItem: Lead) => {
    const s = (leadItem.status || 'CREATED').toUpperCase();
    let label = 'New Lead';
    let dotColor = 'bg-slate-400';
    let textColor = 'text-slate-700';

    if (s === 'CONTACTED') {
      label = 'Contacted';
      dotColor = 'bg-[#007aff]';
      textColor = 'text-[#007aff]';
    } else if (s === 'QUALIFIED') {
      label = 'Qualified';
      dotColor = 'bg-[#5856d6]';
      textColor = 'text-[#5856d6]';
    } else if (s === 'CONVERTED') {
      label = 'Converted';
      dotColor = 'bg-[#34c759]';
      textColor = 'text-emerald-700 font-semibold';
    } else if (s === 'WON') {
      label = 'Visa Approved';
      dotColor = 'bg-[#34c759]';
      textColor = 'text-emerald-700 font-semibold';
    } else if (s === 'PROPOSAL_SENT') {
      label = 'Docs Requested';
      dotColor = 'bg-[#0284c7]';
      textColor = 'text-[#0284c7]';
    } else if (s === 'NEGOTIATION') {
      label = 'In Process';
      dotColor = 'bg-[#ff9500]';
      textColor = 'text-[#ff9500]';
    } else if (s === 'LOST') {
      label = 'Lost / Closed';
      dotColor = 'bg-[#ff3b30]';
      textColor = 'text-[#ff3b30]';
    }

    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setStatusModalLead(leadItem);
          setStatusForm({
            status: leadItem.status || 'CONTACTED',
            notes: leadItem.notes || '',
          });
        }}
        className="text-xs hover:underline cursor-pointer"
        title="Click to update stage"
      >
        <span className={textColor}>{label}</span>
      </span>
    );
  };

  const getLeadQuality = useCallback((leadItem: Lead): string => {
    return getLeadQualityText(leadItem);
  }, []);

  const getBudgetReady = useCallback(
    (leadItem: Lead): React.ReactNode => {
      const meta = budgetMetaByLeadId.get(leadItem.id) ?? getLeadBudgetDetails(leadItem);
      const { formattedBudget, paymentStatus, fallbackLabel } = meta;

      if (formattedBudget || (paymentStatus && paymentStatus !== 'UNPAID')) {
        return (
          <div className="flex flex-col items-start gap-1">
            {formattedBudget && <span className="font-semibold text-[#007aff]">{formattedBudget}</span>}
            {paymentStatus === 'PAID' && (
              <span className="text-[11px] font-semibold text-emerald-700">
                Paid
              </span>
            )}
            {paymentStatus === 'PARTIAL' && (
              <span className="text-[11px] font-medium text-amber-700">
                Partial
              </span>
            )}
          </div>
        );
      }

      return fallbackLabel;
    },
    [budgetMetaByLeadId]
  );

  const getCounselorDisplayName = (leadItem: Lead): string => {
    // 1. If explicitly assigned in lead record, return staff name if matched or the login
    if (leadItem.assignedTo && leadItem.assignedTo.trim() !== '' && leadItem.assignedTo !== 'Unassigned') {
      const match = availableStaff.find(
        (s) => s.login.toLowerCase() === leadItem.assignedTo?.toLowerCase()
      );
      return match?.name || leadItem.assignedTo;
    }

    // 2. If staff/counselor is logged in (!isAdmin), display current counselor's name or role
    if (!isAdmin && currentUser) {
      const staffFullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
      if (staffFullName) return staffFullName;
      if (currentUser.login && currentUser.login !== 'user') return currentUser.login;
      if (isWorkVisa) return 'Work Visa Counselor';
      if (isStudyVisa) return 'Study Visa Counselor';
      if (isOtherVisa) return 'Other Visa Counselor';
      return roleBadge.label || 'Assigned Counselor';
    }

    // 3. For Admin view: infer primary counselor from visa program / role desk
    if (isWorkVisaType(leadItem.visaType)) {
      const workStaff = availableStaff.find(
        (s) => s.login.toLowerCase().includes('work') || (s.name || '').toLowerCase().includes('work')
      );
      return workStaff?.name || 'Work Visa Counselor';
    }
    if (isStudyVisaType(leadItem.visaType)) {
      const studyStaff = availableStaff.find(
        (s) => s.login.toLowerCase().includes('study') || (s.name || '').toLowerCase().includes('study')
      );
      return studyStaff?.name || 'Study Visa Counselor';
    }
    if (isOtherVisaType(leadItem.visaType)) {
      const otherStaff = availableStaff.find(
        (s) => s.login.toLowerCase().includes('other') || (s.name || '').toLowerCase().includes('other')
      );
      return otherStaff?.name || 'Other Visa Counselor';
    }

    return 'Unassigned';
  };

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
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/[0.05] text-[#3c3c43] whitespace-nowrap shrink-0">
              {filteredLeads.length}
            </span>
          </div>
          <p className="text-[12px] text-[#8e8e93] mt-0.5">
            Overseas Immigration & Admissions Global Directory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setModalTab('excel');
              setShowAddModal(true);
            }}
            className="zoho-btn"
            title="Import candidate leads directly from Excel or CSV spreadsheet"
          >
            <FileSpreadsheet size={13} className="text-[#1366d9]" />
            <span>Import Excel</span>
          </button>


          <button
            onClick={() => fetchLeads()}
            disabled={loading}
            className="zoho-btn px-2.5"
            title="Refresh candidates"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#1366d9]' : 'text-slate-500'} />
          </button>

          <button
            onClick={() => {
              setModalTab('manual');
              setShowAddModal(true);
            }}
            className="zoho-btn-primary"
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
              <option value="OTHER">Direct / Walk-in</option>
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
            All Candidates ({deskAndPlatformScopedLeads.length})
          </button>
          {LEAD_STATUS_LIST.map((st) => {
            const count = deskAndPlatformScopedLeads.filter((l) => (l.status || 'CREATED') === st.value).length;
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

          {/* Apple HIG Segmented View Toggle (List vs Table) */}
          <div className="inline-flex items-center p-0.5 bg-black/[0.05] rounded-[9px] text-xs font-medium shrink-0 ml-auto border border-black/[0.03]">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                localStorage.setItem('ssa_leads_view_mode_v2', 'list');
                localStorage.setItem('ssa_leads_view_mode', 'list');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-2xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
              title="Apple HIG Grouped List View"
            >
              <LayoutList size={13} strokeWidth={2} />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                localStorage.setItem('ssa_leads_view_mode_v2', 'table');
                localStorage.setItem('ssa_leads_view_mode', 'table');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#1d1d1f] font-semibold shadow-2xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
              title="Multi-column Table View"
            >
              <Table size={13} strokeWidth={2} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>



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

      {/* ── Apple HIG Lists and Tables (https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) ── */}
      {viewMode === 'list' ? (
        /* ── Full Cross-Device Apple Inset Grouped List View ── */
        <div className="space-y-2.5">
          {activeColumnFilterCount > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.06] text-[13px] font-sf">
              <span className="text-[#3c3c43]">
                Filtered to {filteredLeads.length} of {deskAndPlatformScopedLeads.length} candidates
              </span>
              <button
                type="button"
                onClick={() => clearColumnFilters(false)}
                className="text-[#007aff] font-normal hover:opacity-70 transition-opacity cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
          <IosLeadList
            leads={paginatedLeads}
            loading={loading}
            totalLeads={filteredLeads.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            onToggleContacted={handleToggleContacted}
            onOpenStatusModal={(lead, e) => {
              e.stopPropagation();
              setStatusModalLead(lead);
              setStatusForm({
                status: lead.status || 'CONTACTED',
                notes: lead.notes || '',
              });
            }}
            onDeleteLead={handleDeleteLead}
            getLeadQuality={getLeadQuality}
            getBudgetReady={getBudgetReady}
            formatDate={formatDate}
          />
        </div>
      ) : (
        /* ── Candidate Table Directory (Responsive with smooth horizontal scroll) ── */
        <div className="space-y-2.5">
            {/* Apple HIG Grouped Table View Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 font-sf select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[12px] font-semibold tracking-wider text-[#6e6e73] uppercase whitespace-nowrap">
                  Candidate Table Directory
                </span>
                <span className="text-[12px] font-normal text-[#86868b] bg-black/[0.04] px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                  {activeColumnFilterCount > 0 && filteredLeads.length !== deskAndPlatformScopedLeads.length
                    ? `${filteredLeads.length} of ${deskAndPlatformScopedLeads.length}`
                    : `${filteredLeads.length} ${filteredLeads.length === 1 ? 'candidate' : 'candidates'}`}
                </span>
              </div>

              <div className="flex items-center gap-4 ml-auto shrink-0">
                {activeColumnFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => clearColumnFilters(false)}
                    className="text-[13px] font-normal text-[#007aff] hover:opacity-70 active:opacity-50 transition-opacity cursor-pointer whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
                {hasCustomColumnWidths && (
                  <button
                    type="button"
                    onClick={resetColumnWidths}
                    className="text-[13px] font-normal text-[#007aff] hover:opacity-70 active:opacity-50 transition-opacity cursor-pointer whitespace-nowrap"
                  >
                    Reset Widths
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleColumnFiltersRow}
                  className="text-[13px] font-normal text-[#007aff] hover:opacity-70 active:opacity-50 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  {showColumnFilters ? 'Hide Filters' : 'Filters'}
                </button>
                <span className="text-[12px] font-normal text-[#86868b] whitespace-nowrap">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </div>

            {/* Apple HIG Inset Grouped Table Container */}
            <div className="bg-white rounded-[18px] sm:rounded-[22px] border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden font-sf">
              <div className="overflow-x-auto">
                <table
                  ref={tableRef}
                  style={{ width: `${totalTableWidth}px` }}
                  className="text-left text-xs border-collapse table-fixed"
                >
                  <colgroup>
                    {TABLE_COLUMNS.map((col) => (
                      <col key={col.key} style={{ width: `${columnWidths[col.key]}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-[#fbfbfd] border-b border-black/[0.06] text-[12px] font-medium text-[#8e8e93] select-none">
                      {TABLE_COLUMNS.map((col) => {
                        const isColFiltered =
                          (col.key === 'leadSource' && platformFilter !== 'ALL') ||
                          (col.key === 'campaignName' && columnFilters.campaignName !== 'ALL') ||
                          (col.key === 'candidateName' && columnFilters.candidateName.trim().length > 0) ||
                          (col.key === 'mobileNumber' && columnFilters.mobileNumber.trim().length > 0) ||
                          (col.key === 'whatsapp' && columnFilters.whatsapp !== 'ALL') ||
                          (col.key === 'city' && columnFilters.city.trim().length > 0) ||
                          (col.key === 'budget' && columnFilters.budget !== 'ALL') ||
                          (col.key === 'quality' && columnFilters.quality !== 'ALL') ||
                          (col.key === 'followUpDate' && Boolean(columnFilters.followUpDate)) ||
                          (col.key === 'followUpStatus' && columnFilters.followUpStatus !== 'ALL') ||
                          (col.key === 'currentStage' && statusFilter !== 'ALL') ||
                          (col.key === 'remarks' && columnFilters.remarks.trim().length > 0);

                        return (
                          <th
                            key={col.key}
                            className={`py-3 px-3.5 whitespace-nowrap relative border-r border-black/[0.06] last:border-r-0 overflow-hidden ${
                              col.alignRight ? 'text-right' : ''
                            } ${isColFiltered ? 'text-[#1c1c1e] font-semibold' : ''}`}
                          >
                            <div className={`truncate ${col.alignRight ? 'pr-1' : 'pr-1.5'}`}>
                              {col.label}
                            </div>
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={`Resize ${col.label} column`}
                              title="Drag to resize · Double-click to fit"
                              onPointerDown={(e) => handleStartColumnResize(col.key, e)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleAutoFitColumn(col.key);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-10 flex justify-end group/resize touch-none"
                            >
                              <span
                                className={`h-full transition-colors ${
                                  resizingCol === col.key
                                    ? 'w-[2px] bg-[#007aff]'
                                    : 'w-[2px] bg-transparent group-hover/resize:bg-[#007aff]/60'
                                }`}
                              />
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    {showColumnFilters && (
                      <tr className="bg-[#fbfbfd] border-b border-black/[0.06]">
                        <TableSelectFilterCell
                          value={platformFilter}
                          onChange={setPlatformFilter}
                          ariaLabel="Filter by Lead Source"
                          options={[
                            { value: 'ALL', label: 'All' },
                            { value: 'IG', label: 'Instagram' },
                            { value: 'FB', label: 'Facebook' },
                            { value: 'WHATSAPP', label: 'WhatsApp' },
                            { value: 'OTHER', label: 'Direct / Walk-in' },
                          ]}
                        />
                        <TableSelectFilterCell
                          value={columnFilters.campaignName}
                          onChange={(val) => updateColumnFilter('campaignName', val)}
                          ariaLabel="Filter by Campaign Name"
                          options={campaignFilterOptions}
                        />
                        <TableTextFilterCell
                          value={columnFilters.candidateName}
                          onChange={(val) => updateColumnFilter('candidateName', val)}
                          placeholder="Search"
                          ariaLabel="Filter by Candidate Name"
                        />
                        <TableTextFilterCell
                          value={columnFilters.mobileNumber}
                          onChange={(val) => updateColumnFilter('mobileNumber', val)}
                          placeholder="Search"
                          ariaLabel="Filter by Mobile Number"
                        />
                        <TableSelectFilterCell
                          value={columnFilters.whatsapp}
                          onChange={(val) => updateColumnFilter('whatsapp', val)}
                          ariaLabel="Filter by WhatsApp Number"
                          options={[
                            { value: 'ALL', label: 'All' },
                            { value: 'YES', label: 'Yes' },
                            { value: 'NO', label: 'None (—)' },
                          ]}
                        />
                        <TableTextFilterCell
                          value={columnFilters.city}
                          onChange={(val) => updateColumnFilter('city', val)}
                          placeholder="Search"
                          ariaLabel="Filter by City"
                        />
                        <TableSelectFilterCell
                          value={columnFilters.budget}
                          onChange={(val) => updateColumnFilter('budget', val)}
                          ariaLabel="Filter by Budget / Payment"
                          options={budgetFilterOptions}
                        />
                        <TableSelectFilterCell
                          value={columnFilters.quality}
                          onChange={(val) => updateColumnFilter('quality', val)}
                          ariaLabel="Filter by Lead Quality"
                          options={[
                            { value: 'ALL', label: 'All' },
                            { value: 'Hot', label: 'Hot' },
                            { value: 'Warm', label: 'Warm' },
                            { value: 'Cold', label: 'Cold' },
                            { value: 'NONE', label: 'Not Set (—)' },
                          ]}
                        />
                        <th className="py-2 px-2 align-middle font-normal overflow-hidden border-r border-black/[0.04] last:border-r-0">
                          <div className="flex items-center gap-1 w-full min-w-0">
                            <input
                              type="date"
                              value={columnFilters.followUpDate}
                              onChange={(e) => updateColumnFilter('followUpDate', e.target.value)}
                              aria-label="Filter by Follow-up Date"
                              className={`font-sf h-[30px] flex-1 min-w-0 px-2 rounded-[8px] text-[12px] border transition-colors focus:outline-none focus:bg-white focus:border-[#007aff]/50 ${
                                columnFilters.followUpDate
                                  ? 'bg-white border-black/[0.16] text-[#1c1c1e] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                                  : 'bg-[#767680]/[0.08] hover:bg-[#767680]/[0.12] border-transparent text-[#3c3c43] font-normal'
                              }`}
                            />
                            {columnFilters.followUpDate && (
                              <button
                                type="button"
                                onClick={() => updateColumnFilter('followUpDate', '')}
                                title="Clear Follow-up Date"
                                className="text-[#8e8e93] hover:text-[#1c1c1e] p-1 cursor-pointer shrink-0"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </th>
                        <TableSelectFilterCell
                          value={columnFilters.followUpStatus}
                          onChange={(val) => updateColumnFilter('followUpStatus', val)}
                          ariaLabel="Filter by Follow-up Status"
                          options={followUpStatusFilterOptions}
                        />
                        <TableSelectFilterCell
                          value={statusFilter}
                          onChange={setStatusFilter}
                          ariaLabel="Filter by Current Stage"
                          options={[
                            { value: 'ALL', label: 'All' },
                            ...LEAD_STATUS_LIST.map((st) => ({ value: st.value, label: st.label })),
                          ]}
                        />
                        <TableTextFilterCell
                          value={columnFilters.remarks}
                          onChange={(val) => updateColumnFilter('remarks', val)}
                          placeholder="Search"
                          ariaLabel="Filter by Remarks"
                        />
                        <th className="py-2 px-3.5 text-right align-middle font-normal overflow-hidden">
                          {activeColumnFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => clearColumnFilters(false)}
                              className="text-[12px] font-normal text-[#007aff] hover:opacity-70 transition-opacity cursor-pointer whitespace-nowrap"
                            >
                              Reset
                            </button>
                          )}
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {paginatedLeads.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-12 text-center text-[#8e8e93]">
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <RefreshCw size={15} className="animate-spin text-[#1c1c1e]" />
                              Loading candidates...
                            </span>
                          ) : (
                            <div className="space-y-2">
                              <div>
                                <p className="text-[#1c1c1e] font-semibold text-sm">No candidate records match your criteria</p>
                                <p className="text-[#8e8e93] text-xs mt-1">
                                  Try clearing filters or search keywords, or ingest new records from Meta ads.
                                </p>
                              </div>
                              {(activeColumnFilterCount > 0 || searchTerm.trim().length > 0) && (
                                <button
                                  type="button"
                                  onClick={() => clearColumnFilters(true)}
                                  className="text-[13px] font-medium text-[#007aff] hover:opacity-70 transition-opacity cursor-pointer"
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedLeads.map((lead) => {
                        const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                            className="hover:bg-[#007aff]/[0.02] transition-colors cursor-pointer group"
                          >
                            {/* Lead Source */}
                            <td data-col="leadSource" className="py-3 px-3.5 whitespace-nowrap overflow-hidden">
                              <span className="font-semibold text-xs text-[#1c1c1e] block truncate" title={plat.label}>
                                {plat.label}
                              </span>
                            </td>

                            {/* Campaign Name */}
                            <td data-col="campaignName" className="py-3 px-3.5 overflow-hidden">
                              <div className="font-medium text-[#1c1c1e] text-xs truncate w-full" title={lead.campaignName || '—'}>
                                {lead.campaignName || '—'}
                              </div>
                            </td>

                            {/* Candidate Name */}
                            <td data-col="candidateName" className="py-3 px-3.5 overflow-hidden">
                              <div className="font-semibold text-[13px] text-[#1c1c1e] group-hover:text-[#007aff] transition-colors truncate" title={lead.customerName || `Candidate #${lead.id}`}>
                                {lead.customerName || `Candidate #${lead.id}`}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] mt-0.5 min-w-0">
                                {lead.email && <span className="truncate">{lead.email}</span>}
                                {lead.email && <span className="shrink-0">·</span>}
                                <span className="font-sf-mono text-[10px] truncate">
                                  {lead.externalId ? lead.externalId : `#${lead.id}`}
                                </span>
                              </div>
                            </td>

                            {/* Mobile Number */}
                            <td data-col="mobileNumber" className="py-3 px-3.5 whitespace-nowrap overflow-hidden">
                              <span className="font-sf-mono text-[12px] text-[#1c1c1e] font-medium tracking-tight block truncate" title={lead.phoneNumber || '—'}>
                                {lead.phoneNumber || '—'}
                              </span>
                            </td>

                            {/* WhatsApp Number */}
                            <td data-col="whatsapp" className="py-3 px-3.5 whitespace-nowrap overflow-hidden text-xs text-[#1c1c1e]">
                              <span className="block truncate">{lead.phoneNumber ? 'Yes' : '—'}</span>
                            </td>

                            {/* City */}
                            <td data-col="city" className="py-3 px-3.5 whitespace-nowrap overflow-hidden">
                              <span className="text-xs text-[#1c1c1e] capitalize block truncate" title={lead.city || lead.location || '—'}>
                                {lead.city || lead.location || '—'}
                              </span>
                            </td>

                            {/* Budget Ready */}
                            <td data-col="budget" className="py-3 px-3.5 whitespace-nowrap overflow-hidden text-xs text-[#1c1c1e]">
                              {getBudgetReady(lead)}
                            </td>

                            {/* Lead Quality */}
                            <td data-col="quality" className="py-3 px-3.5 whitespace-nowrap overflow-hidden text-xs text-[#1c1c1e]">
                              {(() => {
                                const q = getLeadQuality(lead);
                                if (q === 'Hot') {
                                  return (
                                    <span className="text-xs font-semibold text-[#ff3b30] block truncate">
                                      Hot
                                    </span>
                                  );
                                }
                                if (q === 'Warm') {
                                  return (
                                    <span className="text-xs font-semibold text-[#ff9500] block truncate">
                                      Warm
                                    </span>
                                  );
                                }
                                if (q === 'Cold') {
                                  return (
                                    <span className="text-xs font-medium text-[#8e8e93] block truncate">
                                      Cold
                                    </span>
                                  );
                                }
                                return <span className="text-xs text-[#8e8e93] block truncate">—</span>;
                              })()}
                            </td>

                            {/* Follow-up Date */}
                            <td data-col="followUpDate" className="py-3 px-3.5 text-[#64748b] text-[11px] whitespace-nowrap font-normal overflow-hidden text-ellipsis" title={formatDate(lead.followUpDate || lead.createdTime || lead.createdAt)}>
                              {formatDate(lead.followUpDate || lead.createdTime || lead.createdAt)}
                            </td>

                            {/* Follow-up Status */}
                            <td data-col="followUpStatus" className="py-3 px-3.5 whitespace-nowrap overflow-hidden">
                              <span className="text-xs font-medium text-[#1c1c1e] block truncate" title={getFollowUpStatusText(lead)}>
                                {getFollowUpStatusText(lead)}
                              </span>
                            </td>

                            {/* Current Stage */}
                            <td data-col="currentStage" className="py-3 px-3.5 whitespace-nowrap overflow-hidden text-ellipsis">
                              {renderStageBadge(lead)}
                            </td>

                            {/* Remarks */}
                            <td data-col="remarks" className="py-3 px-3.5 overflow-hidden">
                              <div className="text-[11px] text-[#475569] truncate w-full" title={lead.notes || '—'}>
                                {lead.notes || '—'}
                              </div>
                            </td>

                            {/* Outreach & Actions (Clean macOS Style Icon Buttons with Chevron) */}
                            <td data-col="actions" className="py-3 px-3.5 text-right overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
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

                                {/* Apple Disclosure Chevron */}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                                  title="Open Candidate Profile"
                                  className="p-1 text-[#c7c7cc] group-hover:text-[#007aff] transition-colors ml-0.5"
                                >
                                  <ChevronRight size={16} strokeWidth={2.4} />
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

            {/* Apple HIG Grouped Table View Footer */}
            <div className="px-3 text-[12px] text-[#8e8e93] flex items-center justify-between select-none">
              <span>Select any row to inspect complete dossier, visa milestones, and timeline.</span>
              <span>Showing {filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} records</span>
            </div>
          </div>
      )}

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
                      navigate(`/leads/${encryptLeadId(cid)}`);
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

      {/* Quick Status Update Modal (Apple HIG Glass Sheet UI) */}
      {statusModalLead && (
        <div className="ios-modal-backdrop">
          <div className="ios-modal-card max-w-lg animate-in zoom-in-95">
            <div className="ios-sheet-grabber" />
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                Update Stage
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalLead(null)}
                className="w-7 h-7 rounded-full bg-black/[0.05] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.1] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={15} />
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
                    {formatIndianDate(new Date())}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {formatIndianTime(new Date())}
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



      {/* Create New Candidate Modal (Zoho CRM Enterprise Intake & Meta Import) */}
      {showAddModal && (
        <div className="ios-modal-backdrop">
          <div
            className={`ios-material-thick rounded-3xl border border-black/[0.08] shadow-2xl ${
              modalTab === 'excel' && previewRows.length > 0 ? 'max-w-5xl' : 'max-w-xl'
            } w-full my-auto transition-all duration-150 overflow-hidden flex flex-col`}
          >
            {/* Grabber handle */}
            <div className="pt-3 pb-1">
              <div className="ios-sheet-grabber" />
            </div>

            {/* Modal Header */}
            <div className="px-6 py-3 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1c1c1e] leading-tight tracking-tight">
                  {modalTab === 'manual' ? 'Candidate Intake' : 'Import Leads from Spreadsheet'}
                </h3>
                <p className="text-[12px] text-[#8e8e93] mt-0.5">
                  {modalTab === 'manual'
                    ? 'Record individual candidate lead information'
                    : 'Ingest and map Meta Ads Manager lead spreadsheets'}
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
                className="w-7 h-7 rounded-full bg-black/[0.05] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.1] flex items-center justify-center transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X size={15} />
              </button>
            </div>

            {/* Apple Segmented Tabs */}
            <div className="px-6 py-2.5 border-b border-black/[0.06] bg-black/[0.02]">
              <div className="ios-segmented">
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('manual');
                    setImportError(null);
                  }}
                  className={`ios-segmented-btn ${modalTab === 'manual' ? 'active' : ''}`}
                >
                  Single Candidate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('excel');
                  }}
                  className={`ios-segmented-btn flex items-center gap-1.5 ${modalTab === 'excel' ? 'active' : ''}`}
                >
                  <FileSpreadsheet size={13} />
                  <span>Import from Spreadsheet</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Manual Single Candidate Intake Form (Zoho CRM Modal & Field UI) */}
            {modalTab === 'manual' && (
              <div className="p-6">
                <form onSubmit={handleCreateLead} className="text-xs">
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
                    <div className="flex-1 flex rounded overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                      <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                        {formatIndianDate(new Date())}
                      </div>
                      <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                        {formatIndianTime(new Date())}
                      </div>
                    </div>
                  </div>

                  {/* Action Confirmation Footer */}
                  <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-200">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="zoho-btn-done"
                    >
                      {submitting ? 'Saving...' : 'Done'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: Import from Excel Sheet with Instant Preview */}
            {modalTab === 'excel' && (
              <div className="p-6 space-y-4 text-xs">
                {importError && (
                  <div className="p-3 rounded bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-amber-700" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* State A: File not chosen yet -> Clean Enterprise Dropzone */}
                {previewRows.length === 0 ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 rounded-md p-8 bg-slate-50/50 hover:bg-blue-50/20 hover:border-blue-400 transition-colors text-center relative cursor-pointer">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleExcelFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center">
                        <div className="w-11 h-11 rounded bg-blue-50 text-[#1e88e5] border border-blue-100 flex items-center justify-center mb-2.5">
                          <FileSpreadsheet size={22} />
                        </div>
                        <p className="font-semibold text-sm text-slate-900">
                          Select or Drag & Drop Excel / CSV Spreadsheet
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Supports export files from Meta Ads Manager (Facebook, Instagram) and WhatsApp (.xlsx, .xls, .csv).
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-md">
                          <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Meta Lead Ads Compatible
                          </span>
                          <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Auto-detects Work / Study Visa
                          </span>
                          <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            IG & FB Form Questions
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Template Download Option */}
                    <div className="flex items-center justify-between p-3.5 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Sample Meta Ads Spreadsheet Template</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Download our pre-formatted spreadsheet template with sample candidates and Meta columns.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadSampleTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 ml-3"
                      >
                        <Download size={13} className="text-[#1e88e5]" />
                        <span>Download Template</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          if (searchParams.get('action') === 'create' || searchParams.get('action') === 'import') {
                            navigate('/leads', { replace: true });
                          }
                        }}
                        className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-2xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* State B: Sheet Uploaded -> Clean Zoho CRM Table & Confirmation */
                  <div className="space-y-3.5">
                    {/* File & Mapping Setup Bar */}
                    <div className="bg-[#fcfdfd] border border-[#dbe3eb] rounded-[4px] p-3.5 space-y-3">
                      {/* Top row: File info and change button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5e7eb]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-[4px] bg-[#f0f4f9] text-[#475569] flex items-center justify-center shrink-0 border border-[#d6e0ec]">
                            <FileSpreadsheet size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[13px] text-[#1e293b] truncate max-w-sm" title={importFile?.name}>
                                {importFile?.name || 'Spreadsheet File'}
                              </span>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-[3px] bg-[#f0f4f9] text-[#2c3e50] border border-[#cbd5e1]">
                                {previewRows.length} Records Found
                              </span>
                            </div>
                            <p className="text-[11px] text-[#64748b] mt-0.5">
                              Meta Lead Ads headers resolved • Ready for CRM intake
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewRows([]);
                            setImportFile(null);
                          }}
                          className="zoho-btn zoho-btn-sm self-start sm:self-auto"
                        >
                          Change File
                        </button>
                      </div>

                      {/* Duplicate Warning Banner */}
                      {duplicateStats.hasDuplicates && (
                        <div className="bg-[#fffbf0] border border-[#f5dfa8] rounded-[4px] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-start sm:items-center gap-2">
                            <AlertCircle size={15} className="text-[#b45309] shrink-0 mt-0.5 sm:mt-0" />
                            <div>
                              <span className="font-medium text-[#78350f] text-[12px]">
                                {duplicateStats.duplicateCount} of {previewRows.length} candidates already exist in CRM database
                              </span>
                              <p className="text-[11px] text-[#92400e] mt-0.5">
                                {duplicateStats.allDuplicates
                                  ? 'All leads in this spreadsheet match existing database entries. Skipping will prevent unique constraint conflicts.'
                                  : `${duplicateStats.newCount} new records found. Duplicates will be safely skipped.`}
                              </p>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-[4px] border border-[#d9c595] text-[#2c3e50] text-[12px] font-medium shrink-0 shadow-2xs select-none">
                            <input
                              type="checkbox"
                              checked={skipDuplicates}
                              onChange={(e) => setSkipDuplicates(e.target.checked)}
                              className="rounded text-[#1366d9] cursor-pointer"
                            />
                            <span>Skip duplicate records</span>
                          </label>
                        </div>
                      )}

                      {/* Configuration Controls Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#525f7f] uppercase tracking-wider mb-1">
                            Visa Program Assignment
                          </label>
                          <select
                            value={excelDefaultVisaType}
                            onChange={(e) => setExcelDefaultVisaType(e.target.value)}
                            className="zoho-select w-full cursor-pointer"
                          >
                            <option value="AUTO">Auto-detect from Campaign & AdSet</option>
                            <option value="WORK_VISA">Force Work Visa Desk</option>
                            <option value="STUDY_VISA">Force Study Visa Desk</option>
                            <option value="OTHER_VISA">Force Other Visa Desk</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#525f7f] uppercase tracking-wider mb-1">
                            Ingestion Pipeline
                          </label>
                          <select
                            value={importMethod}
                            onChange={(e) => setImportMethod(e.target.value as 'direct' | 'server')}
                            className="zoho-select w-full cursor-pointer"
                          >
                            <option value="direct">Direct Database Ingest (Browser Batch API)</option>
                            <option value="server">Server Upload Pipeline (/api/leads/import)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-1">
                          <label className="block text-[11px] font-medium text-[#525f7f] uppercase tracking-wider mb-1">
                            Detected Breakdown
                          </label>
                          <div className="flex items-center gap-1.5 h-[32px]">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-[3px] bg-[#f0f4f9] text-[#1e40af] border border-[#dbeafe]">
                              Work: <strong>{excelStats.work}</strong>
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-[3px] bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                              Study: <strong>{excelStats.study}</strong>
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-[3px] bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                              IG: <strong>{excelStats.ig}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Zoho CRM Data Grid Table */}
                    <div className="border border-[#e2e8f0] rounded-[4px] overflow-hidden bg-white shadow-2xs">
                      <div className="bg-[#f8fafc] px-3.5 py-2 border-b border-[#e2e8f0] flex items-center justify-between text-[11px] text-[#64748b]">
                        <span className="font-semibold text-[#334155]">Candidate Records Preview ({previewRows.length} rows)</span>
                        <span>Scroll horizontally to inspect attribution</span>
                      </div>

                      <div className="max-h-72 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-zoho">
                          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-semibold text-[#525f7f] uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center text-[#64748b]">#</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Candidate Name</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Contact Details</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Location</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Visa Program</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Platform</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Survey & Status</th>
                              <th className="py-2.5 px-3 border-l border-[#e5e7eb]">Campaign / Adset</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#edf2f7] text-[#2c3e50]">
                            {previewRows.map((r, i) => {
                              const currentVisa = excelDefaultVisaType === 'AUTO' ? r.visaType : excelDefaultVisaType;
                              return (
                                <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="py-2 px-3 text-center text-[#94a3b8] font-mono text-[11px] bg-[#fafbfc]">
                                    {i + 1}
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-[#1e293b] text-[12px]">{r.name}</span>
                                      {r.isDuplicate && (
                                        <span
                                          className="px-1.5 py-0.2 rounded-[2px] text-[10px] font-medium bg-[#fef3c7] text-[#92400e] border border-[#fde68a] shrink-0"
                                          title={r.duplicateReason}
                                        >
                                          Already in CRM
                                        </span>
                                      )}
                                    </div>
                                    {r.externalId && (
                                      <div className="text-[10px] text-[#94a3b8] font-mono" title={r.externalId}>
                                        ID: {r.externalId}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <div className="font-mono text-[#1e293b] text-[12px]">{r.phone || '—'}</div>
                                    <div className="text-[11px] text-[#64748b] truncate max-w-[140px]" title={r.email}>
                                      {r.email || '—'}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9] text-[#1e293b] text-[12px]">
                                    {r.city || '—'}
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-[3px] border ${
                                      currentVisa === 'WORK_VISA'
                                        ? 'bg-[#f0f4f9] text-[#1e40af] border-[#dbeafe]'
                                        : currentVisa === 'STUDY_VISA'
                                        ? 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'
                                        : 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'
                                    }`}>
                                      {currentVisa === 'WORK_VISA' ? 'Work Visa' : currentVisa === 'STUDY_VISA' ? 'Study Visa' : 'Other Visa'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold font-mono rounded-[2px] bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                                      {r.platform}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <div className="text-[#1e293b] text-[12px] font-medium">{r.qualification}</div>
                                    {r.surveyCgpa && (
                                      <div className="text-[10px] text-[#64748b]">{r.surveyCgpa}</div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 border-l border-[#f1f5f9]">
                                    <div className="text-[#1e293b] text-[12px] truncate max-w-[160px]" title={r.campaignName}>
                                      {r.campaignName || 'Meta Lead Gen'}
                                    </div>
                                    {r.adSetName && (
                                      <div className="text-[10px] text-[#64748b] truncate max-w-[160px]" title={r.adSetName}>
                                        {r.adSetName}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Progress Bar when Ingesting */}
                    {importLoading && (
                      <div className="space-y-1.5 p-3 rounded-[4px] bg-[#f8fafc] border border-[#e2e8f0]">
                        <div className="flex items-center justify-between text-xs font-zoho">
                          <span className="font-medium text-[#1366d9] flex items-center gap-1.5">
                            <RefreshCw size={13} className="animate-spin" />
                            <span>
                              Writing candidate records ({importProgress.current} of {importProgress.total})...
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-[#1366d9] font-semibold">
                            {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e2e8f0] rounded-[2px] overflow-hidden">
                          <div
                            className="h-full bg-[#1366d9] transition-all duration-150 rounded-[2px]"
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
                    <div className="bg-[#fafbfc] -mx-6 -mb-6 px-6 py-3 border-t border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                      <div className="text-[12px] text-[#64748b]">
                        {importLoading ? (
                          'Creating customer profiles & linking preferences...'
                        ) : (
                          <span>Ready to import <strong className="text-[#1e293b]">{previewRows.length}</strong> candidate records into CRM.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          disabled={importLoading}
                          onClick={() => {
                            setPreviewRows([]);
                            setImportFile(null);
                          }}
                          className="zoho-btn"
                        >
                          Cancel / Clear
                        </button>
                        <button
                          type="button"
                          disabled={importLoading || previewRows.length === 0}
                          onClick={handleConfirmImport}
                          className="zoho-btn-primary"
                        >
                          {importLoading ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : duplicateStats.allDuplicates && skipDuplicates ? (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Verify & Skip All {duplicateStats.duplicateCount} Duplicates</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>
                                Confirm & Load {skipDuplicates ? duplicateStats.newCount : previewRows.length} Candidates
                                {skipDuplicates && duplicateStats.duplicateCount > 0 && ` (${duplicateStats.duplicateCount} skipped)`}
                              </span>
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
