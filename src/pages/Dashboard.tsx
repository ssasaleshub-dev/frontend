import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone,
  MessageCircle,
  ChevronRight,
  AlertCircle,
  Clock,
  Layers,
  Globe,
  Shield,
  BarChart3,
  PieChart,
  X,
} from 'lucide-react';
import {
  BrandAttributionIcon,
  KpiCandidatesIcon,
  KpiWorkVisaIcon,
  KpiStudyVisaIcon,
  KpiApprovedIcon,
} from '../components/icons/BrandIcons';
import crmService from '../services/api/crmService';
import { formatIndianDate, formatIndianTime } from '../utils/dateTimeUtils';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
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
import { Lead, LeadAnalytics } from '../types';
import { encryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const isAdmin = checkIsAdmin(currentUser);
  const isWorkVisa = isWorkVisaStaff(currentUser);
  const isStudyVisa = isStudyVisaStaff(currentUser);
  const isOtherVisa = isOtherVisaStaff(currentUser);
  const roleBadge = getRoleBadgeInfo(currentUser);

  // Initial desk based strictly on counselor role
  const userInitialDesk: 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA' = useMemo(() => {
    if (isAdmin) return 'ALL';
    if (isStudyVisa) return 'STUDY_VISA';
    if (isWorkVisa) return 'WORK_VISA';
    if (isOtherVisa) return 'OTHER_VISA';
    return 'ALL';
  }, [isAdmin, isStudyVisa, isWorkVisa, isOtherVisa]);

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deskFilter, setDeskFilter] = useState<'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA'>(userInitialDesk);
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null);
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string }>({
    status: 'CONTACTED',
    notes: '',
  });
  const [searchParams] = useSearchParams();
  const urlDesk = searchParams.get('desk') as 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA' | null;
  const hasLoadedRef = useRef<boolean>(false);

  const loadDashboardData = useCallback(async (filterParam?: string) => {
    setLoading(true);
    setError(null);
    // Non-admin counselors are strictly locked to their assigned desk parameter
    const effectiveDesk = !isAdmin ? userInitialDesk : (filterParam !== undefined ? filterParam : deskFilter);
    const filterToUse = effectiveDesk !== 'ALL' ? effectiveDesk : undefined;
    try {
      const [analyticsRes, leadsRes] = await Promise.allSettled([
        crmService.getLeadAnalytics(filterToUse),
        crmService.getDetailedLeads(filterToUse),
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
      }
      if (leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value)) {
        setAllLeads(leadsRes.value);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch candidate inquiries');
    } finally {
      setLoading(false);
    }
  }, [deskFilter, isAdmin, userInitialDesk]);

  // Synchronize desk filter when user role or URL param changes
  useEffect(() => {
    if (!isAdmin) {
      setDeskFilter(userInitialDesk);
    } else if (urlDesk && ['ALL', 'WORK_VISA', 'STUDY_VISA', 'OTHER_VISA'].includes(urlDesk)) {
      setDeskFilter(urlDesk);
      loadDashboardData(urlDesk);
    }
  }, [isAdmin, userInitialDesk, urlDesk, loadDashboardData]);

  const handleDeskChange = (desk: 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA') => {
    if (!isAdmin) return; // Non-admin cannot switch away from their desk
    setDeskFilter(desk);
    loadDashboardData(desk);
  };

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDashboardData();
    }

    const handleUpdate = () => loadDashboardData();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, [loadDashboardData]);

  // 1. Scope leads by logged-in user role
  const roleScopedLeads = useMemo(() => {
    return filterLeadsByUserRole(allLeads, currentUser);
  }, [allLeads, currentUser]);

  // 2. Filter by selected desk tab (for Admin toggle or active counselor desk)
  const displayLeads = useMemo(() => {
    if (deskFilter === 'ALL') return roleScopedLeads;
    const userLogin = (currentUser?.login || '').toLowerCase();
    return roleScopedLeads.filter((l) => {
      // If a candidate is directly assigned to the logged-in counselor, always display it
      if (!isAdmin && !!userLogin && (l.assignedTo || '').toLowerCase() === userLogin) return true;
      if (deskFilter === 'STUDY_VISA') return isStudyVisaType(l.visaType);
      if (deskFilter === 'WORK_VISA') return isWorkVisaType(l.visaType);
      if (deskFilter === 'OTHER_VISA') return isOtherVisaType(l.visaType);
      return true;
    });
  }, [roleScopedLeads, deskFilter, isAdmin, currentUser?.login]);

  // Derived metrics
  const metrics = useMemo(() => {
    const total = displayLeads.length;
    const workVisaCount = roleScopedLeads.filter((l) => isWorkVisaType(l.visaType)).length;
    const studyVisaCount = roleScopedLeads.filter((l) => isStudyVisaType(l.visaType)).length;
    const otherVisaCount = roleScopedLeads.filter((l) => isOtherVisaType(l.visaType)).length;

    // Source Platforms in displayed leads
    const igCount = displayLeads.filter((l) => l.platform === 'IG').length;
    const fbCount = displayLeads.filter((l) => l.platform === 'FB').length;
    const waCount = displayLeads.filter((l) => l.platform === 'WHATSAPP').length;

    // Status counts
    const statusCounts: Record<string, number> = {};
    Object.keys(LEAD_STATUSES).forEach((st) => {
      statusCounts[st] = displayLeads.filter((l) => (l.status || '').toUpperCase() === st).length;
    });

    const wonCount = (statusCounts.CONVERTED || 0) + (statusCounts.WON || 0);
    const inProcessCount = (statusCounts.NEGOTIATION || 0) + (statusCounts.PROPOSAL_SENT || 0);
    const contactedOrQualified = (statusCounts.CONTACTED || 0) + (statusCounts.QUALIFIED || 0);
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    // Education distribution
    const educationCounts: Record<string, number> = {};
    displayLeads.forEach((l) => {
      const eq = l.educationalQualification || 'Any Degree / Other';
      educationCounts[eq] = (educationCounts[eq] || 0) + 1;
    });

    // Age distribution
    const ageCounts: Record<string, number> = {};
    displayLeads.forEach((l) => {
      const age = l.age || 'General / Unspecified';
      ageCounts[age] = (ageCounts[age] || 0) + 1;
    });

    return {
      total,
      workVisaCount,
      studyVisaCount,
      otherVisaCount,
      igCount,
      fbCount,
      waCount,
      statusCounts,
      wonCount,
      inProcessCount,
      contactedOrQualified,
      conversionRate,
      educationCounts,
      ageCounts,
    };
  }, [displayLeads, roleScopedLeads]);

  // leadsByVisaType chart data from backend analytics with fallback
  const leadsByVisaType = useMemo(() => {
    if (analytics?.leadsByVisaType && Object.keys(analytics.leadsByVisaType).length > 0) {
      return analytics.leadsByVisaType;
    }
    return {
      WORK_VISA: metrics.workVisaCount,
      STUDY_VISA: metrics.studyVisaCount,
      OTHER_VISA: metrics.otherVisaCount,
    };
  }, [analytics, metrics]);

  // leadsByStatus chart data from backend analytics with fallback
  const leadsByStatus = useMemo(() => {
    if (analytics?.leadsByStatus && Object.keys(analytics.leadsByStatus).length > 0) {
      return analytics.leadsByStatus;
    }
    return {
      CONTACTED: metrics.statusCounts.CONTACTED || 0,
      QUALIFIED: metrics.statusCounts.QUALIFIED || 0,
      CONVERTED: (metrics.statusCounts.CONVERTED || 0) + (metrics.statusCounts.WON || 0),
      LOST: metrics.statusCounts.LOST || 0,
      CREATED: metrics.statusCounts.CREATED || 0,
    };
  }, [analytics, metrics]);

  const recentLeads = useMemo(() => {
    return displayLeads.slice(0, 8);
  }, [displayLeads]);

  const handleQuickStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalLead) return;
    try {
      await crmService.updateLeadStatus(
        statusModalLead.id,
        statusForm.status,
        statusForm.notes || ''
      );
      setStatusModalLead(null);
      await loadDashboardData();
    } catch (err: any) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
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

  return (
    <div className="space-y-6">
      {/* Executive Command Header Bar */}
      <div className="ios-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto flex items-center">
          {/* Desk Switcher Segmented Control */}
          {isAdmin ? (
            <div className="ios-segmented w-full sm:w-auto !grid grid-cols-4 sm:!inline-flex items-center p-1">
              <button
                type="button"
                onClick={() => handleDeskChange('ALL')}
                className={`ios-segmented-btn !px-1 sm:!px-3.5 !py-2 sm:!py-1.5 flex items-center justify-center text-center text-[11px] sm:text-xs whitespace-nowrap transition-all ${
                  deskFilter === 'ALL' ? 'active font-semibold shadow-xs' : ''
                }`}
              >
                <span>All</span>
                <span className="hidden sm:inline">&nbsp;Visas</span>
                <span className="ml-1 text-[10px] sm:text-[11px] opacity-75 font-semibold">({roleScopedLeads.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeskChange('WORK_VISA')}
                className={`ios-segmented-btn !px-1 sm:!px-3.5 !py-2 sm:!py-1.5 flex items-center justify-center text-center text-[11px] sm:text-xs whitespace-nowrap transition-all ${
                  deskFilter === 'WORK_VISA' ? 'active font-semibold shadow-xs' : ''
                }`}
              >
                <span>Work</span>
                <span className="hidden sm:inline">&nbsp;Visa</span>
                <span className="ml-1 text-[10px] sm:text-[11px] opacity-75 font-semibold">({metrics.workVisaCount})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeskChange('STUDY_VISA')}
                className={`ios-segmented-btn !px-1 sm:!px-3.5 !py-2 sm:!py-1.5 flex items-center justify-center text-center text-[11px] sm:text-xs whitespace-nowrap transition-all ${
                  deskFilter === 'STUDY_VISA' ? 'active font-semibold shadow-xs' : ''
                }`}
              >
                <span>Study</span>
                <span className="hidden sm:inline">&nbsp;Visa</span>
                <span className="ml-1 text-[10px] sm:text-[11px] opacity-75 font-semibold">({metrics.studyVisaCount})</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeskChange('OTHER_VISA')}
                className={`ios-segmented-btn !px-1 sm:!px-3.5 !py-2 sm:!py-1.5 flex items-center justify-center text-center text-[11px] sm:text-xs whitespace-nowrap transition-all ${
                  deskFilter === 'OTHER_VISA' ? 'active font-semibold shadow-xs' : ''
                }`}
              >
                <span>Other</span>
                <span className="hidden sm:inline">&nbsp;Visa</span>
                <span className="ml-1 text-[10px] sm:text-[11px] opacity-75 font-semibold">({metrics.otherVisaCount})</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${roleBadge.badgeClass}`}>
                {roleBadge.displayText}
              </span>
              <span className="text-[11px] text-[#8e8e93] font-medium">
                ({displayLeads.length} desk scoped inquiries)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="ios-btn-primary text-xs py-2 px-4 flex-1 sm:flex-initial justify-center"
          >
            <span>Open Leads Table</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="underline font-semibold hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Apple HIG Executive Metric Cards (Grouped Inset with SF Symbols & Materials) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Desk Total Inquiries */}
        <div className="ios-card p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 group relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#007aff] to-[#5856d6]" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                ? 'Study Visa Students'
                : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                ? 'Work Visa Candidates'
                : 'Total Candidates'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center transition-transform group-hover:scale-105 border border-[#007aff]/15">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa) ? (
                <KpiStudyVisaIcon size={18} />
              ) : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa) ? (
                <KpiWorkVisaIcon size={18} />
              ) : (
                <KpiCandidatesIcon size={18} />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] tracking-tight">
              {metrics.total}
            </div>
            <div className="mt-1 text-xs text-[#8e8e93] font-medium">
              <span>{metrics.statusCounts.CREATED || 0} awaiting contact</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Contacted / Screened / Cross-Desk Work */}
        <div className="ios-card p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 group relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5856d6] to-[#af52de]" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                ? 'In Student Counseling'
                : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                ? 'Screened & Qualified'
                : 'Work Visa Inquiries'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#5856d6]/10 text-[#5856d6] flex items-center justify-center transition-transform group-hover:scale-105 border border-[#5856d6]/15">
              {deskFilter === 'ALL' && isAdmin ? <KpiWorkVisaIcon size={18} /> : <KpiCandidatesIcon size={18} />}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] tracking-tight">
              {deskFilter === 'ALL' && isAdmin ? metrics.workVisaCount : metrics.contactedOrQualified}
            </div>
            <div className="mt-1 text-xs text-[#8e8e93] font-medium truncate">
              <span>
                {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                  ? 'Course & eligibility prep'
                  : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                  ? 'Employer screening process'
                  : 'International job & permits'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: In Process / Cross-Desk Study */}
        <div className="ios-card p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 group relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#34c759] to-[#30b0c7]" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                ? 'Applications In Process'
                : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                ? 'Permits In Process'
                : 'Study Visa Inquiries'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#34c759]/10 text-[#34c759] flex items-center justify-center transition-transform group-hover:scale-105 border border-[#34c759]/15">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa) ? (
                <KpiStudyVisaIcon size={18} />
              ) : deskFilter === 'ALL' && isAdmin ? (
                <KpiStudyVisaIcon size={18} />
              ) : (
                <KpiStudyVisaIcon size={18} />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] tracking-tight">
              {deskFilter === 'ALL' && isAdmin ? metrics.studyVisaCount : metrics.inProcessCount}
            </div>
            <div className="mt-1 text-xs text-[#8e8e93] font-medium truncate">
              <span>
                {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                  ? 'University offers & dossiers'
                  : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                  ? 'Work contracts & permit filings'
                  : 'University & admissions desk'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Successful Enrollment / Approval */}
        <div className="ios-card p-4 sm:p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 group relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff9500] to-[#ff2d55]" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e93]">
              {deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                ? 'Admissions & Visas Approved'
                : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                ? 'Work Visas Approved'
                : 'Enrolled / Visa Approved'}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center transition-transform group-hover:scale-105 border border-[#ff9500]/15">
              <KpiApprovedIcon size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-[#1c1c1e] tracking-tight">
                {metrics.wonCount}
              </span>
              <span className="text-xs font-semibold text-[#ff9500]">
                ({metrics.conversionRate}% conversion)
              </span>
            </div>
            <div className="mt-1 text-xs text-[#8e8e93] font-medium">
              <span>{metrics.inProcessCount} dossiers in process</span>
            </div>
          </div>
        </div>
      </div>

      {/* Zoho CRM Stepper Pipeline Funnel */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers size={14} className="text-blue-600" />
              <span>Counseling Stages & Progress</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any stage to filter candidate records</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
          >
            <span>View All Candidates</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Continuous Step Funnel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {LEAD_STATUS_LIST.map((st, idx) => {
            const count = metrics.statusCounts[st.value] || 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <button
                key={st.value}
                onClick={() => navigate(`/leads?status=${st.value}`)}
                className="p-3 rounded border border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 bg-slate-50/60 transition-colors text-left group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-400 font-semibold">0{idx + 1}</span>
                  <span className="font-semibold text-slate-500 group-hover:text-blue-600">{pct}%</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {count}
                </div>
                <p className="text-xs font-medium text-slate-700 truncate mt-0.5" title={st.label}>
                  {st.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Based Analytics Charts: Desk Breakdown and leadsByStatus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Desk Domain Distribution (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <PieChart size={14} className="text-blue-600" />
              <span>
                {isAdmin && deskFilter === 'ALL'
                  ? 'Visa Program Distribution'
                  : deskFilter === 'STUDY_VISA' || (!isAdmin && isStudyVisa)
                  ? 'Study Visa Academic Profiles'
                  : deskFilter === 'WORK_VISA' || (!isAdmin && isWorkVisa)
                  ? 'Work Visa Candidate Qualifications'
                  : 'Program Distribution'}
              </span>
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded">
              Total: {metrics.total} leads
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100">
            {isAdmin && deskFilter === 'ALL' ? (
              <>
                {/* Admin View: Work Visa */}
                {(() => {
                  const workCnt = leadsByVisaType.WORK_VISA || 0;
                  const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
                  const pct = Math.round((workCnt / totalSum) * 100);
                  return (
                    <div
                      onClick={() => handleDeskChange('WORK_VISA')}
                      className="py-3 px-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 shrink-0"></span>
                          <span className="font-semibold text-slate-900">Work Visa</span>
                          <span className="text-slate-400 text-[11px]">· Employment & Permit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{workCnt} leads</span>
                          <span className="text-xs font-semibold text-indigo-600 min-w-[36px] text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Admin View: Study Visa */}
                {(() => {
                  const studyCnt = leadsByVisaType.STUDY_VISA || 0;
                  const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
                  const pct = Math.round((studyCnt / totalSum) * 100);
                  return (
                    <div
                      onClick={() => handleDeskChange('STUDY_VISA')}
                      className="py-3 px-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 shrink-0"></span>
                          <span className="font-semibold text-slate-900">Study Visa</span>
                          <span className="text-slate-400 text-[11px]">· University Admissions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{studyCnt} leads</span>
                          <span className="text-xs font-semibold text-emerald-600 min-w-[36px] text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Admin View: Other Visa */}
                {(() => {
                  const otherCnt = leadsByVisaType.OTHER_VISA || 0;
                  const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
                  const pct = Math.round((otherCnt / totalSum) * 100);
                  return (
                    <div
                      onClick={() => handleDeskChange('OTHER_VISA')}
                      className="py-3 px-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0"></span>
                          <span className="font-semibold text-slate-900">Other Visa</span>
                          <span className="text-slate-400 text-[11px]">· General / 3rd Category</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{otherCnt} leads</span>
                          <span className="text-xs font-semibold text-amber-600 min-w-[36px] text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Scoped Counselor View: Academic / Demographic Streams */
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Bachelor Degree', color: 'bg-emerald-600', swatch: 'bg-emerald-500' },
                  { label: 'Master Degree / Post Graduate', color: 'bg-blue-600', swatch: 'bg-blue-500' },
                  { label: 'Diploma', color: 'bg-indigo-600', swatch: 'bg-indigo-500' },
                  { label: '10th / 12th', color: 'bg-amber-500', swatch: 'bg-amber-400' },
                ].map((item) => {
                  const count = metrics.educationCounts[item.label] || 0;
                  const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                  return (
                    <div
                      key={item.label}
                      className="py-3 px-2 hover:bg-slate-50 rounded transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-sm ${item.swatch} shrink-0`}></span>
                          <span className="font-semibold text-slate-800">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{count} students</span>
                          <span className="text-xs font-medium text-slate-500 min-w-[36px] text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`${item.color} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: leadsByStatus (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-600" />
              <span>Status Distribution</span>
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded">
              Candidate Stages
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100">
            {[
              { key: 'CREATED', label: 'New / Uncontacted', color: 'bg-slate-500', swatch: 'bg-slate-400', textColor: 'text-slate-600' },
              { key: 'CONTACTED', label: 'Contacted', color: 'bg-blue-600', swatch: 'bg-blue-500', textColor: 'text-blue-600' },
              { key: 'QUALIFIED', label: 'Qualified', color: 'bg-indigo-600', swatch: 'bg-indigo-500', textColor: 'text-indigo-600' },
              { key: 'PROPOSAL_SENT', label: 'Docs Requested', color: 'bg-amber-500', swatch: 'bg-amber-400', textColor: 'text-amber-600' },
              { key: 'NEGOTIATION', label: 'In Process', color: 'bg-purple-600', swatch: 'bg-purple-500', textColor: 'text-purple-600' },
              { key: 'CONVERTED', label: 'Converted', color: 'bg-teal-600', swatch: 'bg-teal-500', textColor: 'text-teal-600' },
              { key: 'WON', label: 'Visa Approved / Enrolled', color: 'bg-emerald-600', swatch: 'bg-emerald-500', textColor: 'text-emerald-600' },
              { key: 'LOST', label: 'Lost / Closed', color: 'bg-rose-500', swatch: 'bg-rose-400', textColor: 'text-rose-600' },
            ].map((stItem) => {
              const count = leadsByStatus[stItem.key] || 0;
              const totalStatusSum = Object.values(leadsByStatus).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
              const pct = Math.round((count / totalStatusSum) * 100);
              return (
                <div
                  key={stItem.key}
                  onClick={() => navigate(`/leads?status=${stItem.key}`)}
                  className="py-2.5 px-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${stItem.swatch} shrink-0`}></span>
                      <span className="font-semibold text-slate-800">{stItem.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{count}</span>
                      <span className={`text-xs font-semibold ${stItem.textColor} min-w-[36px] text-right`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${stItem.color} h-full rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Analytics: Marketing Sources & Candidate Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Marketing Attribution Channels (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <BrandAttributionIcon size={14} className="text-[#007aff]" />
              <span>Inbound Marketing Sources</span>
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
              Meta & WhatsApp
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100">
            {/* Instagram */}
            <div className="py-3 px-2 hover:bg-slate-50 rounded transition-colors">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0"></span>
                  <span className="font-semibold text-slate-800">Instagram Ads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{metrics.igCount} leads</span>
                  <span className="text-xs font-semibold text-rose-600 min-w-[36px] text-right">
                    {metrics.total > 0 ? Math.round((metrics.igCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.total > 0 ? (metrics.igCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Facebook */}
            <div className="py-3 px-2 hover:bg-slate-50 rounded transition-colors">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 shrink-0"></span>
                  <span className="font-semibold text-slate-800">Facebook Ads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{metrics.fbCount} leads</span>
                  <span className="text-xs font-semibold text-blue-600 min-w-[36px] text-right">
                    {metrics.total > 0 ? Math.round((metrics.fbCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.total > 0 ? (metrics.fbCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div className="py-3 px-2 hover:bg-slate-50 rounded transition-colors">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 shrink-0"></span>
                  <span className="font-semibold text-slate-800">WhatsApp Inbound</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{metrics.waCount} leads</span>
                  <span className="text-xs font-semibold text-emerald-600 min-w-[36px] text-right">
                    {metrics.total > 0 ? Math.round((metrics.waCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${metrics.total > 0 ? (metrics.waCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Candidate Demographics (Education & Age) (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock size={14} className="text-blue-600" />
              <span>Qualification & Demographics</span>
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded">
              Eligibility Profiles
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Education Breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                Education Qualification
              </p>
              <div className="divide-y divide-slate-100">
                {Object.keys(metrics.educationCounts).length > 0 ? (
                  Object.entries(metrics.educationCounts).map(([eq, cnt]) => (
                    <div key={eq} className="py-2 px-1 hover:bg-slate-50 rounded transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">{eq}</span>
                        <span className="font-semibold text-slate-900">{cnt}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-3">No qualification data yet</p>
                )}
              </div>
            </div>

            {/* Age Breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                Age Brackets
              </p>
              <div className="divide-y divide-slate-100">
                {Object.keys(metrics.ageCounts).length > 0 ? (
                  Object.entries(metrics.ageCounts).map(([age, cnt]) => (
                    <div key={age} className="py-2 px-1 hover:bg-slate-50 rounded transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">{age}</span>
                        <span className="font-semibold text-slate-900">{cnt}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-3">No age demographics yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Candidate Inquiries Table (Zoho CRM Enterprise Table) */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Candidate Inquiries</h3>
          </div>

          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View All Leads</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Phone & City</th>
                <th className="py-3 px-4">Visa Program</th>
                <th className="py-3 px-4">Qualification & Age</th>
                <th className="py-3 px-4">Source & Campaign</th>
                <th className="py-3 px-4">Lifecycle Stage</th>
                <th className="py-3 px-4 text-right">Quick Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8e8e93]">
                    <p className="text-xs font-medium text-[#1c1c1e]">No candidate records in this desk yet.</p>
                    <p className="text-[11px] text-[#8e8e93] mt-1">Use "Ingest Excel" or "+ New Candidate" to ingest records.</p>
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead) => {
                  const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                  const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                    label: lead.status || 'New',
                    color: 'bg-black/[0.05] text-[#3c3c43]',
                  };

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-[#007aff]/[0.03] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                    >
                      {/* Candidate */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1c1c1e] group-hover:text-[#007aff] transition-colors">
                          {lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`}
                        </div>
                        {lead.email && (
                          <div className="text-[11px] text-[#8e8e93] truncate max-w-[160px]">{lead.email}</div>
                        )}
                      </td>

                      {/* Phone & City */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[#1c1c1e] font-medium">{lead.phoneNumber || '—'}</div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-[#8e8e93] capitalize">{lead.city || lead.location}</div>
                        )}
                      </td>

                      {/* Visa Program */}
                      <td className="py-3.5 px-4">
                        {renderVisaBadge(lead.visaType)}
                      </td>

                      {/* Qualification & Age */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1c1c1e]">{lead.educationalQualification || '—'}</div>
                        {lead.age && <div className="text-[11px] text-[#8e8e93]">{lead.age}</div>}
                      </td>

                      {/* Source & Campaign */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-[#1c1c1e]">
                          {plat.label}
                        </div>
                        <div className="text-[11px] text-[#8e8e93] truncate max-w-[120px] mt-0.5" title={lead.campaignName}>
                          {lead.campaignName || 'Direct'}
                        </div>
                      </td>

                      {/* Lifecycle Stage (Simple plain text) */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <span
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
                          }}
                          className="text-xs text-[#1c1c1e] hover:text-[#007aff] hover:underline cursor-pointer"
                          title="Click to update stage"
                        >
                          {stConfig.label}
                        </span>
                      </td>

                      {/* Quick Contact (Simple clean icons) */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${lead.phoneNumber.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call candidate"
                                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                              >
                                <Phone size={15} />
                              </a>
                            </>
                          )}
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

      {/* Quick Status Modal (Apple HIG Glass Sheet UI) */}
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

            <form onSubmit={handleQuickStatusUpdate} className="text-xs">
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

              {/* Lifecycle Stage (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Lifecycle Stage">
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

              {/* Discussion Notes / Follow-up */}
              <div className="zoho-form-row items-start">
                <label className="zoho-form-label pt-2" title="Discussion Notes">
                  Follow-up Notes
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

              {/* Date & Time of Intake (Compound Field matching screenshot) */}
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
    </div>
  );
}
