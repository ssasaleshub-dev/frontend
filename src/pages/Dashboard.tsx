import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  GraduationCap,
  RefreshCw,
  Phone,
  MessageCircle,
  ChevronRight,
  AlertCircle,
  Share2,
  Clock,
  Award,
  Layers,
  Globe,
  Shield,
  ShieldCheck,
  BarChart3,
  PieChart,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
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
import { Lead, LeadAnalytics } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deskFilter, setDeskFilter] = useState<'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA'>('ALL');
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null);
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string }>({
    status: 'CONTACTED',
    notes: '',
  });
  const hasLoadedRef = useRef<boolean>(false);

  const isAdmin = checkIsAdmin(currentUser);
  const isWorkVisa = isWorkVisaStaff(currentUser);
  const isStudyVisa = isStudyVisaStaff(currentUser);
  const isOtherVisa = isOtherVisaStaff(currentUser);
  const roleBadge = getRoleBadgeInfo(currentUser);

  const loadDashboardData = useCallback(async (filterParam?: string) => {
    setLoading(true);
    setError(null);
    const activeFilter = filterParam !== undefined ? filterParam : deskFilter;
    const filterToUse = activeFilter !== 'ALL' ? activeFilter : undefined;
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
  }, [deskFilter]);

  const handleDeskChange = (desk: 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA') => {
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

  // Set default desk based on staff role
  useEffect(() => {
    if (isWorkVisa) setDeskFilter('WORK_VISA');
    else if (isStudyVisa) setDeskFilter('STUDY_VISA');
    else if (isOtherVisa) setDeskFilter('OTHER_VISA');
  }, [isWorkVisa, isStudyVisa, isOtherVisa]);

  // 1. Scope leads by logged-in user role
  const roleScopedLeads = useMemo(() => {
    return filterLeadsByUserRole(allLeads, currentUser);
  }, [allLeads, currentUser]);

  // 2. Filter by selected desk tab (if Admin or toggleable)
  const displayLeads = useMemo(() => {
    if (deskFilter === 'ALL') return roleScopedLeads;
    if (deskFilter === 'OTHER_VISA') {
      return roleScopedLeads.filter((l) => {
        const vt = (l.visaType || '').toUpperCase();
        return vt !== 'WORK_VISA' && vt !== 'STUDY_VISA';
      });
    }
    return roleScopedLeads.filter((l) => (l.visaType || '').toUpperCase() === deskFilter);
  }, [roleScopedLeads, deskFilter]);

  // Derived metrics
  const metrics = useMemo(() => {
    const total = displayLeads.length;
    const workVisaCount = roleScopedLeads.filter(
      (l) => (l.visaType || '').toUpperCase() === 'WORK_VISA'
    ).length;
    const studyVisaCount = roleScopedLeads.filter(
      (l) => (l.visaType || '').toUpperCase() === 'STUDY_VISA'
    ).length;
    const otherVisaCount = roleScopedLeads.filter((l) => {
      const vt = (l.visaType || '').toUpperCase();
      return vt !== 'WORK_VISA' && vt !== 'STUDY_VISA';
    }).length;

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
        <span className="ios-badge ios-badge-blue">
          <Briefcase size={10} />
          <span>Work Visa</span>
        </span>
      );
    }
    if (t === 'STUDY_VISA') {
      return (
        <span className="ios-badge ios-badge-green">
          <GraduationCap size={10} />
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="ios-badge ios-badge-orange">
        <Globe size={10} />
        <span>{t === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Header Bar */}
      <div className="ios-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Desk Switcher Segmented Control */}
          {isAdmin ? (
            <>
              <div className="ios-badge ios-badge-indigo px-3 py-1">
                <ShieldCheck size={13} />
                <span>All Team Analytics</span>
              </div>

              <div className="ios-segmented flex items-center">
                <button
                  onClick={() => handleDeskChange('ALL')}
                  className={`ios-segmented-btn ${deskFilter === 'ALL' ? 'active' : ''}`}
                >
                  All Visas ({roleScopedLeads.length})
                </button>
                <button
                  onClick={() => handleDeskChange('WORK_VISA')}
                  className={`ios-segmented-btn ${deskFilter === 'WORK_VISA' ? 'active' : ''}`}
                >
                  Work Visa ({metrics.workVisaCount})
                </button>
                <button
                  onClick={() => handleDeskChange('STUDY_VISA')}
                  className={`ios-segmented-btn ${deskFilter === 'STUDY_VISA' ? 'active' : ''}`}
                >
                  Study Visa ({metrics.studyVisaCount})
                </button>
                <button
                  onClick={() => handleDeskChange('OTHER_VISA')}
                  className={`ios-segmented-btn ${deskFilter === 'OTHER_VISA' ? 'active' : ''}`}
                >
                  Other Visa ({metrics.otherVisaCount})
                </button>
              </div>
            </>
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboardData()}
            disabled={loading}
            className="ios-btn-gray text-xs"
            title="Reload telemetry"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-[#007aff]' : 'text-[#8e8e93]'} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => navigate('/leads')}
            className="ios-btn-primary text-xs"
          >
            <span>Open Leads Table</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25 text-xs text-[#ff9500] flex items-center justify-between font-medium">
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

      {/* High-Profile iOS-Style KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Total Inquiries */}
        <div className="ios-card ios-card-hover p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e8e93]">
              {deskFilter === 'WORK_VISA' ? 'Work Visa Candidates' : deskFilter === 'STUDY_VISA' ? 'Study Visa Students' : 'Total Candidates'}
            </span>
            <div className="ios-squircle bg-[#007aff]/10 text-[#007aff]">
              <Users size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c1e]">
              {metrics.total}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8e8e93] font-medium">
              <span>{metrics.statusCounts.CREATED || 0} awaiting contact</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Work Visa Desk Inquiries */}
        <div className="ios-card ios-card-hover p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e8e93]">Work Visa Inquiries</span>
            <div className="ios-squircle bg-[#5856d6]/10 text-[#5856d6]">
              <Briefcase size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c1e]">
              {metrics.workVisaCount}
            </div>
            <div className="mt-1 text-[11px] text-[#8e8e93] font-medium truncate">
              International job & work permit
            </div>
          </div>
        </div>

        {/* KPI 3: Study Visa Desk Inquiries */}
        <div className="ios-card ios-card-hover p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e8e93]">Study Visa Inquiries</span>
            <div className="ios-squircle bg-[#34c759]/10 text-[#34c759]">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c1e]">
              {metrics.studyVisaCount}
            </div>
            <div className="mt-1 text-[11px] text-[#8e8e93] font-medium truncate">
              University & admissions desk
            </div>
          </div>
        </div>

        {/* KPI 4: Successful Enrollment / Approval */}
        <div className="ios-card ios-card-hover p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8e8e93]">Enrolled / Visa Approved</span>
            <div className="ios-squircle bg-[#ff9500]/10 text-[#ff9500]">
              <Award size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c1e]">
                {metrics.wonCount}
              </span>
              <span className="text-xs font-medium text-[#8e8e93]">
                ({metrics.conversionRate}% conversion)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#8e8e93] font-medium">
              {metrics.inProcessCount} dossiers in process
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Pipeline: Continuous Interactive Stage Funnel */}
      <div className="ios-card p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1.5">
              <Layers size={13} className="text-[#8e8e93]" />
              <span>Counseling Pipeline Funnel</span>
            </h3>
            <p className="text-[11px] text-[#8e8e93] mt-0.5">Click any stage to filter candidate records</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-[#007aff] hover:underline flex items-center gap-0.5"
          >
            <span>Full Pipeline</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Continuous Step Funnel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
          {LEAD_STATUS_LIST.map((st, idx) => {
            const count = metrics.statusCounts[st.value] || 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <button
                key={st.value}
                onClick={() => navigate(`/leads?status=${st.value}`)}
                className="p-3.5 rounded-2xl border border-black/[0.05] hover:border-[#007aff]/40 hover:bg-white bg-[#f9f9fa] transition-all text-left group shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98]"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[10px] font-mono text-[#8e8e93] font-semibold">0{idx + 1}</span>
                  <span className="font-semibold text-[#8e8e93] group-hover:text-[#007aff]">{pct}%</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-[#1c1c1e] mt-1">
                  {count}
                </div>
                <p className="text-[11px] font-medium text-[#3c3c43] truncate mt-0.5" title={st.label}>
                  {st.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Based Analytics Charts: leadsByVisaType and leadsByStatus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: leadsByVisaType (6 Cols) */}
        <div className="lg:col-span-6 ios-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1.5">
              <PieChart size={14} className="text-[#007aff]" />
              <span>Visa Program Distribution</span>
            </h3>
            <span className="text-[11px] font-semibold text-[#8e8e93]">
              Total: {metrics.total}
            </span>
          </div>

          <div className="space-y-3">
            {/* Work Visa */}
            {(() => {
              const workCnt = leadsByVisaType.WORK_VISA || 0;
              const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
              const pct = Math.round((workCnt / totalSum) * 100);
              return (
                <div
                  onClick={() => navigate('/leads?visaType=WORK_VISA')}
                  className="p-3.5 rounded-2xl bg-[#5856d6]/5 border border-[#5856d6]/15 hover:bg-[#5856d6]/10 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="ios-badge ios-badge-indigo">
                        <Briefcase size={10} />
                        Work Visa
                      </span>
                      <span className="text-[#8e8e93] text-[11px]">Employment & Permit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c1c1e]">{workCnt} leads</span>
                      <span className="text-xs font-bold text-[#5856d6]">{pct}%</span>
                    </div>
                  </div>
                  <div className="ios-progress-track">
                    <div
                      className="ios-progress-fill bg-[#5856d6]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Study Visa */}
            {(() => {
              const studyCnt = leadsByVisaType.STUDY_VISA || 0;
              const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
              const pct = Math.round((studyCnt / totalSum) * 100);
              return (
                <div
                  onClick={() => navigate('/leads?visaType=STUDY_VISA')}
                  className="p-3.5 rounded-2xl bg-[#34c759]/5 border border-[#34c759]/15 hover:bg-[#34c759]/10 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="ios-badge ios-badge-green">
                        <GraduationCap size={10} />
                        Study Visa
                      </span>
                      <span className="text-[#8e8e93] text-[11px]">University Admissions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c1c1e]">{studyCnt} leads</span>
                      <span className="text-xs font-bold text-[#34c759]">{pct}%</span>
                    </div>
                  </div>
                  <div className="ios-progress-track">
                    <div
                      className="ios-progress-fill bg-[#34c759]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Other Visa */}
            {(() => {
              const otherCnt = leadsByVisaType.OTHER_VISA || 0;
              const totalSum = (leadsByVisaType.WORK_VISA || 0) + (leadsByVisaType.STUDY_VISA || 0) + (leadsByVisaType.OTHER_VISA || 0) || 1;
              const pct = Math.round((otherCnt / totalSum) * 100);
              return (
                <div
                  onClick={() => navigate('/leads?visaType=OTHER_VISA')}
                  className="p-3.5 rounded-2xl bg-[#ff9500]/5 border border-[#ff9500]/15 hover:bg-[#ff9500]/10 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="ios-badge ios-badge-orange">
                        <Globe size={10} />
                        Other Visa
                      </span>
                      <span className="text-[#8e8e93] text-[11px]">General / 3rd Category</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c1c1e]">{otherCnt} leads</span>
                      <span className="text-xs font-bold text-[#ff9500]">{pct}%</span>
                    </div>
                  </div>
                  <div className="ios-progress-track">
                    <div
                      className="ios-progress-fill bg-[#ff9500]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Chart 2: leadsByStatus (6 Cols) */}
        <div className="lg:col-span-6 ios-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1.5">
              <BarChart3 size={14} className="text-[#007aff]" />
              <span>Status Distribution</span>
            </h3>
            <span className="text-[11px] font-semibold text-[#8e8e93]">
              Pipeline Stages
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'CONTACTED', label: 'Contacted', color: 'bg-[#007aff]', bg: 'bg-[#007aff]/5', border: 'border-[#007aff]/15', textColor: 'text-[#007aff]' },
              { key: 'QUALIFIED', label: 'Qualified', color: 'bg-[#5856d6]', bg: 'bg-[#5856d6]/5', border: 'border-[#5856d6]/15', textColor: 'text-[#5856d6]' },
              { key: 'CONVERTED', label: 'Converted / Won', color: 'bg-[#34c759]', bg: 'bg-[#34c759]/5', border: 'border-[#34c759]/15', textColor: 'text-[#34c759]' },
              { key: 'LOST', label: 'Lost / Closed', color: 'bg-[#ff3b30]', bg: 'bg-[#ff3b30]/5', border: 'border-[#ff3b30]/15', textColor: 'text-[#ff3b30]' },
              { key: 'CREATED', label: 'New / Uncontacted', color: 'bg-[#8e8e93]', bg: 'bg-black/[0.03]', border: 'border-black/[0.06]', textColor: 'text-[#636366]' },
            ].map((stItem) => {
              const count = leadsByStatus[stItem.key] || 0;
              const totalStatusSum = Object.values(leadsByStatus).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
              const pct = Math.round((count / totalStatusSum) * 100);
              return (
                <div
                  key={stItem.key}
                  onClick={() => navigate(`/leads?status=${stItem.key}`)}
                  className={`p-3 rounded-2xl ${stItem.bg} border ${stItem.border} hover:scale-[1.01] cursor-pointer transition-all active:scale-[0.99]`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#1c1c1e]">{stItem.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c1c1e]">{count}</span>
                      <span className={`text-[11px] font-bold ${stItem.textColor}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="ios-progress-track">
                    <div
                      className={`ios-progress-fill ${stItem.color}`}
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
        <div className="lg:col-span-5 ios-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1.5">
              <Share2 size={13} className="text-[#007aff]" />
              <span>Inbound Marketing Sources</span>
            </h3>
            <span className="text-[11px] text-[#8e8e93] font-medium">Meta & WhatsApp</span>
          </div>

          <div className="space-y-3">
            {/* Instagram */}
            <div className="p-3.5 rounded-2xl bg-[#ff2d55]/5 border border-[#ff2d55]/15">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1c1c1e]">Instagram Ads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1c1c1e]">{metrics.igCount} leads</span>
                  <span className="text-xs font-semibold text-[#ff2d55]">
                    {metrics.total > 0 ? Math.round((metrics.igCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="ios-progress-track">
                <div
                  className="ios-progress-fill bg-[#ff2d55]"
                  style={{ width: `${metrics.total > 0 ? (metrics.igCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-[#8e8e93] mt-1.5">Direct message inquiries & instant forms</p>
            </div>

            {/* Facebook */}
            <div className="p-3.5 rounded-2xl bg-[#007aff]/5 border border-[#007aff]/15">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1c1c1e]">Facebook Ads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1c1c1e]">{metrics.fbCount} leads</span>
                  <span className="text-xs font-semibold text-[#007aff]">
                    {metrics.total > 0 ? Math.round((metrics.fbCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="ios-progress-track">
                <div
                  className="ios-progress-fill bg-[#007aff]"
                  style={{ width: `${metrics.total > 0 ? (metrics.fbCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-[#8e8e93] mt-1.5">Lead generation campaigns & ad sets</p>
            </div>

            {/* WhatsApp */}
            <div className="p-3.5 rounded-2xl bg-[#34c759]/5 border border-[#34c759]/15">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1c1c1e]">WhatsApp Inbound</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1c1c1e]">{metrics.waCount} leads</span>
                  <span className="text-xs font-semibold text-[#34c759]">
                    {metrics.total > 0 ? Math.round((metrics.waCount / metrics.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="ios-progress-track">
                <div
                  className="ios-progress-fill bg-[#34c759]"
                  style={{ width: `${metrics.total > 0 ? (metrics.waCount / metrics.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-[#8e8e93] mt-1.5">Direct counselor chat outreach</p>
            </div>
          </div>
        </div>

        {/* Right: Candidate Demographics (Education & Age) (7 Cols) */}
        <div className="lg:col-span-7 ios-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e93] flex items-center gap-1.5">
              <Clock size={13} className="text-[#007aff]" />
              <span>Qualification & Demographics</span>
            </h3>
            <span className="text-[11px] text-[#8e8e93] font-medium">Eligibility Profiles</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Education Breakdown */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
                Education Qualification
              </p>
              <div className="space-y-2">
                {Object.keys(metrics.educationCounts).length > 0 ? (
                  Object.entries(metrics.educationCounts).map(([eq, cnt]) => (
                    <div key={eq} className="p-2.5 rounded-xl bg-[#f2f2f7]/80 border border-black/[0.04]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#1c1c1e] truncate max-w-[140px]">{eq}</span>
                        <span className="font-bold text-[#1c1c1e]">{cnt}</span>
                      </div>
                      <div className="ios-progress-track h-1.5">
                        <div
                          className="ios-progress-fill bg-[#007aff]"
                          style={{ width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#8e8e93] py-3">No qualification data yet</p>
                )}
              </div>
            </div>

            {/* Age Breakdown */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
                Age Brackets
              </p>
              <div className="space-y-2">
                {Object.keys(metrics.ageCounts).length > 0 ? (
                  Object.entries(metrics.ageCounts).map(([age, cnt]) => (
                    <div key={age} className="p-2.5 rounded-xl bg-[#f2f2f7]/80 border border-black/[0.04]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#1c1c1e] truncate max-w-[140px]">{age}</span>
                        <span className="font-bold text-[#1c1c1e]">{cnt}</span>
                      </div>
                      <div className="ios-progress-track h-1.5">
                        <div
                          className="ios-progress-fill bg-[#5856d6]"
                          style={{ width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#8e8e93] py-3">No age demographics yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Candidate Stream Table (iOS Inset Grouped Table) */}
      <div className="ios-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#1c1c1e]">Recent Candidate Inquiries</h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-[#007aff]/10 text-[#007aff]">
              {recentLeads.length} live
            </span>
          </div>

          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-semibold text-[#007aff] hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View All Leads</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f2f2f7]/70 border-b border-black/[0.05] text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Phone & City</th>
                <th className="py-3 px-4">Visa Program</th>
                <th className="py-3 px-4">Qualification & Age</th>
                <th className="py-3 px-4">Source & Campaign</th>
                <th className="py-3 px-4">Lifecycle Stage</th>
                <th className="py-3 px-4 text-right">Quick Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
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
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      {/* Candidate */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1c1c1e] group-hover:text-[#007aff] transition-colors">
                          {lead.customerName || `Candidate #${lead.id}`}
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
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plat.color}`}>
                            {plat.label}
                          </span>
                          <span className="text-[#3c3c43] font-medium truncate max-w-[120px]" title={lead.campaignName}>
                            {lead.campaignName || 'Direct'}
                          </span>
                        </div>
                      </td>

                      {/* Lifecycle Stage */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border ${stConfig.color} shadow-xs hover:scale-102 transition-transform`}
                        >
                          <span>{stConfig.label}</span>
                        </button>
                      </td>

                      {/* Quick Contact Buttons */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${lead.phoneNumber.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="p-2 text-[#34c759] hover:bg-[#34c759]/15 bg-[#34c759]/10 rounded-full transition-colors"
                              >
                                <MessageCircle size={14} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call candidate"
                                className="p-2 text-[#007aff] hover:bg-[#007aff]/15 bg-[#007aff]/10 rounded-full transition-colors"
                              >
                                <Phone size={14} />
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

      {/* Quick Status Modal (iOS Dialog Style) */}
      {statusModalLead && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="ios-glass-modal max-w-sm w-full p-6 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-[#1c1c1e]">
              Update Stage: {statusModalLead.customerName || `Candidate #${statusModalLead.id}`}
            </h3>
            <p className="text-xs text-[#8e8e93] mt-1">
              Current stage: <strong className="text-[#1c1c1e]">{statusModalLead.status}</strong>
            </p>

            <form onSubmit={handleQuickStatusUpdate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#3c3c43] mb-1.5">
                  Lifecycle Stage
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="ios-input w-full font-medium"
                >
                  {LEAD_STATUS_LIST.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label} ({st.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#3c3c43] mb-1.5">
                  Discussion Notes / Follow-up
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record discussion notes or next steps..."
                  className="ios-input w-full"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setStatusModalLead(null)}
                  className="ios-btn-gray text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ios-btn-primary text-xs"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
