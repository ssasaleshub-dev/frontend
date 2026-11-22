import React, { useState, useMemo, useEffect } from 'react';
import { NavigateFunction } from 'react-router-dom';
import {
  Phone,
  MessageCircle,
  Search,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Lead } from '../../types';
import { LEAD_STATUSES } from '../../config/constants';
import { encryptLeadId, formatMaskedLeadRef } from '../../utils/leadIdCrypto';
import { formatIndianDate } from '../../utils/dateTimeUtils';

export interface StaffDashboardViewProps {
  currentUser: any;
  leads: Lead[];
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
  onOpenStatusModal: (lead: Lead) => void;
  navigate: NavigateFunction;
  renderVisaBadge: (visaType?: string) => React.ReactNode;
}

export const StaffDashboardView: React.FC<StaffDashboardViewProps> = ({
  currentUser,
  leads,
  todayLeads,
  metrics,
  onOpenStatusModal,
  navigate,
  renderVisaBadge,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNCONTACTED' | 'COUNSELING' | 'IN_PROCESS' | 'CONVERTED'>('ALL');

  // Counselor name & desk identification
  const staffName = currentUser?.firstName || currentUser?.login || 'Counselor';

  // Leads categorized for daily operational action
  const uncontactedLeads = useMemo(() => {
    return leads.filter((l) => {
      const st = (l.status || '').toUpperCase();
      return st === 'NEW' || st === 'CREATED' || !st;
    });
  }, [leads]);

  // Recent leads slice (max 6 fresh candidates for quick outreach)
  const recentSlice = useMemo(() => uncontactedLeads.slice(0, 6), [uncontactedLeads]);
  const [activeRecentIndex, setActiveRecentIndex] = useState(0);
  const [isRecentPaused, setIsRecentPaused] = useState(false);

  // Auto-looping carousel: changes slide every 2 seconds on mobile
  useEffect(() => {
    if (recentSlice.length <= 1 || isRecentPaused) return;
    const interval = setInterval(() => {
      setActiveRecentIndex((prev) => (prev + 1) % recentSlice.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [recentSlice.length, isRecentPaused]);

  const inCounselingLeads = useMemo(() => {
    return leads.filter((l) => {
      const st = (l.status || '').toUpperCase();
      return st === 'CONTACTED' || st === 'QUALIFIED';
    });
  }, [leads]);

  const inProcessLeads = useMemo(() => {
    return leads.filter((l) => {
      const st = (l.status || '').toUpperCase();
      return st === 'NEGOTIATION' || st === 'PROPOSAL_SENT';
    });
  }, [leads]);

  const convertedLeads = useMemo(() => {
    return leads.filter((l) => {
      const st = (l.status || '').toUpperCase();
      return st === 'CONVERTED' || st === 'WON';
    });
  }, [leads]);

  // Tab-filtered leads
  const tabLeads = useMemo(() => {
    switch (activeTab) {
      case 'UNCONTACTED':
        return uncontactedLeads;
      case 'COUNSELING':
        return inCounselingLeads;
      case 'IN_PROCESS':
        return inProcessLeads;
      case 'CONVERTED':
        return convertedLeads;
      default:
        return leads;
    }
  }, [activeTab, leads, uncontactedLeads, inCounselingLeads, inProcessLeads, convertedLeads]);

  // Search filtered leads
  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabLeads;
    return tabLeads.filter((l) => {
      const name = (l.customerName || '').toLowerCase();
      const phone = (l.phoneNumber || '').toLowerCase();
      const city = (l.city || l.location || '').toLowerCase();
      const visa = (l.visaType || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || city.includes(q) || visa.includes(q);
    });
  }, [tabLeads, searchQuery]);

  const renderRecentCard = (lead: Lead) => {
    const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
    const cleanName = (lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`)
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
      .trim();

    return (
      <div
        key={lead.id}
        onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
        className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group h-full"
        title="Click to view full candidate profile"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors break-words">
              {cleanName}
            </span>
            {renderVisaBadge(lead.visaType)}
          </div>

          <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-1">
            <span className="font-mono text-slate-800 font-semibold">{lead.phoneNumber || '—'}</span>
            {lead.city && <span>· {lead.city}</span>}
          </div>

          {lead.educationalQualification && (
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              🎓 {lead.educationalQualification} {lead.age ? `(${lead.age} yrs)` : ''}
            </p>
          )}
        </div>

        {/* 1-Click Action Bar */}
        <div
          className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            {cleanPhone && (
              <>
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
                  title="Chat on WhatsApp"
                >
                  <MessageCircle size={13} className="text-emerald-600" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${cleanPhone}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-colors"
                  title="Call candidate"
                >
                  <Phone size={13} className="text-slate-500" />
                  <span>Call</span>
                </a>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenStatusModal(lead)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Update
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Operational Staff Greeting & Desk Header ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              {staffName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Welcome, {staffName}
              </h1>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{formatIndianDate(new Date(), { weekday: true })}</span>
                <span>·</span>
                <span>Manage your candidate pipeline and daily follow-up calls</span>
              </p>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => navigate('/leads')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>All Candidates</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5"
            >
              <Send size={13} className="text-slate-600" />
              <span>Team Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Daily Operational KPI Cards (Simple Human Design) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today's Inflow */}
        <div
          onClick={() => setActiveTab('ALL')}
          className={`bg-white rounded-xl border p-4 sm:p-5 shadow-2xs transition-colors cursor-pointer ${
            activeTab === 'ALL'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium text-slate-500 truncate">
            Today's Inflow
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {todayLeads.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            Fresh candidates today
          </div>
        </div>

        {/* Card 2: Needs Immediate Call */}
        <div
          onClick={() => setActiveTab('UNCONTACTED')}
          className={`bg-white rounded-xl border p-4 sm:p-5 shadow-2xs transition-colors cursor-pointer ${
            activeTab === 'UNCONTACTED'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium text-slate-500 truncate">
            Needs First Call
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {uncontactedLeads.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            Awaiting first contact
          </div>
        </div>

        {/* Card 3: Active Counseling & Follow-ups */}
        <div
          onClick={() => setActiveTab('COUNSELING')}
          className={`bg-white rounded-xl border p-4 sm:p-5 shadow-2xs transition-colors cursor-pointer ${
            activeTab === 'COUNSELING'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium text-slate-500 truncate">
            In Counseling
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {inCounselingLeads.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            Qualified candidates
          </div>
        </div>

        {/* Card 4: Enrolled & Converted */}
        <div
          onClick={() => setActiveTab('CONVERTED')}
          className={`bg-white rounded-xl border p-4 sm:p-5 shadow-2xs transition-colors cursor-pointer ${
            activeTab === 'CONVERTED'
              ? 'border-slate-900 ring-1 ring-slate-900'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-medium text-slate-500 truncate">
            Visas Approved / Won
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            {convertedLeads.length}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {metrics.conversionRate}% desk conversion
          </div>
        </div>
      </div>

      {/* ── Recent Leads Section ── */}
      {recentSlice.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Recent Leads ({uncontactedLeads.length})
              </h3>
            </div>
            {recentSlice.length > 1 && (
              <span className="sm:hidden text-[11px] font-mono text-slate-400">
                {activeRecentIndex + 1}/{recentSlice.length}
              </span>
            )}
          </div>

          {/* Mobile Auto-Looping Carousel (< 640px) */}
          <div
            className="block sm:hidden overflow-hidden"
            onTouchStart={() => setIsRecentPaused(true)}
            onTouchEnd={() => setIsRecentPaused(false)}
            onMouseEnter={() => setIsRecentPaused(true)}
            onMouseLeave={() => setIsRecentPaused(false)}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeRecentIndex * 100}%)` }}
            >
              {recentSlice.map((lead) => (
                <div key={lead.id} className="w-full shrink-0 px-0.5">
                  {renderRecentCard(lead)}
                </div>
              ))}
            </div>

            {/* Carousel Loop Indicators */}
            {recentSlice.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                {recentSlice.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => setActiveRecentIndex(dotIdx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      activeRecentIndex === dotIdx ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300'
                    }`}
                    aria-label={`Slide ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop Responsive Grid (>= 640px) */}
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSlice.map((lead) => renderRecentCard(lead))}
          </div>
        </div>
      )}

      {/* ── My Leads Workspace (Filterable Operational Desk Table) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        {/* Workspace Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              All Leads ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('UNCONTACTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${activeTab === 'UNCONTACTED'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              Uncontacted ({uncontactedLeads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('COUNSELING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${activeTab === 'COUNSELING'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              In Counseling ({inCounselingLeads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('IN_PROCESS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${activeTab === 'IN_PROCESS'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              In Process ({inProcessLeads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CONVERTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${activeTab === 'CONVERTED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              Won / Enrolled ({convertedLeads.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, phone..."
              className="w-full !pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Workspace Leads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4">Contact & Location</th>
                <th className="py-3 px-4">Visa Program</th>
                <th className="py-3 px-4">Qualification</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4 text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No candidates found in this view
                  </td>
                </tr>
              ) : (
                filteredLeads.slice(0, 20).map((lead) => {
                  const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
                  const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                    label: lead.status || 'New Lead',
                    color: 'bg-slate-100 text-slate-700',
                  };
                  const cleanName = (lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`)
                    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
                    .trim();

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Candidate Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors break-words">
                          {cleanName}
                        </div>
                        {lead.email && <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{lead.email}</div>}
                      </td>

                      {/* Contact & Location */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800 font-semibold">{lead.phoneNumber || '—'}</div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-slate-500 capitalize">{lead.city || lead.location}</div>
                        )}
                      </td>

                      {/* Visa Program */}
                      <td className="py-3.5 px-4">{renderVisaBadge(lead.visaType)}</td>

                      {/* Qualification */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{lead.educationalQualification || '—'}</div>
                        {lead.age && <div className="text-[11px] text-slate-400">{lead.age} yrs</div>}
                      </td>

                      {/* Stage (Click to update) */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onOpenStatusModal(lead)}
                          className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition cursor-pointer"
                          title="Click to update stage"
                        >
                          {stConfig.label} ✎
                        </button>
                      </td>

                      {/* Instant Action */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {cleanPhone && (
                            <>
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp"
                                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <MessageCircle size={13} className="text-emerald-600" />
                              </a>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Call"
                                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <Phone size={13} className="text-slate-500" />
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                            title="View Full Candidate Dossier"
                            className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors shadow-2xs"
                          >
                            <ChevronRight size={14} />
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

        {/* Table Footer */}
        <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {Math.min(filteredLeads.length, 20)} of {filteredLeads.length} candidates in workspace
          </span>
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open Full Leads Table</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboardView;
