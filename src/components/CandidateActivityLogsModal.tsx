import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Activity,
  ArrowRight,
  MessageCircle,
  Phone,
  Edit3,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';
import type { LeadActivity } from '../types';

interface CandidateActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: LeadActivity[];
  candidateName?: string;
  leadId: string | number;
}

export default function CandidateActivityLogsModal({
  isOpen,
  onClose,
  activities = [],
  candidateName = 'Candidate',
  leadId,
}: CandidateActivityLogsModalProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Type filter
      if (filterType !== 'ALL' && act.actionType !== filterType) {
        return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        act.userName?.toLowerCase().includes(q) ||
        act.title?.toLowerCase().includes(q) ||
        act.description?.toLowerCase().includes(q) ||
        act.fieldChanged?.toLowerCase().includes(q) ||
        act.oldValue?.toLowerCase().includes(q) ||
        act.newValue?.toLowerCase().includes(q)
      );
    });
  }, [activities, filterType, searchQuery]);

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (type: LeadActivity['actionType']) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return {
          label: 'Stage Update',
          icon: <Activity size={12} />,
          badgeClass: 'bg-[#007aff]/10 text-[#007aff] border-[#007aff]/20',
          dotClass: 'bg-[#007aff]',
        };
      case 'DATA_MODIFY':
        return {
          label: 'Dossier Modified',
          icon: <Edit3 size={12} />,
          badgeClass: 'bg-[#5856d6]/10 text-[#5856d6] border-[#5856d6]/20',
          dotClass: 'bg-[#5856d6]',
        };
      case 'REMARKS_ADDED':
        return {
          label: 'Counselor Remark',
          icon: <FileText size={12} />,
          badgeClass: 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/20',
          dotClass: 'bg-[#ff9500]',
        };
      case 'OUTREACH':
        return {
          label: 'Outreach',
          icon: <MessageCircle size={12} />,
          badgeClass: 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20',
          dotClass: 'bg-[#34c759]',
        };
      default:
        return {
          label: 'Activity',
          icon: <Clock size={12} />,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-400',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] border border-black/[0.08] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Apple iOS Frosted Header */}
        <div className="px-6 py-4.5 border-b border-black/[0.06] bg-white/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center shadow-xs">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1c1c1e] tracking-tight">
                  Activity & Audit Logs
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-[#007aff]/10 text-[#007aff] rounded-full">
                  {activities.length} {activities.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              <p className="text-xs text-[#8e8e93] font-medium mt-0.5">
                {candidateName} • Candidate #{leadId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] flex items-center justify-center transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 bg-[#f8f9fa] border-b border-black/[0.05] space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e93]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by counselor name, stage, field, or remarks..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-black/[0.08] rounded-xl text-xs text-[#1c1c1e] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#1c1c1e] text-xs"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* iOS Segmented Pill Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'STATUS_CHANGE', label: 'Stage Updates' },
              { id: 'DATA_MODIFY', label: 'Dossier Edits' },
              { id: 'REMARKS_ADDED', label: 'Counselor Notes' },
              { id: 'OUTREACH', label: 'Outreach' },
            ].map((tab) => {
              const active = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[#007aff] text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-[#3c3c43] border border-black/[0.06]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Activities Timeline Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredActivities.length === 0 ? (
            <div className="py-14 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History size={22} />
              </div>
              <h3 className="text-sm font-semibold text-[#1c1c1e]">No Activity Logs Found</h3>
              <p className="text-xs text-[#8e8e93] max-w-xs mx-auto">
                {searchQuery || filterType !== 'ALL'
                  ? 'No activity matches your current search or filter criteria.'
                  : 'Candidate activities, stage changes, and counselor remarks will be automatically recorded here.'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-5 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-[1.5px] before:bg-black/[0.08]">
              {filteredActivities.map((act) => {
                const badge = getActionBadge(act.actionType);
                const initials = (act.userName || 'Counselor')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div key={act.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${badge.dotClass} shadow-xs transition-transform group-hover:scale-125`}
                    />

                    {/* Activity Card */}
                    <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-black/[0.06] hover:border-black/[0.12] hover:bg-white shadow-xs hover:shadow-sm transition-all space-y-2">
                      {/* Top Meta Header: Counselor, Badge & Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* User Avatar Pill */}
                          <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {initials}
                          </div>
                          <span className="text-xs font-bold text-[#1c1c1e]">
                            {act.userName}
                          </span>
                          {act.userRole && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-[#8e8e93] font-medium">
                              {act.userRole.replace('ROLE_', '')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${badge.badgeClass}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[11px] text-[#8e8e93] font-medium">
                            {formatDate(act.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Main Title / Summary */}
                      <div className="text-xs font-semibold text-[#1c1c1e]">
                        {act.title}
                      </div>

                      {/* Diff Visualization (Status Change or Value Change) */}
                      {act.oldValue && act.newValue && act.oldValue !== act.newValue && (
                        <div className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-white rounded-xl border border-black/[0.05] text-xs">
                          {act.fieldChanged && (
                            <span className="text-[10px] uppercase font-bold text-[#8e8e93]">
                              {act.fieldChanged}:
                            </span>
                          )}
                          <span className="line-through text-[#ff3b30] font-medium">
                            {act.oldValue}
                          </span>
                          <ArrowRight size={12} className="text-[#8e8e93]" />
                          <span className="text-[#34c759] font-bold">
                            {act.newValue}
                          </span>
                        </div>
                      )}

                      {/* Description & Note Body */}
                      {act.description && (
                        <p className="text-xs text-[#3c3c43] leading-relaxed whitespace-pre-wrap font-normal">
                          {act.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* iOS Footer Action Bar */}
        <div className="px-6 py-3.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs text-[#8e8e93]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-[#34c759]" />
            <span>Audit trail auto-synchronized with counselor identity</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] font-semibold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

