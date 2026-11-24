import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  RefreshCw,
  X,
  Search,
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

interface CampaignItem {
  key: string;
  name: string;
  note: string;
  un: boolean;
  fb: number;
  ig: number;
  won: number;
  last: string;
  latestPlatform?: 'FB' | 'IG';
  leads: Lead[];
}

const KIND_NOTE: Record<LeadSourceLabelKind, string> = {
  campaign: '',
  organic: 'Came in without an ad',
  unmapped: 'Meta sent no campaign details',
  unknown: 'Source not recorded',
};

const FBI = (
  <img
    src="/icons/facebook.png"
    alt="Facebook"
    className="w-full h-full object-cover rounded-full"
  />
);

const IGI = (
  <img
    src="/icons/instagram.png"
    alt="Instagram"
    className="w-full h-full object-cover rounded-full"
  />
);

const CH = (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default function Campaigns() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Filter & interaction state
  const [selectedDetail, setSelectedDetail] = useState<CampaignItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Candidate list search when drilled down
  const [candidateSearch, setCandidateSearch] = useState<string>('');
  const selectedKey = searchParams.get('campaign');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 1600);
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter leads based on user role
  const scopedLeads = useMemo(
    () => filterLeadsByUserRole(rawLeads, currentUser),
    [rawLeads, currentUser]
  );

  // Group leads into campaigns matching backend source labels
  const campaigns: CampaignItem[] = useMemo(() => {
    const groups = new Map<string, CampaignItem>();

    scopedLeads.forEach((lead) => {
      const src = getLeadSourceLabel(lead);
      const key = src.kind === 'campaign' ? `c:${src.text}` : `k:${src.kind}`;
      let item = groups.get(key);
      if (!item) {
        const isUn =
          src.kind === 'unmapped' ||
          src.kind === 'unknown' ||
          src.text.toLowerCase() === 'unattributed';
        item = {
          key,
          name: src.text,
          note: KIND_NOTE[src.kind] || '',
          un: isUn,
          fb: 0,
          ig: 0,
          won: 0,
          last: '',
          latestPlatform: 'FB',
          leads: [],
        };
        groups.set(key, item);
      }
      item.leads.push(lead);

      // Determine platform
      const p = (lead.platform || lead.leadSource || '').toUpperCase();
      const isIg = p === 'IG' || p.includes('INSTAGRAM');
      if (isIg) {
        item.ig += 1;
      } else {
        // Facebook or default Meta lead
        item.fb += 1;
      }

      // Check won / converted
      const st = (lead.status || '').toUpperCase();
      if (st === 'WON' || st === 'CONVERTED') {
        item.won += 1;
      }

      // Last lead timestamp & latest platform
      const t = lead.createdTime || lead.createdAt || '';
      if (t) {
        if (!item.last || new Date(t).getTime() >= new Date(item.last).getTime()) {
          item.last = t;
          item.latestPlatform = isIg ? 'IG' : 'FB';
        }
      }
    });

    return Array.from(groups.values());
  }, [scopedLeads]);

  const tot = (c: CampaignItem) => c.fb + c.ig;
  const T = useMemo(() => campaigns.reduce((a, c) => a + tot(c), 0), [campaigns]);
  const FB = useMemo(() => campaigns.reduce((a, c) => a + c.fb, 0), [campaigns]);
  const IG = T - FB;

  const wonTotal = useMemo(
    () =>
      scopedLeads.filter((l) =>
        ['WON', 'CONVERTED'].includes((l.status || '').toUpperCase())
      ).length,
    [scopedLeads]
  );

  const organicTotal = useMemo(
    () => scopedLeads.filter((l) => l.isOrganic === true).length,
    [scopedLeads]
  );

  const campaignCount = useMemo(
    () => campaigns.filter((c) => !c.un).length,
    [campaigns]
  );

  const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const fmt = (s?: string) => {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    const n = new Date();
    const y = new Date(n);
    y.setDate(n.getDate() - 1);
    const t = d
      .toLocaleTimeString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase();
    const k = (x: Date) => x.toDateString();
    return k(d) === k(n)
      ? 'Today, ' + t
      : k(d) === k(y)
      ? 'Yesterday, ' + t
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + t;
  };

  // Sorted campaigns
  const visibleCampaigns = useMemo(() => {
    const list = [...campaigns];
    list.sort((a, b) => tot(b) - tot(a));
    return list;
  }, [campaigns]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.key === selectedKey) || null,
    [campaigns, selectedKey]
  );

  const selectedCampaignLeads = useMemo(() => {
    if (!selectedCampaign) return [];
    const q = candidateSearch.trim().toLowerCase();
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
  }, [selectedCampaign, candidateSearch]);

  const openCampaign = (key: string) => {
    setCandidateSearch('');
    setSelectedDetail(null);
    setSearchParams({ campaign: key });
  };

  const closeCampaign = () => {
    setSearchParams({});
  };

  const copyCampaignName = (name: string) => {
    try {
      navigator.clipboard.writeText(name);
      showToast('Campaign name copied');
    } catch {
      showToast('Failed to copy');
    }
    setSelectedDetail(null);
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

  // ─────────────────────────── Candidate detail drill-down ───────────────────────────
  if (selectedCampaign) {
    const wonCount = selectedCampaign.leads.filter((l) =>
      ['WON', 'CONVERTED'].includes((l.status || '').toUpperCase())
    ).length;
    const inProcessCount = selectedCampaign.leads.filter((l) =>
      ['NEGOTIATION', 'PROPOSAL_SENT'].includes((l.status || '').toUpperCase())
    ).length;
    const uncontactedCount = selectedCampaign.leads.filter(
      (l) => !l.status || l.status === 'CREATED'
    ).length;

    return (
      <div className="space-y-4 max-w-5xl mx-auto pb-12 pt-2 px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeCampaign}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>All Campaigns</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedCampaign.name}</h1>
              <p className="text-xs text-slate-500 mt-1">
                {selectedCampaign.leads.length} candidate
                {selectedCampaign.leads.length === 1 ? '' : 's'}
                {selectedCampaign.note ? ` · ${selectedCampaign.note}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap self-center">
              <span>
                <strong className="font-semibold text-slate-900">{wonCount}</strong> won
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <strong className="font-semibold text-slate-900">{inProcessCount}</strong> in process
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <strong className="font-semibold text-slate-900">{uncontactedCount}</strong> uncontacted
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            placeholder="Search by name, phone or city"
            className="w-full h-10 !pl-9 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0866ff]/20"
          />
          {candidateSearch && (
            <button
              type="button"
              onClick={() => setCandidateSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Desktop candidate table */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
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
                    };
                    const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
                    const cleanName = (lead.customerName || 'Candidate').trim();
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {cleanName}
                          </div>
                          {lead.email && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {lead.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-slate-800 font-semibold">
                            {lead.phoneNumber || '—'}
                          </div>
                          {(lead.city || lead.location) && (
                            <div className="text-[11px] text-slate-500 capitalize">
                              {lead.city || lead.location}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">{plat.label}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {(lead.visaType || '—').replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                            {stConfig.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatIndianDateTime(lead.createdTime || lead.createdAt || '', {
                            fallback: '—',
                          })}
                        </td>
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

        {/* Mobile candidate cards */}
        <ul className="md:hidden bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {selectedCampaignLeads.length === 0 ? (
            <li className="py-14 px-6 text-center text-sm text-slate-500">
              No candidates match this search
            </li>
          ) : (
            selectedCampaignLeads.map((lead) => {
              const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
              const stConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
                label: lead.status || 'New Lead',
              };
              const cleanName = (lead.customerName || 'Candidate').trim();
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
                    <p className="truncate text-[15px] font-semibold text-slate-900 leading-5">
                      {cleanName}
                    </p>
                    <p className="truncate text-[13px] text-slate-500 leading-5">
                      <span className="tabular-nums">{lead.phoneNumber || 'No phone'}</span>
                      {(lead.city || lead.location) && (
                        <span className="capitalize"> · {lead.city || lead.location}</span>
                      )}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                      {stConfig.label}
                    </span>
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

  // ─────────────────────────── Main Campaigns UI ───────────────────────────
  return (
    <>
      <style>{`
        .crm-h {
          --bg:#fff;
          --soft:#f4f5f7;
          --line:#e6e8eb;
          --text:#1c1e21;
          --muted:#6b6f76;
          --faint:#9a9ea5;
          --blue:#0866ff;
          --fb:#1877f2;
          --ig:#d6336c;
          --green:#1b8a3c;
          color-scheme:light;
          background:var(--bg);
          color:var(--text);
          font-family:system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size:15px;
          line-height:1.35;
          -webkit-font-smoothing:antialiased;
          max-width:480px;
          margin:0 auto;
          min-height:100vh;
          padding-bottom:90px;
        }
        .crm-h * { box-sizing:border-box; }
        .crm-h button { font:inherit; cursor:pointer; color:inherit; }
        .crm-h svg { fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; flex:none; }
        .crm-h .hd { display:flex; align-items:center; padding:14px 12px 6px 20px; }
        .crm-h .hd h1 { flex:1; margin:0; font-size:26px; font-weight:700; letter-spacing:-.4px; }
        .crm-h .ib { width:42px; height:42px; border:0; background:none; border-radius:50%; display:grid; place-items:center; }
        .crm-h .ib svg { width:22px; height:22px; }
        .crm-h .ib:active { background:var(--soft); }
        .crm-h .sr { display:none; padding:6px 20px 4px; }
        .crm-h .sr.show { display:block; }
        .crm-h .sr input { width:100%; height:42px; border:0; border-radius:10px; background:var(--soft); padding:0 14px; font:inherit; color:var(--text); outline:0; }
        .crm-h .sr input:focus { box-shadow:0 0 0 2px var(--blue) inset; background:#fff; }
        .crm-h .st { display:grid; grid-template-columns:repeat(4,auto); justify-content:space-between; gap:0; padding:16px 20px 14px; }
        .crm-h .st div { padding-right:8px; }
        .crm-h .st div+div { border-left:1px solid var(--line); padding-left:14px; }
        .crm-h .st b { display:block; font-size:24px; font-weight:700; letter-spacing:-.4px; line-height:1.1; font-variant-numeric:tabular-nums; }
        .crm-h .st small { font-size:12px; color:var(--muted); }
        .crm-h .mix { padding:0 20px 14px; border-bottom:8px solid var(--soft); }
        .crm-h .mix p { margin:0 0 7px; font-size:13px; color:var(--muted); }
        .crm-h .mix p b { color:var(--text); font-weight:600; }
        .crm-h .mix div { display:flex; height:5px; border-radius:3px; overflow:hidden; gap:2px; }
        .crm-h .mix s { display:block; height:100%; text-decoration:none; }
        .crm-h .tabs { display:flex; padding:0 12px; border-bottom:1px solid var(--line); }
        .crm-h .tab { border:0; background:none; padding:12px 8px; margin:0 6px; font-size:14.5px; font-weight:600; color:var(--muted); border-bottom:2px solid transparent; margin-bottom:-1px; }
        .crm-h .tab.on { color:var(--text); border-color:var(--text); }
        .crm-h .sec { padding:16px 20px 6px; font-size:12px; font-weight:600; color:var(--muted); display:flex; justify-content:space-between; }
        .crm-h .row { display:flex; gap:14px; align-items:center; width:100%; border:0; background:none; text-align:left; padding:12px 16px 12px 20px; position:relative; }
        .crm-h .row:active { background:var(--soft); }
        .crm-h .row+.row::before { content:""; position:absolute; top:0; left:78px; right:0; border-top:1px solid var(--line); }
        .crm-h .av { width:42px; height:42px; flex:none; display:flex; align-items:center; justify-content:center; }
        .crm-h .av i { width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background:#fff; border:1px solid #e6e8eb; box-shadow:0 1px 3px rgba(0,0,0,0.08); overflow:hidden; }
        .crm-h .av i img { width:100%; height:100%; object-fit:cover; }
        .crm-h .tx { flex:1; min-width:0; }
        .crm-h .tt { font-size:15.5px; font-weight:600; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
        .crm-h .sb { font-size:13px; color:var(--muted); margin-top:2px; }
        .crm-h .sb.n { font-style:italic; color:var(--faint); }
        .crm-h .lt { font-size:12px; color:var(--faint); margin-top:1px; }
        .crm-h .nm { text-align:right; flex:none; display:flex; align-items:center; gap:6px; }
        .crm-h .nm b { font-size:19px; font-weight:700; letter-spacing:-.3px; font-variant-numeric:tabular-nums; }
        .crm-h .nm svg { width:16px; height:16px; color:var(--faint); }
        .crm-h .em { text-align:center; color:var(--muted); padding:48px 20px; }
        .crm-h .ov { position:fixed; inset:0; background:rgba(0,0,0,.4); display:none; z-index:100; }
        .crm-h .ov.show { display:block; }
        .crm-h .sheet { position:absolute; left:0; right:0; bottom:0; max-width:480px; margin:0 auto; background:#fff; border-radius:18px 18px 0 0; padding:8px 0 calc(16px + env(safe-area-inset-bottom,0px)); max-height:88vh; overflow:auto; }
        .crm-h .gr { width:40px; height:4px; border-radius:2px; background:#d3d6da; margin:4px auto 12px; }
        .crm-h .sh1 { padding:0 20px; }
        .crm-h .sh1 h2 { margin:0; font-size:20px; font-weight:700; line-height:1.25; letter-spacing:-.2px; overflow-wrap:anywhere; }
        .crm-h .sh1 p { margin:4px 0 0; font-size:13px; color:var(--faint); font-style:italic; }
        .crm-h .big { padding:14px 20px 4px; font-size:40px; font-weight:700; letter-spacing:-1px; line-height:1; }
        .crm-h .big span { font-size:15px; font-weight:400; color:var(--muted); letter-spacing:0; margin-left:6px; }
        .crm-h .kv { margin-top:10px; border-top:1px solid var(--line); }
        .crm-h .kv div { display:flex; align-items:center; gap:10px; padding:13px 20px; border-bottom:1px solid var(--line); }
        .crm-h .kv i { width:9px; height:9px; border-radius:50%; }
        .crm-h .kv span { flex:1; color:var(--muted); }
        .crm-h .kv b { font-weight:600; font-variant-numeric:tabular-nums; }
        .crm-h .kv em { font-style:normal; color:var(--faint); font-size:13px; min-width:38px; text-align:right; }
        .crm-h .go { display:block; width:calc(100% - 40px); margin:16px 20px 0; height:48px; border:0; border-radius:10px; background:var(--blue); color:#fff; font-weight:700; font-size:15.5px; }
        .crm-h .go:active { filter:brightness(.92); }
        .crm-h .lk { display:block; width:100%; margin-top:4px; height:44px; border:0; background:none; color:var(--blue); font-weight:600; font-size:14.5px; }
        .crm-h .op { display:flex; align-items:center; gap:14px; width:100%; border:0; background:none; padding:15px 20px; font-size:16px; text-align:left; }
        .crm-h .op:active { background:var(--soft); }
        .crm-h .op i { width:20px; height:20px; border-radius:50%; border:2px solid #c9ccd1; flex:none; }
        .crm-h .op.on { font-weight:700; }
        .crm-h .op.on i { border:6px solid var(--blue); }
        .crm-h .toast { position:fixed; left:50%; bottom:90px; transform:translateX(-50%); background:#242526; color:#fff; padding:10px 16px; border-radius:8px; font-size:14px; opacity:0; pointer-events:none; transition:.2s; z-index:110; white-space:nowrap; }
        .crm-h .toast.show { opacity:1; }

        /* Full Desktop View Enhancements (>= 768px) */
        @media (min-width: 768px) {
          .crm-h {
            max-width: 1060px;
            padding: 20px 24px 80px;
            background: transparent;
          }
          .crm-h .hd {
            padding: 0 4px 16px;
          }
          .crm-h .hd h1 {
            font-size: 30px;
            letter-spacing: -0.6px;
          }
          .crm-h .sr {
            display: block !important;
            padding: 0 4px 14px;
          }
          .crm-h .st {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 22px 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            margin-bottom: 12px;
          }
          .crm-h .st b {
            font-size: 28px;
          }
          .crm-h .mix {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 18px 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            margin-bottom: 20px;
            border-bottom: 1px solid var(--line);
          }
          .crm-h .mix div {
            height: 7px;
            border-radius: 4px;
          }
          .crm-h .tabs {
            padding: 0 4px;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--line);
          }
          .crm-h .tab {
            font-size: 15px;
            padding: 12px 18px;
          }
          .crm-h .sec {
            padding: 0 6px 12px;
          }
          .crm-h .row {
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 14px;
            margin-bottom: 10px;
            padding: 16px 22px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            transition: all 0.15s ease;
            cursor: pointer;
          }
          .crm-h .row:hover {
            background: #fbfcfd;
            border-color: #cbd5e1;
            box-shadow: 0 4px 14px rgba(0,0,0,0.05);
            transform: translateY(-1px);
          }
          .crm-h .row+.row::before {
            display: none;
          }
          .crm-h .ov {
            display: none;
            align-items: center;
            justify-content: center;
          }
          .crm-h .ov.show {
            display: flex;
          }
          .crm-h .sheet {
            position: relative;
            bottom: auto;
            max-width: 440px;
            border-radius: 20px;
            box-shadow: 0 20px 48px rgba(0,0,0,0.2);
            padding: 12px 0 24px;
            margin: auto;
          }
        }
      `}</style>

      <div className="crm-h" id="crmH">
        {/* Header */}
        <div className="hd">
          <h1>Campaigns</h1>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="st" id="st">
          <div>
            <b>{campaignCount}</b>
            <small>Campaigns</small>
          </div>
          <div>
            <b>{T}</b>
            <small>Total leads</small>
          </div>
          <div>
            <b style={{ color: 'var(--green)' }}>{wonTotal}</b>
            <small>Won</small>
          </div>
          <div>
            <b style={{ color: 'var(--faint)' }}>{organicTotal}</b>
            <small>Organic</small>
          </div>
        </div>

        {/* Distribution Mix Bar */}
        <div className="mix" id="mx">
          <p>
            <b>Instagram {pc(IG, T)}%</b> · Facebook {pc(FB, T)}%
          </p>
          <div>
            <s style={{ width: `${pc(IG, T)}%`, background: 'var(--ig)' }}></s>
            <s style={{ width: `${pc(FB, T)}%`, background: 'var(--fb)' }}></s>
          </div>
        </div>

        {/* Campaign List */}
        <div id="ls">
          {visibleCampaigns.length === 0 ? (
            <div className="em">No campaigns found</div>
          ) : (
            <>
              <div className="sec">
                <span>
                  {visibleCampaigns.length}{' '}
                  {visibleCampaigns.length === 1 ? 'campaign' : 'campaigns'}
                </span>
              </div>

              {visibleCampaigns.map((c) => {
                const hasBoth = c.fb > 0 && c.ig > 0;
                const isOnlyFb = c.fb > 0 && c.ig === 0;
                const total = tot(c);

                return (
                  <button
                    key={c.key}
                    type="button"
                    className="row"
                    onClick={() => setSelectedDetail(c)}
                  >
                    <div className="av">
                      <i>
                        {c.latestPlatform === 'IG' ? IGI : FBI}
                      </i>
                    </div>

                    <div className="tx">
                      <div className="tt">{c.name}</div>
                      {c.note ? (
                        <>
                          <div className="sb n">{c.note}</div>
                          <div className="lt">
                            Facebook {c.fb} · Instagram {c.ig}
                          </div>
                        </>
                      ) : (
                        <div className="sb">
                          Facebook {c.fb} · Instagram {c.ig}
                        </div>
                      )}
                      <div className="lt">Last lead {fmt(c.last)}</div>
                    </div>

                    <div className="nm">
                      <b>{total}</b>
                      {CH}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Campaign Detail Modal / Bottom Sheet */}
        {selectedDetail && (
          <div
            className="ov show"
            id="ov"
            onClick={() => setSelectedDetail(null)}
          >
            <div
              className="sheet"
              id="sh"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="gr"></div>
              <div className="sh1">
                <h2>{selectedDetail.name}</h2>
                {selectedDetail.note && <p>{selectedDetail.note}</p>}
              </div>
              <div className="big">
                {tot(selectedDetail)}
                <span>candidates</span>
              </div>
              <div className="kv">
                <div>
                  <img src="/icons/facebook.png" alt="Facebook" className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
                  <span>Facebook</span>
                  <b>{selectedDetail.fb}</b>
                  <em>{pc(selectedDetail.fb, tot(selectedDetail))}%</em>
                </div>
                <div>
                  <img src="/icons/instagram.png" alt="Instagram" className="w-[18px] h-[18px] rounded-full object-cover shrink-0" />
                  <span>Instagram</span>
                  <b>{selectedDetail.ig}</b>
                  <em>{pc(selectedDetail.ig, tot(selectedDetail))}%</em>
                </div>
                <div>
                  <i style={{ background: 'var(--green)' }}></i>
                  <span>Won / enrolled</span>
                  <b>{selectedDetail.won}</b>
                  <em>{pc(selectedDetail.won, tot(selectedDetail))}%</em>
                </div>
                <div>
                  <i style={{ background: '#c9ccd1' }}></i>
                  <span>Share of all leads</span>
                  <b>{tot(selectedDetail)}</b>
                  <em>{pc(tot(selectedDetail), T)}%</em>
                </div>
                <div>
                  <span>Last lead</span>
                  <b>{fmt(selectedDetail.last)}</b>
                </div>
              </div>
              <button
                type="button"
                className="go"
                onClick={() => openCampaign(selectedDetail.key)}
              >
                View {tot(selectedDetail)} candidates
              </button>
              <button
                type="button"
                className="lk"
                onClick={() => copyCampaignName(selectedDetail.name)}
              >
                Copy campaign name
              </button>
            </div>
          </div>
        )}

        {/* Notification Toast */}
        <div className={`toast ${toastMsg ? 'show' : ''}`} id="toast">
          {toastMsg}
        </div>
      </div>
    </>
  );
}
