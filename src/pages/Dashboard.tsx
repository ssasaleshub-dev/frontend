import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import AdminDashboardView from '../components/dashboard/AdminDashboardView';
import StaffDashboardView from '../components/dashboard/StaffDashboardView';
import { DashboardSkeleton } from '../components/common/SkeletonLoader';
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
} from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Lead, LeadAnalytics } from '../types';
import { encryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showAlert } = useAlert();

  const isAdmin = checkIsAdmin(currentUser);
  const isWorkVisa = isWorkVisaStaff(currentUser);
  const isStudyVisa = isStudyVisaStaff(currentUser);
  const isOtherVisa = isOtherVisaStaff(currentUser);

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
  const [showTodayLeads, setShowTodayLeads] = useState<boolean>(false);
  const [activeKpiIndex, setActiveKpiIndex] = useState<number>(0);
  const [weeklyViewMode, setWeeklyViewMode] = useState<'chart' | 'table'>('chart');
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<number | null>(null);

  // Auto-slide mobile KPI cards carousel in continuous loop to the right
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveKpiIndex((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(timer);
  }, []);
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
    window.addEventListener('app:pull-to-refresh', handleUpdate);
    return () => {
      window.removeEventListener('crm-data-updated', handleUpdate);
      window.removeEventListener('app:pull-to-refresh', handleUpdate);
    };
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
    const contactedCount = statusCounts.CONTACTED || 0;
    const qualifiedCount = statusCounts.QUALIFIED || 0;
    const contactedOrQualified = contactedCount + qualifiedCount;
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
      contactedCount,
      qualifiedCount,
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

  // Current day new leads for counselors (IST timezone)
  const todayLeads = useMemo(() => {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return displayLeads.filter((l) => {
      const rawDate = l.createdTime || l.createdDate || l.createdAt;
      if (!rawDate) return false;
      try {
        const leadDateIST = new Date(rawDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return leadDateIST === todayIST;
      } catch {
        return false;
      }
    });
  }, [displayLeads]);

  // ── Executive Weekly & Day-Wise Performance Report (For Admin) ──
  const weeklyReportData = useMemo(() => {
    // Current Indian Standard Time (IST)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDayIdx = nowIST.getDay(); // 0 = Sunday, 1 = Monday...
    const distToMon = (currentDayIdx + 6) % 7; // Monday = 0, Tuesday = 1, ..., Sunday = 6

    // Monday 00:00:00 of Current Week
    const thisMon = new Date(nowIST);
    thisMon.setDate(nowIST.getDate() - distToMon);
    thisMon.setHours(0, 0, 0, 0);

    // Monday 00:00:00 of Prior (Last) Week
    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const days = dayNames.map((shortName, i) => {
      // Date for this week
      const dThis = new Date(thisMon);
      dThis.setDate(thisMon.getDate() + i);
      const dThisKey = dThis.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const dThisLabel = dThis.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      // Date for last week
      const dLast = new Date(lastMon);
      dLast.setDate(lastMon.getDate() + i);
      const dLastKey = dLast.toLocaleDateString('en-CA');
      const dLastLabel = dLast.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      // Match all leads
      const thisWeekLeadsForDay = allLeads.filter((l) => {
        const raw = l.createdTime || l.createdDate || l.createdAt;
        if (!raw) return false;
        try {
          const leadIST = new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          return leadIST === dThisKey;
        } catch {
          return false;
        }
      });

      const lastWeekLeadsForDay = allLeads.filter((l) => {
        const raw = l.createdTime || l.createdDate || l.createdAt;
        if (!raw) return false;
        try {
          const leadIST = new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          return leadIST === dLastKey;
        } catch {
          return false;
        }
      });

      const thisCount = thisWeekLeadsForDay.length;
      const lastCount = lastWeekLeadsForDay.length;

      // Status metrics
      const won = thisWeekLeadsForDay.filter((l) => ['WON', 'CONVERTED'].includes((l.status || '').toUpperCase())).length;
      const inProcess = thisWeekLeadsForDay.filter((l) => ['QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION'].includes((l.status || '').toUpperCase())).length;
      const contacted = thisWeekLeadsForDay.filter((l) => (l.status || '').toUpperCase() === 'CONTACTED').length;
      const uncontacted = thisCount - (won + inProcess + contacted);

      // Channel metrics
      const ig = thisWeekLeadsForDay.filter((l) => l.platform === 'IG').length;
      const fb = thisWeekLeadsForDay.filter((l) => l.platform === 'FB').length;
      const wa = thisWeekLeadsForDay.filter((l) => l.platform === 'WHATSAPP').length;
      const directOrOther = thisCount - (ig + fb + wa);

      // Visa types
      const workCount = thisWeekLeadsForDay.filter((l) => isWorkVisaType(l.visaType)).length;
      const studyCount = thisWeekLeadsForDay.filter((l) => isStudyVisaType(l.visaType)).length;

      const isToday = i === distToMon;
      const isFuture = i > distToMon;

      const dayDiff = thisCount - lastCount;
      const dayDiffPct = lastCount > 0
        ? Math.round((dayDiff / lastCount) * 100)
        : thisCount > 0 ? 100 : 0;

      return {
        dayIndex: i,
        dayName: shortName,
        fullDayName: fullDayNames[i],
        dateLabel: dThisLabel,
        dateKey: dThisKey,
        lastWeekDateLabel: dLastLabel,
        thisCount,
        lastCount,
        dayDiff,
        dayDiffPct,
        won,
        inProcess,
        contacted,
        uncontacted,
        ig,
        fb,
        wa,
        directOrOther,
        workCount,
        studyCount,
        isToday,
        isFuture,
        leads: thisWeekLeadsForDay,
      };
    });

    const thisWeekTotal = days.reduce((sum, d) => sum + d.thisCount, 0);
    const lastWeekTotal = days.reduce((sum, d) => sum + d.lastCount, 0);
    const netDiff = thisWeekTotal - lastWeekTotal;
    const changePct = lastWeekTotal > 0
      ? Math.round((netDiff / lastWeekTotal) * 100)
      : thisWeekTotal > 0 ? 100 : 0;

    const daysElapsed = Math.min(distToMon + 1, 7);
    const dailyAverage = daysElapsed > 0 ? (thisWeekTotal / daysElapsed).toFixed(1) : '0';

    const maxDayCount = Math.max(...days.map((d) => Math.max(d.thisCount, d.lastCount)), 1);

    const activeDays = days.filter((d) => !d.isFuture);
    const peakDay = activeDays.length > 0
      ? activeDays.reduce((prev, curr) => curr.thisCount > prev.thisCount ? curr : prev, activeDays[0])
      : null;

    const totalWonThisWeek = days.reduce((sum, d) => sum + d.won, 0);
    const weeklyConversionRate = thisWeekTotal > 0 ? Math.round((totalWonThisWeek / thisWeekTotal) * 100) : 0;

    return {
      days,
      thisWeekTotal,
      lastWeekTotal,
      netDiff,
      changePct,
      dailyAverage,
      maxDayCount,
      peakDay,
      totalWonThisWeek,
      weeklyConversionRate,
    };
  }, [allLeads]);

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
      showAlert({ title: 'Dashboard', message: `Status update failed: ${err?.message || 'Server error'}` });
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
      {error && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="underline font-semibold hover:opacity-80 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Role-Specific High-Productivity Views or Skeleton Loader ── */}
      {loading && allLeads.length === 0 ? (
        <DashboardSkeleton />
      ) : isAdmin ? (
        <AdminDashboardView
          currentUser={currentUser}
          allLeads={allLeads}
          displayLeads={displayLeads}
          todayLeads={todayLeads}
          metrics={metrics}
          deskFilter={deskFilter}
          handleDeskChange={handleDeskChange}
          leadsByVisaType={leadsByVisaType}
          weeklyReportData={weeklyReportData}
          weeklyViewMode={weeklyViewMode}
          setWeeklyViewMode={setWeeklyViewMode}
          selectedWeeklyDay={selectedWeeklyDay}
          setSelectedWeeklyDay={setSelectedWeeklyDay}
          activeKpiIndex={activeKpiIndex}
          setActiveKpiIndex={setActiveKpiIndex}
          showTodayLeads={showTodayLeads}
          setShowTodayLeads={setShowTodayLeads}
          recentLeads={recentLeads}
          onOpenStatusModal={(lead) => {
            setStatusModalLead(lead);
            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
          }}
          navigate={navigate}
          renderVisaBadge={renderVisaBadge}
        />
      ) : (
        <StaffDashboardView
          currentUser={currentUser}
          leads={displayLeads}
          todayLeads={todayLeads}
          metrics={metrics}
          onOpenStatusModal={(lead) => {
            setStatusModalLead(lead);
            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
          }}
          navigate={navigate}
          renderVisaBadge={renderVisaBadge}
        />
      )}

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
                    value={statusModalLead.customerName || 'Candidate'}
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
