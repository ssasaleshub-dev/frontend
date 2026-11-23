import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Target,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  Users,
  RefreshCw,
  X,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import { useAuth } from '../context/AuthContext';
import { Lead } from '../types';
import {
  PLATFORMS,
  LEAD_STATUSES,
  filterLeadsByUserRole,
} from '../config/constants';
import { getLeadSourceLabel, LeadSourceLabelKind } from '../utils/formatUtils';
import { encryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';
import { formatIndianDateTime } from '../utils/dateTimeUtils';

interface CampaignGroup {
  /** Stable key for selection/URL (not always the same as the displayed label). */
  key: string;
  label: string;
  kind: LeadSourceLabelKind;
  leads: Lead[];
}

/** Short plain-language note shown under groups that aren't a real campaign. */
const KIND_NOTE: Record<LeadSourceLabelKind, string> = {
  campaign: '',
  organic: 'Came in without an ad',
  unmapped: 'Meta sent no campaign details',
  unknown: 'Source not recorded',
};

export default function Campaigns() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  const [campaignSearch, setCampaignSearch] = useState<string>('');
  const [leadSearch, setLeadSearch] = useState<string>('');
  const selectedKey = searchParams.get('campaign');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmService.getDetailedLeads();
      const list = Array.isArray(data) ? data : (data as any)?.content || [];
      setRawLeads(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load campaign data');
      setRawLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchLeads();
    }
    const handleUpdate = () => fetchLeads();
    window.addEventListener('crm-data-updated', handleUpdate);
    return () => window.removeEventListener('crm-data-updated', handleUpdate);
  }, [fetchLeads]);

  // Role-scoped leads (staff only ever see their own desk/assigned leads; backend also enforces this)
  const scopedLeads = useMemo(() => filterLeadsByUserRole(rawLeads, currentUser), [rawLeads, currentUser]);

  // Group leads into campaigns. Leads with no real campaign are bucketed by WHY they have none
  // (organic vs. a paid lead Meta didn't return attribution for), using the same logic as the
  // Leads page, so a counselor sees the same distinction everywhere.
  const campaigns: CampaignGroup[] = useMemo(() => {
    const groups = new Map<string, CampaignGroup>();
    scopedLeads.forEach((lead) => {
      const src = getLeadSourceLabel(lead);
      const key = src.kind === 'campaign' ? `c:${src.text}` : `k:${src.kind}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, label: src.text, kind: src.kind, leads: [] };
        groups.set(key, group);
      }
      group.leads.push(lead);
    });
    return Array.from(groups.values()).sort((a, b) => b.leads.length - a.leads.length);
  }, [scopedLeads]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => c.label.toLowerCase().includes(q));
  }, [campaigns, campaignSearch]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.key === selectedKey) || null,
    [campaigns, selectedKey]
  );

  const selectedCampaignLeads = useMemo(() => {
    if (!selectedCampaign) return [];
    const q = leadSearch.trim().toLowerCase();
    let list = [...selectedCampaign.leads];
    if (q) {
      list = list.filter((l) => {
        const name = (l.customerName || '').toLowerCase();
        const phone = (l.phoneNumber || '').toLowerCase();
        const city = (l.city || l.location || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || city.includes(q);
      });
    }
    return list.sort((a, b) => {
      const ta = new Date(a.createdTime || a.createdAt || 0).getTime();
      const tb = new Date(b.createdTime || b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [selectedCampaign, leadSearch]);

  const openCampaign = (key: string) => {
    setLeadSearch('');
    setSearchParams({ campaign: key });
  };

  const closeCampaign = () => {
    setSearchParams({});
  };

  const totals = useMemo(() => {
    const won = scopedLeads.filter((l) => ['WON', 'CONVERTED'].includes((l.status || '').toUpperCase())).length;
    const organic = scopedLeads.filter((l) => l.isOrganic === true).length;
    return { totalLeads: scopedLeads.length, totalCampaigns: campaigns.filter((c) => c.kind === 'campaign').length, won, organic };
  }, [scopedLeads, campaigns]);

  const stageBreakdown = useCallback((leads: Lead[]) => {
    const won = leads.filter((l) => ['WON', 'CONVERTED'].includes((l.status || '').toUpperCase())).length;
    const inProcess = leads.filter((l) => ['NEGOTIATION', 'PROPOSAL_SENT'].includes((l.status || '').toUpperCase())).length;
    const uncontacted = leads.filter((l) => !l.status || l.status === 'CREATED').length;
    return { won, inProcess, uncontacted };
  }, []);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    return formatIndianDateTime(isoStr, { fallback: isoStr });
  };

  if (loading && rawLeads.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
        <RefreshCw size={22} className="animate-spin text-slate-800" />
        <p className="text-xs font-medium">Loading campaigns...</p>
      </div>
    );
  }

  if (error && rawLeads.length === 0) {
    return (
      <div className="py-20 max-w-md mx-auto text-center space-y-4 px-4">
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={() => fetchLeads()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#007aff] hover:bg-[#0071e3] text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // ─────────────────────────── Campaign detail view ───────────────────────────
  if (selectedCampaign) {
    const breakdown = stageBreakdown(selectedCampaign.leads);
    return (
      <div className="space-y-4 max-w-6xl mx-auto pb-12">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeCampaign}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ChevronLeft size={15} />
            <span>All Campaigns</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-black/[0.06] shadow-xs p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{selectedCampaign.label}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {selectedCampaign.leads.length} candidate{selectedCampaign.leads.length === 1 ? '' : 's'}
                {KIND_NOTE[selectedCampaign.kind] ? ` · ${KIND_NOTE[selectedCampaign.kind]}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap self-center">
              <span><strong className="font-semibold text-slate-900">{breakdown.won}</strong> won</span>
              <span className="text-slate-300">·</span>
              <span><strong className="font-semibold text-slate-900">{breakdown.inProcess}</strong> in process</span>
              <span className="text-slate-300">·</span>
              <span><strong className="font-semibold text-slate-900">{breakdown.uncontacted}</strong> uncontacted</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder="Search by name, phone or city"
            className="w-full h-10 !pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
          />
          {leadSearch && (
            <button
              type="button"
              onClick={() => setLeadSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-3xl border border-black/[0.06] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Contact & Location</th>
                  <th className="py-3 px-4">Visa Program</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedCampaignLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No candidates match this search
                    </td>
                  </tr>
                ) : (
                  selectedCampaignLeads.map((lead) => {
                    const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
                    const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                      label: lead.status || 'New Lead',
                      color: 'bg-slate-100 text-slate-700',
                    };
                    const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                    const cleanName = (lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`).trim();
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{cleanName}</div>
                          {lead.email && <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{lead.email}</div>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-slate-800 font-semibold">{lead.phoneNumber || '—'}</div>
                          {(lead.city || lead.location) && (
                            <div className="text-[11px] text-slate-500 capitalize">{lead.city || lead.location}</div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">{plat.label}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{(lead.visaType || '—').replace('_', ' ')}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{stConfig.label}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{formatDate(lead.createdTime || lead.createdAt)}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {cleanPhone && (
                              <>
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="WhatsApp"
                                  className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-2xs"
                                >
                                  <MessageCircle size={13} className="text-emerald-600" />
                                </a>
                                <a
                                  href={`tel:${cleanPhone}`}
                                  title="Call"
                                  className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-2xs"
                                >
                                  <Phone size={13} className="text-slate-500" />
                                </a>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                              title="View Dossier"
                              className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-800 flex items-center justify-center shadow-2xs"
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
        </div>

        {/* Mobile cards */}
        <ul className="md:hidden bg-white rounded-3xl border border-black/[0.06] shadow-xs divide-y divide-slate-100 overflow-hidden">
          {selectedCampaignLeads.length === 0 ? (
            <li className="py-14 px-6 text-center text-sm text-slate-500">No candidates match this search</li>
          ) : (
            selectedCampaignLeads.map((lead) => {
              const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
              const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || { label: lead.status || 'New Lead' };
              const cleanName = (lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`).trim();
              return (
                <li
                  key={lead.id}
                  onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 cursor-pointer"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold flex items-center justify-center">
                    {(cleanName[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-slate-900 leading-5">{cleanName}</p>
                    <p className="truncate text-[13px] text-slate-500 leading-5">
                      <span className="tabular-nums">{lead.phoneNumber || 'No phone'}</span>
                      {(lead.city || lead.location) && <span className="capitalize"> · {lead.city || lead.location}</span>}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">{stConfig.label}</span>
                  </div>
                  {cleanPhone && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="WhatsApp"
                        className="w-9 h-9 flex items-center justify-center text-emerald-600 hover:text-emerald-700 active:opacity-60 transition-opacity"
                      >
                        <MessageCircle size={20} />
                      </a>
                      <a
                        href={`tel:${cleanPhone}`}
                        aria-label="Call"
                        className="w-9 h-9 flex items-center justify-center text-blue-600 hover:text-blue-700 active:opacity-60 transition-opacity"
                      >
                        <Phone size={19} />
                      </a>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }

  // ─────────────────────────── Campaign list view ───────────────────────────
  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Target size={20} className="text-[#007aff]" />
            Campaigns
          </h1>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
            placeholder="Search campaigns"
            className="w-full h-10 !pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Campaigns</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{totals.totalCampaigns}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Leads</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{totals.totalLeads}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Won / Enrolled</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">{totals.won}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Organic Leads</span>
          <span className="text-xl font-bold text-slate-500 mt-1 block">{totals.organic}</span>
        </div>
      </div>

      {/* Campaign cards */}
      {filteredCampaigns.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500 bg-white rounded-3xl border border-black/[0.06]">
          {campaignSearch ? 'No campaigns match this search' : 'No leads yet'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCampaigns.map((c) => {
            const breakdown = stageBreakdown(c.leads);
            const platformCounts = new Map<string, number>();
            c.leads.forEach((l) => {
              const p = (l.platform && PLATFORMS[l.platform]?.label) || 'Other';
              platformCounts.set(p, (platformCounts.get(p) || 0) + 1);
            });
            const lastLead = c.leads.reduce<Lead | null>((latest, l) => {
              const t = new Date(l.createdTime || l.createdAt || 0).getTime();
              const lt = latest ? new Date(latest.createdTime || latest.createdAt || 0).getTime() : -Infinity;
              return t > lt ? l : latest;
            }, null);

            return (
              <button
                key={c.key}
                type="button"
                onClick={() => openCampaign(c.key)}
                className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:bg-slate-50/60 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`text-[15px] leading-snug line-clamp-2 ${c.kind === 'campaign' ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}
                    title={c.label}
                  >
                    {c.label}
                  </h3>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5" />
                </div>
                {KIND_NOTE[c.kind] && <p className="mt-0.5 text-xs text-slate-400">{KIND_NOTE[c.kind]}</p>}

                <p className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold">{c.leads.length}</span> candidate{c.leads.length === 1 ? '' : 's'}
                  {breakdown.won > 0 && <span className="text-slate-500"> · {breakdown.won} won</span>}
                  {breakdown.inProcess > 0 && <span className="text-slate-500"> · {breakdown.inProcess} in process</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {Array.from(platformCounts.entries())
                    .map(([p, n]) => `${p} ${n}`)
                    .join(' · ')}
                </p>
                {lastLead && (
                  <p className="mt-2 text-xs text-slate-400">
                    Last lead {formatDate(lastLead.createdTime || lastLead.createdAt)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
