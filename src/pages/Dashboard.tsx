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
} from 'lucide-react';
import crmService from '../services/api/crmService';
import {
  USER_ROLES,
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  filterLeadsByUserRole,
} from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { Lead, LeadAnalytics } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [_analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null);
  const [statusForm, setStatusForm] = useState<{ status: string; notes: string }>({
    status: 'CONTACTED',
    notes: '',
  });
  const hasLoadedRef = useRef<boolean>(false);

  const isAdmin = currentUser?.authorities?.includes(USER_ROLES.ADMIN);
  const isWorkVisaCounselor = currentUser?.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR);
  const isStudyVisaCounselor = currentUser?.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, leadsData] = await Promise.allSettled([
        crmService.getLeadAnalytics(),
        crmService.getDetailedLeads(),
      ]);

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }

      if (leadsData.status === 'fulfilled') {
        const list = Array.isArray(leadsData.value) ? leadsData.value : [];
        setAllLeads(list);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDashboardData();
    }

    const handleUpdate = () => loadDashboardData();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, [loadDashboardData]);

  // Scoped leads based on user's counselor role
  const scopedLeads = useMemo(() => {
    return filterLeadsByUserRole(allLeads, currentUser);
  }, [allLeads, currentUser]);

  // Derived metrics from scoped leads
  const metrics = useMemo(() => {
    const total = scopedLeads.length;
    const workVisaCount = scopedLeads.filter(
      (l) => (l.visaType || '').toUpperCase() === 'WORK_VISA'
    ).length;
    const studyVisaCount = scopedLeads.filter(
      (l) => (l.visaType || '').toUpperCase() === 'STUDY_VISA'
    ).length;

    // Source Platforms
    const igCount = scopedLeads.filter((l) => l.platform === 'IG').length;
    const fbCount = scopedLeads.filter((l) => l.platform === 'FB').length;
    const waCount = scopedLeads.filter((l) => l.platform === 'WHATSAPP').length;
    const otherCount = total - (igCount + fbCount + waCount);

    // Status counts
    const statusCounts: Record<string, number> = {};
    Object.keys(LEAD_STATUSES).forEach((st) => {
      statusCounts[st] = scopedLeads.filter((l) => l.status === st).length;
    });

    const wonCount = statusCounts.WON || 0;
    const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    // Education distribution
    const educationCounts: Record<string, number> = {};
    scopedLeads.forEach((l) => {
      const eq = l.educationalQualification || 'Not Specified';
      educationCounts[eq] = (educationCounts[eq] || 0) + 1;
    });

    // Age distribution
    const ageCounts: Record<string, number> = {};
    scopedLeads.forEach((l) => {
      const age = l.age || 'Not Specified';
      ageCounts[age] = (ageCounts[age] || 0) + 1;
    });

    return {
      total,
      workVisaCount,
      studyVisaCount,
      igCount,
      fbCount,
      waCount,
      otherCount,
      statusCounts,
      wonCount,
      conversionRate,
      educationCounts,
      ageCounts,
    };
  }, [scopedLeads]);

  const recentLeads = useMemo(() => {
    return scopedLeads.slice(0, 6);
  }, [scopedLeads]);

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
    const isWork = (type || '').toUpperCase() === 'WORK_VISA';
    const isStudy = (type || '').toUpperCase() === 'STUDY_VISA';

    if (isWork) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Briefcase size={11} className="text-emerald-700" />
          <span>Work Visa</span>
        </span>
      );
    }
    if (isStudy) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
          <GraduationCap size={11} className="text-indigo-700" />
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span>{type || 'General'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              {isWorkVisaCounselor && 'Work Visa Counselor Desk'}
              {isStudyVisaCounselor && 'Study Visa Counselor Desk'}
              {isAdmin && 'Overseas Work & Study Visa Consultancy Overview'}
              {!isWorkVisaCounselor && !isStudyVisaCounselor && !isAdmin && 'Consultancy Overview'}
            </h2>
            {isWorkVisaCounselor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Work Visa Focus
              </span>
            )}
            {isStudyVisaCounselor && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                Study Visa Focus
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time candidate inquiries from Instagram, Facebook, and WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-300 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="underline font-medium hover:text-amber-900"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Primary KPI Metric Cards (Prioritized by Role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {isWorkVisaCounselor ? 'Work Visa Inquiries' : isStudyVisaCounselor ? 'Study Visa Inquiries' : 'Total Candidate Leads'}
            </span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {metrics.total}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Active candidates</span>
            <span>·</span>
            <span>{metrics.statusCounts.CREATED || 0} new</span>
          </div>
        </div>

        {/* Card 2: Work Visa Leads (Prioritized for Work Visa Counselors and Admins) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Work Visa Inquiries</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <Briefcase size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {metrics.workVisaCount}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Employment & work permit candidates
          </div>
        </div>

        {/* Card 3: Study Visa Leads (Prioritized for Study Visa Counselors and Admins) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Study Visa Inquiries</span>
            <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-800 flex items-center justify-center border border-indigo-200">
              <GraduationCap size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {metrics.studyVisaCount}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            University & higher study admissions
          </div>
        </div>

        {/* Card 4: Enrollment / Visa Approved Rate */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Visa Approved / Enrolled</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Award size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {metrics.wonCount}
            </span>
            <span className="text-xs text-slate-500">
              ({metrics.conversionRate}% success)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Successful enrollment & visa grants
          </div>
        </div>
      </div>

      {/* Leads by Source Breakdown (Instagram vs Facebook vs WhatsApp) */}
      <div className="bg-white p-5 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Share2 size={15} className="text-slate-500" />
              <span>Candidate Inquiries by Marketing Source</span>
            </h3>
            <p className="text-xs text-slate-500">Distribution across Meta campaigns and WhatsApp outreach</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Source Attribution</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Instagram */}
          <div className="p-4 rounded-lg border border-pink-200 bg-pink-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-pink-700">Instagram Ads</span>
              <span className="text-xs font-bold text-pink-800">
                {metrics.total > 0 ? Math.round((metrics.igCount / metrics.total) * 100) : 0}%
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.igCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Instant forms & direct messages</p>
          </div>

          {/* Facebook */}
          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700">Facebook Ads</span>
              <span className="text-xs font-bold text-blue-800">
                {metrics.total > 0 ? Math.round((metrics.fbCount / metrics.total) * 100) : 0}%
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.fbCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Campaign lead forms & posts</p>
          </div>

          {/* WhatsApp */}
          <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700">WhatsApp Inquiries</span>
              <span className="text-xs font-bold text-emerald-800">
                {metrics.total > 0 ? Math.round((metrics.waCount / metrics.total) * 100) : 0}%
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.waCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Direct chat & click-to-WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Status Pipeline Funnel */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Counseling Pipeline Stages</h3>
            <p className="text-xs text-slate-500">Breakdown of assigned leads by progress stage</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>View All Leads</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {LEAD_STATUS_LIST.map((st) => {
            const count = metrics.statusCounts[st.value] || 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <div
                key={st.value}
                onClick={() => navigate(`/leads?status=${st.value}`)}
                className="p-3 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-colors cursor-pointer bg-white"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-700 truncate">{st.label}</span>
                  <span className="text-[10px] text-slate-400">{pct}%</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1.5">{count}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">candidates</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidate Profile Demographics (Education & Age) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Education Level Breakdown */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <GraduationCap size={14} className="text-slate-400" />
              Highest Education Qualification
            </h3>
            <span className="text-[11px] text-slate-400">Profile Distribution</span>
          </div>
          <div className="space-y-2.5">
            {Object.keys(metrics.educationCounts).length > 0 ? (
              Object.entries(metrics.educationCounts).map(([eq, cnt]) => (
                <div key={eq} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 truncate max-w-[200px]">{eq}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-900 w-4 text-right">{cnt}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No education profile data recorded</p>
            )}
          </div>
        </div>

        {/* Age Brackets */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              Candidate Age Demographics
            </h3>
            <span className="text-[11px] text-slate-400">Demographics</span>
          </div>
          <div className="space-y-2.5">
            {Object.keys(metrics.ageCounts).length > 0 ? (
              Object.entries(metrics.ageCounts).map(([age, cnt]) => (
                <div key={age} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 truncate max-w-[200px]">{age}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${metrics.total > 0 ? (cnt / metrics.total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-900 w-4 text-right">{cnt}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No age demographics recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Assigned Candidate Leads Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Candidate Inquiries</h3>
            <p className="text-xs text-slate-500">Latest incoming leads for counselor review</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-md border border-slate-300 transition-colors"
          >
            View All Leads →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Candidate / Lead</th>
                <th className="py-3 px-4">Phone & City</th>
                <th className="py-3 px-4">Visa Program</th>
                <th className="py-3 px-4">Education</th>
                <th className="py-3 px-4">Platform & Campaign</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-slate-600" />
                        Loading recent candidate inquiries...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-500 font-medium">No candidate inquiries recorded yet.</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Use the Import Leads page or create a candidate lead manually.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead) => {
                  const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                  const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                    label: lead.status || 'New',
                    color: 'bg-slate-100 text-slate-700',
                  };

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {lead.customerName || `Candidate #${lead.id}`}
                        </div>
                        {lead.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {lead.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{lead.phoneNumber || '—'}</div>
                        {(lead.city || lead.location) && (
                          <div className="text-[11px] text-slate-500 capitalize">{lead.city || lead.location}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {renderVisaBadge(lead.visaType)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{lead.educationalQualification || '—'}</div>
                        {lead.age && <div className="text-[11px] text-slate-400">{lead.age}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${plat.color}`}>
                            {plat.label}
                          </span>
                          <span className="text-slate-600 truncate max-w-[130px]" title={lead.campaignName}>
                            {lead.campaignName || 'Direct'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${stConfig.color} border-slate-200 hover:opacity-90 transition-opacity`}
                        >
                          <span>{stConfig.label}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phoneNumber && (
                            <>
                              <a
                                href={`https://wa.me/${lead.phoneNumber.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call candidate"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
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

      {/* Quick Status Update Modal */}
      {statusModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Update Status: {statusModalLead.customerName || `Inquiry #${statusModalLead.id}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Current stage: <strong className="text-slate-800">{statusModalLead.status}</strong>
            </p>

            <form onSubmit={handleQuickStatusUpdate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
                  Counselor Notes
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record candidate discussion, eligibility assessment, or next steps..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
    </div>
  );
}
