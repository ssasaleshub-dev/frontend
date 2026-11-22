import React from 'react';
import { NavigateFunction } from 'react-router-dom';
import {
  Clock,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
  BarChart3,
  Calendar,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { Lead } from '../../types';
import { PLATFORMS, LEAD_STATUSES } from '../../config/constants';
import { encryptLeadId, formatMaskedLeadRef } from '../../utils/leadIdCrypto';
import { formatIndianDate, formatIndianTime } from '../../utils/dateTimeUtils';
import CrmAnalyticsSection from '../analytics/CrmAnalyticsSection';

export interface AdminDashboardViewProps {
  currentUser: any;
  allLeads: Lead[];
  displayLeads: Lead[];
  todayLeads: Lead[];
  metrics: {
    total: number;
    wonCount: number;
    inProcessCount: number;
    contactedCount: number;
    qualifiedCount: number;
    studyVisaCount: number;
    workVisaCount: number;
    conversionRate: number;
    statusCounts: Record<string, number>;
  };
  deskFilter: 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA';
  handleDeskChange: (desk: 'ALL' | 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA') => void;
  leadsByVisaType: Record<string, number>;
  weeklyReportData: {
    netDiff: number;
    changePct: number;
    maxDayCount: number;
    days: Array<{
      dayName: string;
      fullDayName: string;
      dateLabel: string;
      lastWeekDateLabel: string;
      thisCount: number;
      lastCount: number;
      dayDiff: number;
      won: number;
      inProcess: number;
      contacted: number;
      ig: number;
      fb: number;
      wa: number;
      isToday: boolean;
      isFuture: boolean;
    }>;
  };
  weeklyViewMode: 'chart' | 'table';
  setWeeklyViewMode: (m: 'chart' | 'table') => void;
  selectedWeeklyDay: number | null;
  setSelectedWeeklyDay: (d: number | null) => void;
  activeKpiIndex: number;
  setActiveKpiIndex: (i: number) => void;
  showTodayLeads: boolean;
  setShowTodayLeads: React.Dispatch<React.SetStateAction<boolean>>;
  recentLeads: Lead[];
  onOpenStatusModal: (lead: Lead) => void;
  navigate: NavigateFunction;
  renderVisaBadge: (visaType?: string) => React.ReactNode;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  allLeads,
  displayLeads,
  todayLeads,
  metrics,
  deskFilter,
  handleDeskChange,
  leadsByVisaType,
  weeklyReportData,
  weeklyViewMode,
  setWeeklyViewMode,
  selectedWeeklyDay,
  setSelectedWeeklyDay,
  activeKpiIndex,
  setActiveKpiIndex,
  showTodayLeads,
  setShowTodayLeads,
  recentLeads,
  onOpenStatusModal,
  navigate,
  renderVisaBadge,
}) => {
  return (
    <div className="space-y-5">
      {/* ── Top Desk Filter Tabs (Admin Global Command) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleDeskChange('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            deskFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Visas ({allLeads.length})
        </button>
        <button
          type="button"
          onClick={() => handleDeskChange('WORK_VISA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            deskFilter === 'WORK_VISA'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Work Visa ({allLeads.filter((l) => (l.visaType || '').toUpperCase().includes('WORK')).length})
        </button>
        <button
          type="button"
          onClick={() => handleDeskChange('STUDY_VISA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            deskFilter === 'STUDY_VISA'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Study Visa ({allLeads.filter((l) => (l.visaType || '').toUpperCase().includes('STUDY')).length})
        </button>
        <button
          type="button"
          onClick={() => handleDeskChange('OTHER_VISA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            deskFilter === 'OTHER_VISA'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Other Visa ({allLeads.filter((l) => !((l.visaType || '').toUpperCase().includes('WORK') || (l.visaType || '').toUpperCase().includes('STUDY'))).length})
        </button>
      </div>

      {/* ── Metric Cards: Mobile Carousel (< 640px) ── */}
      <div className="block sm:hidden overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeKpiIndex * 100}%)` }}
        >
          {/* KPI 1 */}
          <div className="w-full shrink-0 px-0.5">
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs min-h-[110px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">Total Candidates</span>
                <span className="text-[10px] text-slate-400 font-mono">1/4</span>
              </div>
              <div className="my-1.5 text-3xl font-semibold text-slate-900 tracking-tight">
                {metrics.total}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {metrics.statusCounts.CREATED || 0} awaiting contact
              </div>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="w-full shrink-0 px-0.5">
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs min-h-[110px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">Work Visa Inquiries</span>
                <span className="text-[10px] text-slate-400 font-mono">2/4</span>
              </div>
              <div className="my-1.5 text-3xl font-semibold text-slate-900 tracking-tight">
                {metrics.workVisaCount}
              </div>
              <div className="text-xs text-slate-400 truncate">
                International job & permits
              </div>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="w-full shrink-0 px-0.5">
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs min-h-[110px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">Study Visa Inquiries</span>
                <span className="text-[10px] text-slate-400 font-mono">3/4</span>
              </div>
              <div className="my-1.5 text-3xl font-semibold text-slate-900 tracking-tight">
                {metrics.studyVisaCount}
              </div>
              <div className="text-xs text-slate-400 truncate">
                University & admissions desk
              </div>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="w-full shrink-0 px-0.5">
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs min-h-[110px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">Enrolled / Visa Approved</span>
                <span className="text-[10px] text-slate-400 font-mono">4/4</span>
              </div>
              <div className="my-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-slate-900 tracking-tight">
                  {metrics.wonCount}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ({metrics.conversionRate}% conversion)
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">
                {metrics.inProcessCount} dossiers in process
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Loop Indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {[0, 1, 2, 3].map((dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => setActiveKpiIndex(dotIdx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeKpiIndex === dotIdx ? 'w-5 bg-[#007aff]' : 'w-1.5 bg-slate-300'
              }`}
              aria-label={`Slide ${dotIdx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── Metric Cards: Desktop Grid (Simple Human Design) ── */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Desk Total Inquiries */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'Study Visa Students'
              : deskFilter === 'WORK_VISA'
                ? 'Work Visa Candidates'
                : 'Total Candidates'}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {metrics.total}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {metrics.statusCounts.CREATED || 0} awaiting contact
          </div>
        </div>

        {/* KPI 2: Contacted / Screened */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'In Student Counseling'
              : deskFilter === 'WORK_VISA'
                ? 'Screened & Qualified'
                : 'Work Visa Inquiries'}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {deskFilter === 'ALL' ? metrics.workVisaCount : metrics.contactedCount}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'Candidate profile evaluations'
              : deskFilter === 'WORK_VISA'
                ? 'Resume & skills screened'
                : 'International job & permits'}
          </div>
        </div>

        {/* KPI 3: In Process */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'Applications In Process'
              : deskFilter === 'WORK_VISA'
                ? 'Permits In Process'
                : 'Study Visa Inquiries'}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {deskFilter === 'ALL' ? metrics.studyVisaCount : metrics.inProcessCount}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'University offers & dossiers'
              : deskFilter === 'WORK_VISA'
                ? 'Work contracts & permit filings'
                : 'University & admissions desk'}
          </div>
        </div>

        {/* KPI 4: Approved / Converted */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 truncate">
            {deskFilter === 'STUDY_VISA'
              ? 'Admissions & Visas Approved'
              : deskFilter === 'WORK_VISA'
                ? 'Work Visas Approved'
                : 'Enrolled / Visa Approved'}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {metrics.wonCount}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              ({metrics.conversionRate}% conversion)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {metrics.inProcessCount} dossiers in process
          </div>
        </div>
      </div>

      {/* ── Today's Leads Section (High-Visibility Human Design) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden transition-all duration-200">
        <button
          type="button"
          onClick={() => setShowTodayLeads((v) => !v)}
          className="w-full px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
        >
          {/* Left: Branded Icon & Lead Information */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0866ff] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock size={18} className="text-[#0866ff]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Today's Leads
                </h3>
                {todayLeads.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0866ff] text-white shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>{todayLeads.length}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                    0
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {formatIndianDate(new Date(), { weekday: true })}
              </p>
            </div>
          </div>

          {/* Right: Prominent Count & Interactive Action */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none font-mono">
                  {todayLeads.length}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {todayLeads.length === 1 ? 'lead' : 'leads'}
                </span>
              </div>
              <div className="text-[11px] font-semibold flex items-center justify-end gap-1 mt-0.5 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="hidden xs:inline">Today's Inflow</span>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

            <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-[#0866ff] hover:bg-blue-100 transition-colors">
              <span>{showTodayLeads ? 'Hide' : 'View'}</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  showTodayLeads ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </div>
          </div>
        </button>

        {/* When user clicks, reveal records */}
        {showTodayLeads && (
          <div className="border-t border-black/[0.06]">
            {todayLeads.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-xs font-medium text-[#8e8e93]">No new leads received today</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-black/[0.06]">
                  {todayLeads.map((lead) => {
                    const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
                    const cleanName = (lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`)
                      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
                      .trim();

                    return (
                      <div
                        key={lead.id}
                        onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                        className="px-4 py-3 sm:px-5 hover:bg-black/[0.02] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        {/* Left: Candidate Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-[#1c1c1e] group-hover:text-[#007aff] transition-colors break-words">
                              {cleanName}
                            </span>
                            <span className="text-[11px] text-[#8e8e93]">
                              {lead.visaType === 'WORK_VISA'
                                ? 'Work Visa'
                                : lead.visaType === 'STUDY_VISA'
                                  ? 'Study Visa'
                                  : 'Other'}
                            </span>
                            {lead.createdTime && (
                              <span className="text-[11px] text-[#8e8e93]">
                                · {formatIndianTime(lead.createdTime)}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#8e8e93] flex items-center gap-2 mt-0.5 truncate">
                            {lead.city && <span>{lead.city}</span>}
                            {lead.phoneNumber && (
                              <>
                                {lead.city && <span>·</span>}
                                <span className="font-mono text-[#3a3a3c]">{lead.phoneNumber}</span>
                              </>
                            )}
                            {lead.educationalQualification && (
                              <>
                                <span>·</span>
                                <span className="hidden sm:inline truncate">{lead.educationalQualification}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: Clean Action Buttons */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp"
                                className="p-1.5 text-[#8e8e93] hover:text-[#34c759] hover:bg-black/[0.04] rounded-lg transition-colors"
                              >
                                <MessageCircle size={16} />
                              </a>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Call"
                                className="p-1.5 text-[#8e8e93] hover:text-[#007aff] hover:bg-black/[0.04] rounded-lg transition-colors"
                              >
                                <Phone size={16} />
                              </a>
                            </>
                          )}
                          <ChevronRight size={14} className="text-[#c7c7cc] group-hover:text-[#3a3a3c] transition-colors ml-0.5 hidden sm:inline" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Link to Leads Table */}
                <div className="px-4 py-2.5 sm:px-5 bg-black/[0.015] border-t border-black/[0.06] flex items-center justify-between text-xs">
                  <span className="text-[#8e8e93] text-[11px]">
                    {todayLeads.length} {todayLeads.length === 1 ? 'lead' : 'leads'} received today
                  </span>
                  <button
                    onClick={() => navigate('/leads')}
                    className="font-medium text-[#007aff] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all leads</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Pure SVG CRM Analytics Section (Admin Only: Leads Over Time, Sources, Funnel, Visa, Demographics) ── */}
      <CrmAnalyticsSection
        total={metrics.total}
        allLeads={allLeads}
        metrics={metrics}
        leadsByVisaType={leadsByVisaType}
      />

      {/* ── Executive Weekly & Day-Wise Performance Report (Admin Only) ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Header Strip */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={16} className="text-slate-800 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Weekly Lead Performance Report
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    weeklyReportData.netDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {weeklyReportData.netDiff >= 0 ? (
                    <TrendingUp size={13} className="shrink-0" />
                  ) : (
                    <TrendingDown size={13} className="shrink-0" />
                  )}
                  <span>
                    {weeklyReportData.netDiff >= 0
                      ? `+${weeklyReportData.changePct}%`
                      : `${weeklyReportData.changePct}%`}{' '}
                    vs last week
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle: Chart / Ledger */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg self-start sm:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setWeeklyViewMode('chart')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                weeklyViewMode === 'chart'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={13} />
              <span>Chart Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setWeeklyViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                weeklyViewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar size={13} />
              <span>Day-Wise Ledger</span>
            </button>
          </div>
        </div>

        {/* View Mode 1: Interactive Bar Graph */}
        {weeklyViewMode === 'chart' ? (
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-slate-500">
                Comparing daily incoming candidates (This Week vs Previous Week)
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                  This Week
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" />
                  Last Week
                </span>
              </div>
            </div>

            {/* Custom SVG/HTML Bar Chart */}
            <div className="h-44 sm:h-52 w-full pt-4 relative">
              {/* Horizontal Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                <div className="w-full border-b border-dashed border-slate-200" />
                <div className="w-full border-b border-dashed border-slate-200" />
                <div className="w-full border-b border-dashed border-slate-200" />
              </div>

              <div className="grid grid-cols-7 gap-2 sm:gap-4 h-full items-end pb-6">
                {weeklyReportData.days.map((d, idx) => {
                  const isSelected = selectedWeeklyDay === idx;
                  const thisPct = Math.min(Math.round((d.thisCount / weeklyReportData.maxDayCount) * 100), 100);
                  const lastPct = Math.min(Math.round((d.lastCount / weeklyReportData.maxDayCount) * 100), 100);

                  return (
                    <div
                      key={d.dayName}
                      onClick={() => setSelectedWeeklyDay(isSelected ? null : idx)}
                      className={`group flex flex-col items-center justify-end h-full cursor-pointer relative z-10 transition-all ${
                        d.isFuture ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      {/* Interactive Tooltip on hover / selection */}
                      {(isSelected || false) && (
                        <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in duration-150">
                          <div>
                            {d.fullDayName} ({d.dateLabel})
                          </div>
                          <div className="text-blue-300">
                            This: {d.thisCount} · Last: {d.lastCount}
                          </div>
                        </div>
                      )}

                      {/* Dual Columns Container */}
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                        {/* Last Week Bar */}
                        <div className="w-2.5 sm:w-5 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-medium text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.lastCount}
                          </span>
                          <div
                            style={{ height: `${Math.max(lastPct, d.lastCount > 0 ? 6 : 2)}%` }}
                            className="w-full bg-slate-200 group-hover:bg-slate-300 rounded-t transition-all duration-300"
                            title={`Last Week (${d.lastWeekDateLabel}): ${d.lastCount} leads`}
                          />
                        </div>

                        {/* This Week Bar */}
                        <div className="w-3.5 sm:w-7 flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] font-mono font-bold text-slate-800 mb-1">
                            {d.thisCount}
                          </span>
                          <div
                            style={{ height: `${Math.max(thisPct, d.thisCount > 0 ? 8 : 2)}%` }}
                            className={`w-full rounded-t transition-all duration-300 ${
                              d.isToday
                                ? 'bg-blue-600 ring-2 ring-blue-300 shadow-sm'
                                : 'bg-blue-600 group-hover:bg-blue-700'
                            }`}
                            title={`This Week (${d.dateLabel}): ${d.thisCount} leads`}
                          />
                        </div>
                      </div>

                      {/* Day Label Below Bar */}
                      <div className="mt-3 text-center">
                        <span
                          className={`text-[11px] block transition-colors ${
                            d.isToday ? 'font-bold text-blue-600' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {d.dayName}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono block">
                          {d.dateLabel.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Inspector Drawer (When user taps/clicks a specific day in the chart) */}
            {selectedWeeklyDay !== null && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in duration-200">
                {(() => {
                  const sel = weeklyReportData.days[selectedWeeklyDay];
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-900">
                            {sel.fullDayName}, {sel.dateLabel} (Detailed Breakdown)
                          </h4>
                          {sel.isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                              Current Day
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedWeeklyDay(null)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Close Details ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">Received Today</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{sel.thisCount} leads</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">Prior Week Same Day</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{sel.lastCount} leads</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">Converted / Won</span>
                          <p className="text-base font-bold text-emerald-600 mt-0.5">{sel.won} enrolled</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">Top Source</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">
                            {sel.ig >= sel.fb && sel.ig >= sel.wa && sel.ig > 0
                              ? `Instagram (${sel.ig})`
                              : sel.fb >= sel.wa && sel.fb > 0
                                ? `Facebook (${sel.fb})`
                                : sel.wa > 0
                                  ? `WhatsApp (${sel.wa})`
                                  : 'Direct / Walk-in'}
                          </p>
                        </div>
                      </div>

                      {sel.thisCount > 0 && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => navigate('/leads')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Explore all {sel.thisCount} candidates in Leads Manager</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          /* Day-Wise Full Ledger Table Mode */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Day & Date</th>
                  <th className="py-3 px-4 text-center">This Week</th>
                  <th className="py-3 px-4 text-center">Last Week</th>
                  <th className="py-3 px-4 text-center">Variance</th>
                  <th className="py-3 px-4">Stage Progress</th>
                  <th className="py-3 px-4">Sources (Meta / WA)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {weeklyReportData.days.map((d) => (
                  <tr
                    key={d.dayName}
                    className={`transition-colors ${
                      d.isToday ? 'bg-blue-50/75 hover:bg-blue-100/60 font-semibold' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={d.isToday ? 'text-blue-900 font-bold' : ''}>{d.fullDayName}</span>
                        <span className={d.isToday ? 'text-blue-700/80 font-normal' : 'text-slate-500 font-normal'}>
                          ({d.dateLabel})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      <span className="text-sm">{d.thisCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-600">
                      <span className="text-sm">{d.lastCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-xs">
                      {d.dayDiff > 0 ? (
                        <span className="text-emerald-600">+{d.dayDiff}</span>
                      ) : d.dayDiff < 0 ? (
                        <span className="text-rose-600">{d.dayDiff}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {d.won === 0 && d.inProcess === 0 && d.contacted === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2.5 text-xs">
                          {d.won > 0 && <span className="font-semibold text-emerald-700">{d.won} Won</span>}
                          {d.inProcess > 0 && (
                            <span className="font-semibold text-amber-700">{d.inProcess} In Process</span>
                          )}
                          {d.contacted > 0 && (
                            <span className="font-semibold text-blue-700">{d.contacted} Contacted</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        {d.ig > 0 && <span className="font-semibold text-pink-600">IG: {d.ig}</span>}
                        {d.fb > 0 && <span className="font-semibold text-blue-600">FB: {d.fb}</span>}
                        {d.wa > 0 && <span className="font-semibold text-emerald-600">WA: {d.wa}</span>}
                        {d.thisCount === 0 && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate('/leads')}
                        className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs transition cursor-pointer"
                      >
                        View Leads
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Candidate Inquiries Table (Admin Master Log) ── */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Recent Candidate Inquiries
            </h3>
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
                        <div className="font-semibold text-[#1c1c1e] group-hover:text-[#007aff] transition-colors break-words">
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
                      <td className="py-3.5 px-4">{renderVisaBadge(lead.visaType)}</td>

                      {/* Qualification & Age */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1c1c1e]">{lead.educationalQualification || '—'}</div>
                        {lead.age && <div className="text-[11px] text-[#8e8e93]">{lead.age}</div>}
                      </td>

                      {/* Source & Campaign */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-[#1c1c1e]">{plat.label}</div>
                        <div
                          className="text-[11px] text-[#8e8e93] truncate max-w-[120px] mt-0.5"
                          title={lead.campaignName}
                        >
                          {lead.campaignName || 'Direct'}
                        </div>
                      </td>

                      {/* Lifecycle Stage (Click to update) */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <span
                          onClick={() => onOpenStatusModal(lead)}
                          className="text-xs text-[#1c1c1e] hover:text-[#007aff] hover:underline cursor-pointer font-medium"
                          title="Click to update stage"
                        >
                          {stConfig.label}
                        </span>
                      </td>

                      {/* Quick Contact */}
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
    </div>
  );
};

export default AdminDashboardView;
