import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Megaphone,
  ShoppingBag,
  TrendingUp,
  MapPin,
  RefreshCw,
  Phone,
  MessageCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import { LEAD_STATUSES, PLATFORM_CONFIG } from '../config/constants';

export default function Dashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusModalLead, setStatusModalLead] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'CONTACTED', notes: '' });
  const hasLoadedRef = React.useRef(false);

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
      } else {
        setError('Could not load aggregated metrics');
      }

      if (leadsData.status === 'fulfilled') {
        const list = Array.isArray(leadsData.value) ? leadsData.value : [];
        setRecentLeads(list.slice(0, 5));
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch dashboard data');
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

  const handleQuickStatusUpdate = async (e) => {
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
    } catch (err) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const cleanLabel = (text) => {
    if (!text) return '';
    return text.replace(/[?_]+/g, ' ').trim();
  };

  const totalLeads = analytics?.totalLeads ?? 0;
  const convertedLeads = analytics?.leadsByStatus?.CONVERTED ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Mattress Sales & Campaign Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time lead submissions and marketing inquiries
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

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Leads</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {totalLeads}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Instagram: {analytics?.leadsByPlatform?.IG ?? 0}</span>
            <span>·</span>
            <span>Facebook: {analytics?.leadsByPlatform?.FB ?? 0}</span>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Customers</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <UserCheck size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {analytics?.totalCustomers ?? 0}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Registered customer records
          </div>
        </div>

        {/* Campaigns & Ads */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Campaigns</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <Megaphone size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">
              {analytics?.totalCampaigns ?? 0}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across {analytics?.totalAds ?? 0} active creatives
          </div>
        </div>

        {/* Conversion Ratio */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Conversion Rate</span>
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {conversionRate}%
            </span>
            <span className="text-xs text-slate-500">
              ({convertedLeads} converted)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Lifecycle conversion
          </div>
        </div>
      </div>

      {/* Status Pipeline Funnel */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Lead Pipeline</h3>
            <p className="text-xs text-slate-500">Breakdown by current stage</p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>View All Leads</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {LEAD_STATUSES.map((st) => {
            const count = analytics?.leadsByStatus?.[st.value] ?? 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div
                key={st.value}
                onClick={() => navigate(`/leads?status=${st.value}`)}
                className="p-3.5 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-colors cursor-pointer bg-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${st.dot || 'bg-slate-400'}`} />
                    <span className="text-xs font-medium text-slate-700">{st.label}</span>
                  </div>
                  <span className="text-xs text-slate-400">{pct}%</span>
                </div>
                <div className="text-xl font-bold text-slate-900 mt-2">{count}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">leads</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product & Marketing Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Preferred Mattress Size */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-slate-400" />
              Mattress Size Request
            </h3>
            <span className="text-[11px] text-slate-400">Demand</span>
          </div>
          <div className="space-y-2.5">
            {analytics?.leadsByMattressSize && Object.keys(analytics.leadsByMattressSize).length > 0 ? (
              Object.entries(analytics.leadsByMattressSize).map(([size, cnt]) => (
                <div key={size} className="flex items-center justify-between text-xs">
                  <span className="capitalize font-medium text-slate-700">{cleanLabel(size)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${totalLeads > 0 ? (cnt / totalLeads) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-900 w-4 text-right">{cnt}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No size requests recorded</p>
            )}
          </div>
        </div>

        {/* Geographic Location */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" />
              Customer Location
            </h3>
            <span className="text-[11px] text-slate-400">Region</span>
          </div>
          <div className="space-y-2.5">
            {analytics?.leadsByLocation && Object.keys(analytics.leadsByLocation).length > 0 ? (
              Object.entries(analytics.leadsByLocation).map(([loc, cnt]) => (
                <div key={loc} className="flex items-center justify-between text-xs">
                  <span className="capitalize font-medium text-slate-700">{loc}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${totalLeads > 0 ? (cnt / totalLeads) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-900 w-4 text-right">{cnt}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No location data recorded</p>
            )}
          </div>
        </div>

        {/* Budget Brackets */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-slate-400" />
              Budget Range
            </h3>
            <span className="text-[11px] text-slate-400">INR</span>
          </div>
          <div className="space-y-2.5">
            {analytics?.leadsByBudget && Object.keys(analytics.leadsByBudget).length > 0 ? (
              Object.entries(analytics.leadsByBudget).map(([bgt, cnt]) => (
                <div key={bgt} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 truncate max-w-[130px]" title={cleanLabel(bgt)}>
                    {cleanLabel(bgt)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${totalLeads > 0 ? (cnt / totalLeads) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="font-semibold text-slate-900 w-4 text-right">{cnt}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No budget data recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Detailed Leads Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Customer Inquiries</h3>
            <p className="text-xs text-slate-500">Incoming inquiries from Meta campaigns</p>
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
                <th className="py-3 px-4">Lead / Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Platform & Ad</th>
                <th className="py-3 px-4">Product Req</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-slate-600" />
                        Loading recent leads...
                      </span>
                    ) : (
                      <div>
                        <p className="text-slate-500 font-medium">No leads recorded yet.</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Use the Import Leads page to ingest records.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead) => {
                  const plat = PLATFORM_CONFIG[lead.platform] || PLATFORM_CONFIG.OTHER;
                  const stConfig = LEAD_STATUSES.find((s) => s.value === lead.status) || LEAD_STATUSES[0];
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {lead.customerName || (lead.customerId ? `Customer #${lead.customerId}` : `Inquiry #${lead.id}`)}
                        </div>
                        {lead.externalId && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            ID: {lead.externalId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{lead.phoneNumber || '—'}</div>
                        {lead.location && (
                          <div className="text-[11px] text-slate-500 capitalize">{lead.location}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {plat.label}
                          </span>
                          <span className="text-slate-600 truncate max-w-[140px]" title={lead.adName || lead.campaignName}>
                            {lead.adName || lead.campaignName || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 capitalize">
                          {lead.mattressSize ? `${lead.mattressSize} Mattress` : '—'}
                        </div>
                        {lead.budgetRange && (
                          <div className="text-[11px] text-slate-500">
                            {cleanLabel(lead.budgetRange)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setStatusModalLead(lead);
                            setStatusForm({ status: lead.status || 'CONTACTED', notes: lead.notes || '' });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stConfig.dot || 'bg-slate-400'}`} />
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
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                              <a
                                href={`tel:${lead.phoneNumber}`}
                                title="Call phone"
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

            <form onSubmit={handleQuickStatusUpdate} className="mt-4 space-y-4">
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
                  Sales Notes
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Record customer preferences, notes, or follow-up..."
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
    </div>
  );
}
