import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Phone,
  MessageCircle,
  RefreshCw,
  Eye,
  Trash2,
  Users,
  Briefcase,
  GraduationCap,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Lead } from '../../types';
import { encryptLeadId } from '../../utils/leadIdCrypto';

interface IosLeadListProps {
  leads: Lead[];
  loading: boolean;
  totalLeads: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onToggleContacted?: (lead: Lead, e: React.MouseEvent) => void;
  onOpenStatusModal: (lead: Lead, e: React.MouseEvent) => void;
  onDeleteLead: (id: number, name?: string) => void;
  getLeadQuality: (lead: Lead) => string;
  getBudgetReady: (lead: Lead) => any;
  formatDate: (dateStr?: string) => string;
}

/**
 * Pure Apple iOS UISwitch toggle component.
 * Exact replica of the green switches in iOS Settings (Cellular / Wi-Fi).
 */
export const IosSwitch: React.FC<{
  checked: boolean;
  onChange: (e: React.MouseEvent) => void;
  title?: string;
  disabled?: boolean;
}> = ({ checked, onChange, title = 'Toggle Status', disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(e);
      }}
      className={`relative inline-flex items-center w-[48px] h-[28px] rounded-full p-[2px] transition-colors duration-250 ease-in-out cursor-pointer select-none focus:outline-none shrink-0 ${
        checked ? 'bg-[#34c759]' : 'bg-[#e5e5ea]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}`}
    >
      <span
        className={`w-[24px] h-[24px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.18),0_1px_1px_rgba(0,0,0,0.1)] transform transition-transform duration-250 cubic-bezier(0.2,0.8,0.25,1) pointer-events-none ${
          checked ? 'translate-x-[20px]' : 'translate-x-[0px]'
        }`}
      />
    </button>
  );
};

/**
 * Apple Squircle Platform / App Icon.
 * Features exact iOS squircle corner radius (22.5%) and official platform palettes.
 */
export const IosPlatformSquircle: React.FC<{
  platform?: string;
  visaType?: string;
  customerName?: string;
  size?: number;
}> = ({ platform, visaType, customerName, size = 38 }) => {
  const p = (platform || '').toUpperCase();
  const initial = (customerName?.[0] || 'C').toUpperCase();

  // Instagram: Famous vibrant gradient + camera glyph
  if (p === 'IG' || p.includes('INSTAGRAM')) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-gradient-to-tr from-[#fd5949] via-[#d6249f] to-[#285aeb] flex items-center justify-center text-white shadow-xs shrink-0"
        title="Instagram Inquiry"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      </div>
    );
  }

  // Facebook: Meta Royal Blue + white 'f'
  if (p === 'FB' || p.includes('FACEBOOK') || p.includes('META')) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-[#1877f2] flex items-center justify-center text-white shadow-xs shrink-0"
        title="Facebook / Meta Inquiry"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </div>
    );
  }

  // WhatsApp: Emerald Green + speech phone
  if (p === 'WHATSAPP' || p.includes('WA')) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-[#25d366] flex items-center justify-center text-white shadow-xs shrink-0"
        title="WhatsApp Inquiry"
      >
        <MessageCircle size={20} className="fill-white stroke-none" />
      </div>
    );
  }

  // Google / Organic Web
  if (p === 'GOOGLE' || p === 'WEB' || p === 'WEBSITE') {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-[#4285f4] flex items-center justify-center text-white shadow-xs shrink-0"
        title="Website / Google Inquiry"
      >
        <Globe size={19} />
      </div>
    );
  }

  // Fallback based on Visa Desk or Candidate Initial
  if (visaType === 'WORK_VISA') {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-gradient-to-tr from-[#ff9500] to-[#ffaa33] flex items-center justify-center text-white shadow-xs shrink-0"
        title="Work Visa Candidate"
      >
        <Briefcase size={18} />
      </div>
    );
  }

  if (visaType === 'STUDY_VISA') {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-[9px] bg-gradient-to-tr from-[#5856d6] to-[#7a78e8] flex items-center justify-center text-white shadow-xs shrink-0"
        title="Study Visa Candidate"
      >
        <GraduationCap size={19} />
      </div>
    );
  }

  // Clean Apple Pastel Avatar
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-[9px] bg-gradient-to-tr from-[#007aff] to-[#34aadc] flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 select-none uppercase tracking-tight"
      title={customerName || 'Candidate'}
    >
      {initial}
    </div>
  );
};

export const IosLeadList: React.FC<IosLeadListProps> = ({
  leads,
  loading,
  totalLeads,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onToggleContacted,
  onOpenStatusModal,
  onDeleteLead,
  getLeadQuality,
  formatDate,
}) => {
  const navigate = useNavigate();
  const totalPages = Math.ceil(totalLeads / pageSize) || 1;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[rgba(60,60,67,0.08)] p-12 flex flex-col items-center justify-center gap-3 text-[#8e8e93]">
        <RefreshCw size={24} className="animate-spin text-[#007aff]" />
        <p className="text-xs font-medium">Loading candidate records...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[rgba(60,60,67,0.08)] p-12 flex flex-col items-center justify-center gap-2 text-[#8e8e93] text-center">
        <Users size={32} className="text-[#c7c7cc] mb-1" />
        <p className="font-semibold text-[#1c1c1e] text-sm">No candidate records match</p>
        <p className="text-xs text-[#8e8e93] max-w-sm">
          Try clearing your search or status filter tabs to see incoming inquiries.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* ── Apple HIG: Grouped Table View Header ── */}
      <div className="flex items-center justify-between px-3 text-[12px] font-semibold tracking-wider text-[#6e6e73] uppercase select-none">
        <div className="flex items-center gap-2">
          <span>Candidate Directory</span>
          <span className="text-[11px] font-normal normal-case text-[#86868b] bg-black/[0.04] px-2.5 py-0.5 rounded-full border border-black/[0.04]">
            {totalLeads} {totalLeads === 1 ? 'candidate' : 'candidates'}
          </span>
        </div>
        <span className="text-[11px] font-medium normal-case text-[#86868b]">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {/* ── Apple HIG: Inset Grouped Table Container ── */}
      <div className="bg-white rounded-[18px] sm:rounded-[22px] border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-black/[0.05]">
        {leads.map((lead) => {
          const quality = getLeadQuality(lead);
          const stage = (lead.status || 'CREATED').toUpperCase();

          // Clean status indicators (minimalist dot + text, no neon pills)
          let stageLabel = 'New Lead';
          let stageDotColor = 'bg-slate-400';
          let stageTextColor = 'text-slate-700';

          if (stage === 'CONTACTED') {
            stageLabel = 'Contacted';
            stageDotColor = 'bg-[#007aff]';
            stageTextColor = 'text-[#007aff]';
          } else if (stage === 'QUALIFIED') {
            stageLabel = 'Qualified';
            stageDotColor = 'bg-[#5856d6]';
            stageTextColor = 'text-[#5856d6]';
          } else if (stage === 'PROPOSAL_SENT') {
            stageLabel = 'Docs Requested';
            stageDotColor = 'bg-[#0284c7]';
            stageTextColor = 'text-[#0284c7]';
          } else if (stage === 'NEGOTIATION') {
            stageLabel = 'In Process';
            stageDotColor = 'bg-[#ff9500]';
            stageTextColor = 'text-[#ff9500]';
          } else if (stage === 'CONVERTED' || stage === 'WON') {
            stageLabel = stage === 'WON' ? 'Visa Approved' : 'Converted';
            stageDotColor = 'bg-[#34c759]';
            stageTextColor = 'text-[#248a3d] font-semibold';
          } else if (stage === 'LOST') {
            stageLabel = 'Lost / Closed';
            stageDotColor = 'bg-[#ff3b30]';
            stageTextColor = 'text-[#ff3b30]';
          }

          // Budget & Payment calculations
          const cachedBudget = localStorage.getItem(`ssa_lead_budget_${lead.id}`);
          const cachedPayment = localStorage.getItem(`ssa_lead_payment_status_${lead.id}`);
          const b = (lead as any).budgetRange || (lead as any).clientBudget || cachedBudget;
          const p = ((lead as any).paymentStatus || cachedPayment || '').toUpperCase();

          return (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
              className="px-3.5 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4 hover:bg-[#f9f9fb] active:bg-[#f2f2f7] transition-colors cursor-pointer select-none group"
            >
              {/* Left Column: App Squircle Icon */}
              <div className="shrink-0">
                <IosPlatformSquircle
                  platform={lead.platform}
                  visaType={lead.visaType}
                  customerName={lead.customerName}
                  size={42}
                />
              </div>

              {/* Primary Candidate Info (Title & Subtitle) */}
              <div className="min-w-0 flex-1">
                {/* Title Line */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] sm:text-[15px] font-semibold text-[#1c1c1e] group-hover:text-[#007aff] transition-colors truncate">
                    {lead.customerName || `Candidate #${lead.id}`}
                  </span>
                  {lead.visaType && (
                    <span className="text-[11px] font-normal text-[#8e8e93] shrink-0">
                      · {lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'}
                    </span>
                  )}
                  {quality !== '—' && (
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        quality === 'Hot'
                          ? 'text-[#ff3b30]'
                          : quality === 'Warm'
                          ? 'text-[#ff9500]'
                          : 'text-[#8e8e93]'
                      }`}
                    >
                      {quality}
                    </span>
                  )}
                </div>

                {/* Subtitle Line (Phone · City · External ID) */}
                <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-[#8e8e93] mt-0.5 truncate">
                  <span className="font-mono text-[#3c3c43]">
                    {lead.phoneNumber || 'No phone'}
                  </span>
                  {(lead.city || lead.location) && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{lead.city || lead.location}</span>
                    </>
                  )}
                  {lead.externalId && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-[#8e8e93]">
                        {lead.externalId}
                      </span>
                    </>
                  )}
                </div>

                {/* Mobile / Compact Info */}
                <div className="flex items-center gap-2 mt-1 sm:hidden flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => onOpenStatusModal(lead, e)}
                    className="text-[11px] font-medium hover:underline cursor-pointer"
                    title="Click to update stage"
                  >
                    <span className={stageTextColor}>{stageLabel}</span>
                  </button>
                  {b && (
                    <span className="text-[11px] font-semibold text-[#1c1c1e]">
                      ₹{b}
                    </span>
                  )}
                  <span className="text-[10px] text-[#8e8e93]">
                    {formatDate(lead.followUpDate || lead.createdTime || lead.createdAt)}
                  </span>
                </div>
              </div>

              {/* Desktop Mid-Column: Campaign, Financials, & Notes */}
              <div className="hidden lg:flex flex-col min-w-[200px] max-w-[280px] shrink-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-[#1d1d1f] truncate" title={lead.campaignName || 'Meta Organic'}>
                    {lead.campaignName || 'Meta Organic Ingestion'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {b ? (
                    <span className="text-[11px] font-semibold text-[#1c1c1e]">₹{b}</span>
                  ) : (
                    <span className="text-[11px] text-[#8e8e93]">Budget: —</span>
                  )}
                  <span>·</span>
                  {p === 'PAID' ? (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Paid
                    </span>
                  ) : p === 'PARTIAL' ? (
                    <span className="text-[11px] font-medium text-amber-700">
                      Partial
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#8e8e93]">Unsettled</span>
                  )}
                </div>
                {lead.notes && (
                  <p className="text-[11px] text-[#8e8e93] truncate mt-0.5 font-normal">
                    {lead.notes}
                  </p>
                )}
              </div>

              {/* Desktop Status & Follow-up Column */}
              <div className="hidden sm:flex flex-col items-end min-w-[130px] shrink-0">
                <button
                  type="button"
                  onClick={(e) => onOpenStatusModal(lead, e)}
                  className="text-[12px] font-medium hover:underline cursor-pointer"
                  title="Click to update stage"
                >
                  <span className={stageTextColor}>{stageLabel}</span>
                </button>
                <span className="text-[11px] text-[#8e8e93] mt-1 font-mono">
                  {formatDate(lead.followUpDate || lead.createdTime || lead.createdAt)}
                </span>
              </div>

              {/* Right Side: Quick Action Outreach + iOS Toggle Switch + Chevron */}
              <div
                className="flex items-center gap-2 sm:gap-2.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1-Tap WhatsApp outreach button */}
                {lead.phoneNumber && (
                  <a
                    href={`https://wa.me/${lead.phoneNumber.replace(
                      /\D/g,
                      ''
                    )}?text=Hello%20${encodeURIComponent(
                      lead.customerName || ''
                    )},%20greetings%20from%20our%20Overseas%20Visa%20Consultancy!%20We%20received%20your%20inquiry.`}
                    target="_blank"
                    rel="noreferrer"
                    title="WhatsApp Candidate"
                    className="w-8 h-8 rounded-full bg-[#25d366]/10 text-[#25d366] hover:bg-[#25d366] hover:text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    <MessageCircle size={15} />
                  </a>
                )}

                {/* 1-Tap Direct Call button */}
                {lead.phoneNumber && (
                  <a
                    href={`tel:${lead.phoneNumber}`}
                    title="Call Candidate"
                    className="w-8 h-8 rounded-full bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff] hover:text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    <Phone size={14} />
                  </a>
                )}

                {/* Apple Disclosure Chevron (Table Row > in Apple HIG) */}
                <button
                  type="button"
                  onClick={() => navigate(`/leads/${encryptLeadId(lead.id)}`)}
                  title="View Dossier"
                  className="text-[#c7c7cc] group-hover:text-[#007aff] transition-colors p-1"
                >
                  <ChevronRight size={18} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Apple HIG: Grouped Table View Footer ── */}
      <div className="px-3 text-[12px] text-[#8e8e93] flex flex-col sm:flex-row sm:items-center justify-between gap-1 select-none">
        <span>Tap any candidate row to inspect complete dossier, visa milestones, and timeline.</span>
        <span>Showing {leads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalLeads)} of {totalLeads} records</span>
      </div>

      {/* iOS Pagination Control */}
      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-[rgba(60,60,67,0.1)] p-3 px-4 flex items-center justify-between text-xs text-[#8e8e93]">
          <span>
            Page <strong className="text-[#1c1c1e]">{currentPage}</strong> of{' '}
            <strong className="text-[#1c1c1e]">{totalPages}</strong> ({totalLeads} total)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-xl border border-[rgba(60,60,67,0.12)] bg-[#f2f2f7] hover:bg-white text-[#1c1c1e] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-xs"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-[rgba(60,60,67,0.12)] bg-[#f2f2f7] hover:bg-white text-[#1c1c1e] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-xs"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IosLeadList;

