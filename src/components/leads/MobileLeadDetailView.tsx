import React, { useState, useRef } from 'react';
import { parseFormResponses, humanizeAnswer, getAttributionRows, getOriginLabel, getInstagramDmRecipientId } from '../../utils/metaLead';
import { NavigateFunction } from 'react-router-dom';
import { Lead, LeadActivity } from '../../types';
import { formatIndianDate, formatIndianDateTime } from '../../utils/dateTimeUtils';
import { formatCurrencyDisplay, isAcademicScore, formatAcademicScore } from '../../utils/formatUtils';
import { Search, X, FileText, Upload, Eye, Trash2 } from 'lucide-react';
import DotsLoader from '../common/DotsLoader';
import DocumentTypeSelect from '../common/DocumentTypeSelect';

export interface MobileLeadDetailViewProps {
  lead: Lead;
  notesHistory: Array<{ note: string; date: string; author: string; raw?: string }>;
  activities: LeadActivity[];
  availableStaff: Array<{ login: string; name?: string }>;
  isAdmin: boolean;
  STAGES: Array<{ key: string; label: string }>;
  curStageIndex: number;
  closingInfo: {
    closingDateDisplay: string;
    progressPercent: number | null;
    milestoneBadge: string | null;
  };
  effectivePaymentStatus: string;
  handleStatusChange: (newStatus: string) => Promise<void>;
  handleUpdatePaymentStatus: (status: 'UNPAID' | 'PARTIAL' | 'PAID') => Promise<void>;
  handleCreateNote: () => Promise<void>;
  handleDeleteRemark: (index: number) => Promise<void>;
  newNote: string;
  setNewNote: (val: string) => void;
  submittingNote: boolean;
  onOpenEdit: () => void;
  onOpenReminder: () => void;
  onOpenEmail: () => void;
  onOpenInstagram: () => void;
  onCreateGoogleMeet: () => void;
  onDelete: () => void;
  onAssignStaff: (staffLogin: string) => Promise<void>;
  assigningStaff: boolean;
  onUpdateBudget: (newBudget: string) => Promise<void>;
  navigate: NavigateFunction;
  sentEmails?: Array<{ id: string; from: string; to: string; subject: string; body: string; sentAt: string }>;
  candidateDocs?: Array<{ id: string; name: string; docType: string; url: string; uploadedAt: string; size?: number }>;
  onUploadDoc?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDeleteDoc?: (docId: string) => void;
  onPreviewDoc?: (doc: { id: string; name: string; docType: string; url: string; uploadedAt: string; size?: number }) => void;
  emailTo?: string;
  setEmailTo?: (val: string) => void;
  emailSubject?: string;
  setEmailSubject?: (val: string) => void;
  emailBody?: string;
  setEmailBody?: (val: string) => void;
  sendingEmail?: boolean;
  connectedGoogleEmail?: string;
  handleSendCandidateEmail?: (e: React.FormEvent) => Promise<void>;
  docTypeInput?: string;
  setDocTypeInput?: (val: string) => void;
  uploadingDoc?: boolean;
}

export const MobileLeadDetailView: React.FC<MobileLeadDetailViewProps> = ({
  lead,
  notesHistory,
  activities,
  availableStaff,
  isAdmin,
  STAGES,
  curStageIndex,
  closingInfo,
  effectivePaymentStatus,
  handleStatusChange,
  handleUpdatePaymentStatus,
  handleCreateNote,
  handleDeleteRemark,
  newNote,
  setNewNote,
  submittingNote,
  onOpenEdit,
  onOpenReminder,
  onOpenEmail,
  onOpenInstagram,
  onCreateGoogleMeet,
  onDelete,
  onAssignStaff,
  assigningStaff,
  onUpdateBudget,
  navigate,
  sentEmails = [],
  candidateDocs = [],
  onUploadDoc,
  onDeleteDoc,
  onPreviewDoc,
  emailTo = '',
  setEmailTo,
  emailSubject = '',
  setEmailSubject,
  emailBody = '',
  setEmailBody,
  sendingEmail = false,
  connectedGoogleEmail = '',
  handleSendCandidateEmail,
  docTypeInput = 'Passport / ID',
  setDocTypeInput,
  uploadingDoc = false,
}) => {
  const [activeTab, setActiveTab] = useState<'ov' | 'pay' | 'fm' | 'nt' | 'ac' | 'em' | 'doc'>('ov');
  const [activityFilter, setActivityFilter] = useState<string>('ALL');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // Everything Meta sent for this lead
  const formResponses = parseFormResponses((lead as any).metaFormResponses);
  const attributionRows = getAttributionRows(lead as any);
  const origin = getOriginLabel(lead.isOrganic);
  const [showStageSheet, setShowStageSheet] = useState<boolean>(false);
  const [showMoreSheet, setShowMoreSheet] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastTimer, setToastTimer] = useState<any>(null);

  const showToast = (msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMsg(msg);
    const t = setTimeout(() => setToastMsg(null), 1800);
    setToastTimer(t);
  };

  const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
  const candidateName = lead.customerName || 'Candidate';
  const initial = candidateName.charAt(0).toUpperCase();

  const visaLabel =
    lead.visaType === 'WORK_VISA'
      ? 'Work Visa'
      : lead.visaType === 'STUDY_VISA'
        ? 'Study Visa'
        : 'Other Visa';

  const inquiriesDate = formatIndianDateTime(
    lead.createdTime || (lead as any).createdAt,
    { fallback: '22 Nov 2026, 1:55 pm' }
  );

  const startDate = formatIndianDate(
    lead.createdTime || (lead as any).createdAt,
    { fallback: '22 Nov 2026' }
  );

  const closingDate = closingInfo.closingDateDisplay || '24 Jan 2027';

  // Budget prompt
  const handleBudgetClick = async () => {
    const raw = lead.budgetRange || lead.clientBudget || '';
    const currentBudget = isAcademicScore(raw) ? '' : raw;
    const entered = window.prompt('Set client budget:', currentBudget);
    if (entered !== null) {
      await onUpdateBudget(entered);
      showToast('Budget updated');
    }
  };

  // Copy phone
  const handleCopyPhone = () => {
    if (!lead.phoneNumber) {
      showToast('No phone number');
      return;
    }
    try {
      navigator.clipboard.writeText(lead.phoneNumber);
      showToast('Phone copied');
    } catch {
      showToast('Copied');
    }
  };

  // Switch to Emails tab and scroll smoothly
  const handleNavigateToEmails = () => {
    setActiveTab('em');
    setTimeout(() => {
      const tabEl = document.getElementById('tab-btn-em');
      if (tabEl) {
        tabEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      const paneEl = document.getElementById('p-em');
      if (paneEl) {
        paneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <div className="crm-l" id="crmL">
      {/* Top Bar */}
      <div className="top">
        <button
          className="ib"
          id="bk"
          onClick={() => navigate('/leads')}
          aria-label="Back to leads"
        >
          <svg viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <b>Lead details</b>
        <button
          className="ib"
          id="mn"
          onClick={() => setShowMoreSheet(true)}
          aria-label="More options"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>

      {/* Hero Section */}
      <section className="hero">
        <div className="who">
          <div className="av" id="av">
            {initial}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 id="nm">{candidateName}</h1>
              <span className="tag" id="vs">
                {visaLabel}
              </span>
            </div>
          </div>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--muted)' }} id="mt">
          ID: {lead.externalId || lead.id} · {lead.city || lead.location || 'Location'} · Inquired {inquiriesDate}
        </p>

        {/* Dates */}
        <div className="dates" style={{ marginTop: '12px' }}>
          <span>
            Start <b id="ds">{startDate}</b>
          </span>
          <span>
            Closing <b id="dc">{closingDate}</b>
          </span>
        </div>

        {/* Chevron Stages Pipeline */}
        <div className="stages">
          {STAGES.map((s, i) => {
            const isDone = i < curStageIndex && curStageIndex < 7;
            const isCur = i === curStageIndex;
            const isLostCur = i === 7 && isCur;
            const className = `st ${isDone ? 'done' : ''} ${isCur ? 'cur' : ''} ${isLostCur ? 'lost cur' : ''}`.trim();
            return (
              <button
                key={s.key}
                type="button"
                className={className}
                onClick={async () => {
                  await handleStatusChange(s.key);
                  showToast(`Stage: ${s.label}`);
                }}
                title={`Move stage to ${s.label}`}
              >
                {isDone ? '✓ ' : ''}{s.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky Tabs */}
      <div className="tabs" id="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'ov' ? 'on' : ''}`}
          onClick={() => setActiveTab('ov')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'pay' ? 'on' : ''}`}
          onClick={() => setActiveTab('pay')}
        >
          Payments
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'fm' ? 'on' : ''}`}
          onClick={() => setActiveTab('fm')}
        >
          Form
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'nt' ? 'on' : ''}`}
          onClick={() => setActiveTab('nt')}
        >
          Notes<i>{notesHistory.length}</i>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'ac' ? 'on' : ''}`}
          onClick={() => setActiveTab('ac')}
        >
          Activity Logs<i>{activities.length}</i>
        </button>
        <button
          type="button"
          id="tab-btn-em"
          className={`tab ${activeTab === 'em' ? 'on' : ''}`}
          onClick={() => setActiveTab('em')}
        >
          Emails<i>{sentEmails.length}</i>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'doc' ? 'on' : ''}`}
          onClick={() => setActiveTab('doc')}
        >
          Documents<i>{candidateDocs.length}</i>
        </button>
      </div>

      {/* Pane: Overview */}
      <div className={`pane ${activeTab === 'ov' ? 'on' : ''}`} id="p-ov">
        <section className="card">
          <h3>
            <span>Lead information</span>
            <button type="button" id="ed" onClick={onOpenEdit}>
              Edit
            </button>
          </h3>
          <div className="f">
            <span className="l">Name</span>
            <span className="v" id="fn">
              {candidateName}
            </span>
          </div>

          <a className="f tap" id="fp" href={`tel:${cleanPhone}`}>
            <span className="l">Phone</span>
            <span className="v" id="fpv">
              {lead.phoneNumber || '—'}
            </span>
            <span className="ac">
              <svg viewBox="0 0 24 24">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
              </svg>
            </span>
          </a>

          {lead.email ? (
            <a className="f tap" id="fe" href={`mailto:${lead.email}`}>
              <span className="l">Email</span>
              <span className="v" id="fev">
                {lead.email}
              </span>
              <span className="ac">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </span>
            </a>
          ) : (
            <div className="f">
              <span className="l">Email</span>
              <span className="v em">Not provided</span>
            </div>
          )}

          <div className="f">
            <span className="l">Location</span>
            <span className="v" id="fl">
              {lead.city || lead.location || '—'}
            </span>
          </div>

          <div className="f">
            <span className="l">Owner</span>
            <span className="v">
              <select
                id="ow"
                value={lead.assignedTo || ''}
                onChange={(e) => onAssignStaff(e.target.value)}
                disabled={assigningStaff || !isAdmin}
              >
                <option value="">Unassigned (General Pool)</option>
                {availableStaff.map((staff) => (
                  <option key={staff.login} value={staff.login}>
                    {staff.name ? `${staff.name} (${staff.login})` : staff.login}
                  </option>
                ))}
              </select>
            </span>
          </div>

          <div className="f">
            <span className="l">Source</span>
            <span className="v">
              {lead.platform === 'IG'
                ? 'Instagram Ads'
                : lead.platform === 'FB'
                  ? 'Facebook Ads'
                  : lead.platform === 'WHATSAPP'
                    ? 'WhatsApp Inbound'
                    : 'Meta Lead Ads'}
            </span>
          </div>

          {(() => {
            const raw = lead.budgetRange || lead.clientBudget || '';
            const valid = !isAcademicScore(raw) && raw;
            const display = valid ? (formatCurrencyDisplay(raw) || raw) : '';
            return (
              <div className="f">
                <span className="l">Budget</span>
                <span className={`v ${display ? '' : 'em'}`}>
                  {display || 'Not specified'}
                </span>
              </div>
            );
          })()}

          {(((lead as any).studentPercentage || (lead as any).cgpa) || isAcademicScore(lead.budgetRange || lead.clientBudget)) && (
            <div className="f">
              <span className="l">Score / CGPA</span>
              <span className="v">
                {formatAcademicScore(
                  (lead as any).studentPercentage ||
                  (lead as any).cgpa ||
                  (isAcademicScore(lead.budgetRange || lead.clientBudget) ? (lead.budgetRange || lead.clientBudget) : '')
                )}
              </span>
            </div>
          )}

          {lead.educationalQualification && (
            <div className="f">
              <span className="l">Education</span>
              <span className="v">{lead.educationalQualification}</span>
            </div>
          )}

          {lead.age && (
            <div className="f">
              <span className="l">Age</span>
              <span className="v">{lead.age} yrs</span>
            </div>
          )}
        </section>
      </div>

      {/* Pane: Payments */}
      <div className={`pane ${activeTab === 'pay' ? 'on' : ''}`} id="p-pay">
        <section className="card">
          <h3>Payment settlement</h3>
          <div className="seg" id="seg">
            <button
              type="button"
              className={effectivePaymentStatus === 'UNPAID' ? 'on np' : ''}
              onClick={() => {
                handleUpdatePaymentStatus('UNPAID');
                showToast('Payment: Not paid');
              }}
            >
              Not paid
            </button>
            <button
              type="button"
              className={effectivePaymentStatus === 'PARTIAL' ? 'on pp' : ''}
              onClick={() => {
                handleUpdatePaymentStatus('PARTIAL');
                showToast('Payment: Partial');
              }}
            >
              Partial
            </button>
            <button
              type="button"
              className={effectivePaymentStatus === 'PAID' ? 'on fp' : ''}
              onClick={() => {
                handleUpdatePaymentStatus('PAID');
                showToast('Payment: Fully paid');
              }}
            >
              Fully paid
            </button>
          </div>

          {(() => {
            const raw = lead.budgetRange || lead.clientBudget || '';
            const valid = !isAcademicScore(raw) && raw;
            const display = valid ? (formatCurrencyDisplay(raw) || raw) : '';
            return (
              <div className="big">
                <div>
                  <small>Client budget</small>
                  <b>{display || 'Not specified'}</b>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={handleBudgetClick}
                >
                  {display ? 'Change budget' : 'Set budget'}
                </button>
              </div>
            );
          })()}

          {(lead as any).paymentDetails && (
            <div className="f">
              <span className="l">Remarks</span>
              <span className="v">{(lead as any).paymentDetails}</span>
            </div>
          )}
        </section>
      </div>

      {/* Pane: Meta form answers + ad attribution */}
      <div className={`pane ${activeTab === 'fm' ? 'on' : ''}`} id="p-fm">
        <section className="card">
          <h3>
            <span>Lead form responses</span>
          </h3>
          {formResponses.length === 0 ? (
            <div className="f">
              <span className="v em">No form answers were captured for this lead.</span>
            </div>
          ) : (
            formResponses.map((r, i) => (
              <div className="f" key={`${r.key}-${i}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 16px' }}>
                <span className="l" style={{ width: '100%', fontSize: 13, color: 'var(--muted)', lineHeight: 1.4 }}>
                  {r.label}
                </span>
                <div style={{ textAlign: 'left', marginTop: 2 }}>
                  <span className="v" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {humanizeAnswer(r.value)}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h3>
            <span>Ad attribution</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--l2, #8e8e93)' }}>{origin.text}</span>
          </h3>
          {attributionRows.map((row) => (
            <div className="f" key={row.label}>
              <span className="l">{row.label}</span>
              <span className="v" style={row.idIsValue ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 } : undefined}>
                {row.value}
                {row.metaId && !row.idIsValue && (
                  <span style={{ display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 11, color: '#8e8e93' }}>
                    ID {row.metaId}
                  </span>
                )}
              </span>
            </div>
          ))}
        </section>
      </div>

      {/* Pane: Notes */}
      <div className={`pane ${activeTab === 'nt' ? 'on' : ''}`} id="p-nt">
        <section className="card sec" id="mobile-inline-notes-section" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              id="nt"
              rows={3}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note…"
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, background: '#fff', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn p"
                disabled={!newNote.trim() || submittingNote}
                onClick={async () => {
                  await handleCreateNote();
                  showToast('Note added');
                }}
                style={{
                  height: 36,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {submittingNote ? 'Adding…' : 'Add Note'}
              </button>
            </div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {notesHistory.length > 0 ? (
              notesHistory.map((n, i) => (
                <div key={i} style={{ paddingLeft: 12, borderLeft: '2px solid #0066ff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {n.author} · {formatDate(n.date)}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                      {n.note}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRemark(i)}
                    style={{ border: 0, background: 'none', color: '#94a3b8', padding: '2px 6px', cursor: 'pointer', fontSize: 13 }}
                    title="Delete note"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, padding: '24px 0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                No notes added yet
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Pane: Activity */}
      <div className={`pane ${activeTab === 'ac' ? 'on' : ''}`} id="p-ac">
        <section className="card sec" id="mobile-inline-activity-section" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {/* Search & Filter Controls */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search activity logs..."
                style={{ width: '100%', height: 36, paddingLeft: 34, paddingRight: 32, fontSize: 13, border: '1px solid var(--line)', borderRadius: 4, outline: 'none', background: '#fff' }}
              />
              {activitySearch && (
                <button
                  type="button"
                  onClick={() => setActivitySearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {[
                { id: 'ALL', label: 'All Events' },
                { id: 'STATUS_CHANGE', label: 'Stage Updates' },
                { id: 'DATA_MODIFY', label: 'Dossier Edits' },
                { id: 'REMARKS_ADDED', label: 'Counselor Notes' },
                { id: 'OUTREACH', label: 'Outreach' },
              ].map((f) => {
                const active = activityFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActivityFilter(f.id)}
                    style={{
                      flex: 'none',
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: active ? '#0066ff' : 'var(--line)',
                      background: active ? '#0066ff' : '#fff',
                      color: active ? '#fff' : 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activities List */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(() => {
              const filteredActivities = activities.filter((act) => {
                if (activityFilter !== 'ALL' && act.actionType !== activityFilter) return false;
                if (!activitySearch.trim()) return true;
                const q = activitySearch.toLowerCase();
                return (
                  act.userName?.toLowerCase().includes(q) ||
                  act.title?.toLowerCase().includes(q) ||
                  act.description?.toLowerCase().includes(q) ||
                  act.fieldChanged?.toLowerCase().includes(q)
                );
              });

              if (filteredActivities.length === 0) {
                return (
                  <p style={{ margin: 0, padding: '24px 0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No matching activity events found
                  </p>
                );
              }

              return filteredActivities.map((act, idx) => (
                <div key={act.id || idx} style={{ paddingLeft: 12, borderLeft: '2px solid #0066ff', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {act.userName || 'System'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatDate(act.timestamp || (act as any).createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{act.title}</div>
                  {act.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{act.description}</div>
                  )}
                </div>
              ));
            })()}
          </div>
        </section>
      </div>

      {/* Pane: Emails */}
      <div className={`pane ${activeTab === 'em' ? 'on' : ''}`} id="p-em">
        {/* Email Composer */}
        <section className="card sec" id="mobile-inline-emails-section" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <form
            onSubmit={async (e) => {
              if (handleSendCandidateEmail) {
                await handleSendCandidateEmail(e);
                showToast('Email sent');
              }
            }}
          >
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: 56, fontSize: 13, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>From</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connectedGoogleEmail || 'Connected Gmail'}
              </span>
            </div>

            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <label htmlFor="cand-email-to-mob" style={{ width: 56, fontSize: 13, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>
                To
              </label>
              <input
                id="cand-email-to-mob"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo && setEmailTo(e.target.value)}
                placeholder="candidate@example.com"
                required
                style={{ width: '100%', fontSize: 13, color: 'var(--text)', border: 0, outline: 'none', background: 'transparent' }}
              />
            </div>

            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <label htmlFor="cand-email-subj-mob" style={{ width: 56, fontSize: 13, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>
                Subject
              </label>
              <input
                id="cand-email-subj-mob"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject && setEmailSubject(e.target.value)}
                placeholder="Subject"
                required
                style={{ width: '100%', fontSize: 13, color: 'var(--text)', border: 0, outline: 'none', background: 'transparent' }}
              />
            </div>

            <div style={{ padding: '12px 16px' }}>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody && setEmailBody(e.target.value)}
                placeholder="Write your message..."
                rows={4}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ padding: '10px 16px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="submit"
                disabled={sendingEmail || !emailTo.trim()}
                className="btn p"
                style={{
                  height: 36,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </form>
        </section>

        {/* Sent Emails History */}
        {sentEmails.length > 0 && (
          <section className="card sec" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {sentEmails.map((em, idx) => (
              <div
                key={em.id}
                style={{
                  padding: '12px 16px',
                  paddingLeft: 18,
                  borderLeft: '2px solid #0066ff',
                  borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{em.subject}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(em.sentAt)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>To: {em.to}</div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {em.body}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Pane: Documents */}
      <div className={`pane ${activeTab === 'doc' ? 'on' : ''}`} id="p-doc">
        <section className="card sec" id="mobile-inline-documents-section" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <input
            ref={docFileInputRef}
            type="file"
            className="hidden"
            style={{ display: 'none' }}
            onChange={async (e) => {
              if (onUploadDoc) {
                await onUploadDoc(e);
                showToast('Document uploaded');
              }
            }}
          />
          {/* Header Row: Document Type input on left, Upload Document button on right */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160, flex: 1 }}>
              <label htmlFor="mob-cand-doc-type" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                Document Type
              </label>
              <DocumentTypeSelect
                id="mob-cand-doc-type"
                value={docTypeInput}
                onChange={(val) => setDocTypeInput && setDocTypeInput(val)}
                style={{ height: 36, width: '100%', padding: '0 10px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, background: '#fff', outline: 'none' }}
              />
            </div>
            <button
              type="button"
              disabled={uploadingDoc}
              onClick={() => docFileInputRef.current?.click()}
              className="btn p"
              style={{
                height: 36,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              {uploadingDoc ? (
                <DotsLoader size="xs" label="Uploading…" />
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>

          {uploadingDoc && (
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
              <DotsLoader size="sm" label="Uploading document..." />
            </div>
          )}

          {/* Document Content Area */}
          {candidateDocs.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                No Documents Uploaded
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>
                Upload passports, resumes, academic transcripts, or visa documents for this candidate.
              </p>
            </div>
          ) : (
            <div>
              {candidateDocs.map((doc, idx) => (
                <div
                  key={doc.id}
                  style={{
                    padding: '12px 18px',
                    borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        background: '#f1f5f9',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {doc.docType} · {formatDate(doc.uploadedAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => onPreviewDoc && onPreviewDoc(doc)}
                      className="btn"
                      style={{
                        height: 30,
                        padding: '0 10px',
                        fontSize: 12,
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                      title="Preview document securely inside application"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    {onDeleteDoc && (
                      <button
                        type="button"
                        onClick={() => onDeleteDoc(doc.id)}
                        className="btn"
                        style={{
                          height: 30,
                          padding: '0 8px',
                          borderRadius: 4,
                          color: '#e11d48',
                          cursor: 'pointer',
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Fixed Bottom Action Bar */}
      <nav className="acts" aria-label="Quick actions">
        <a className="call" id="ca" href={`tel:${cleanPhone}`} title="Call candidate">
          <svg viewBox="0 0 24 24">
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
          </svg>
          <span>Call</span>
        </a>
        <a
          className="wa"
          id="wa"
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp candidate"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z" />
            <path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7a4 4 0 01-2-2l.7-1-1-2z" />
          </svg>
          <span>WhatsApp</span>
        </a>
        <button
          type="button"
          id="em"
          className="em-btn"
          onClick={handleNavigateToEmails}
          title="Go to Emails"
        >
          <img src="/icons/gmail-classic.png" alt="" />
          <span>Email</span>
        </button>
        {Boolean(getInstagramDmRecipientId(lead)) && (
          <button
            type="button"
            id="ig"
            className="ig-btn"
            onClick={onOpenInstagram}
            title="Instagram DM"
          >
            <img src="/icons/instagram.png" alt="" />
            <span>Instagram</span>
          </button>
        )}
        <button
          type="button"
          id="meet"
          className="meet-btn"
          onClick={onCreateGoogleMeet}
          title="Google Meet"
        >
          <img src="/icons/google-meet.png" alt="" />
          <span>Meet</span>
        </button>
      </nav>

      {/* Stage Sheet Modal */}
      <div
        className={`ov ${showStageSheet ? 'show' : ''}`}
        id="ov-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowStageSheet(false);
        }}
      >
        <div className="sh" id="sh">
          <div className="gr" />
          <h4>Change stage</h4>
          {STAGES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`o ${i === curStageIndex ? 'on' : ''}`}
              onClick={async () => {
                setShowStageSheet(false);
                await handleStatusChange(s.key);
                showToast(`Stage: ${s.label}`);
              }}
            >
              <i />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* More Options Sheet Modal */}
      <div
        className={`ov ${showMoreSheet ? 'show' : ''}`}
        id="ov-more"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowMoreSheet(false);
        }}
      >
        <div className="sh" id="sh-more">
          <div className="gr" />
          <h4>More</h4>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px' }}
            onClick={() => {
              setShowMoreSheet(false);
              onOpenEdit();
            }}
          >
            Edit details
          </button>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => {
              setShowMoreSheet(false);
              handleNavigateToEmails();
            }}
          >
            <img src="/icons/gmail-classic.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span>Emails</span>
          </button>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => {
              setShowMoreSheet(false);
              onOpenInstagram();
            }}
          >
            <img src="/icons/instagram.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span>Send Instagram DM</span>
          </button>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => {
              setShowMoreSheet(false);
              onCreateGoogleMeet();
            }}
          >
            <img src="/icons/google-meet.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span>Create Google Meet</span>
          </button>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px' }}
            onClick={() => {
              setShowMoreSheet(false);
              onOpenReminder();
            }}
          >
            Set a reminder
          </button>
          <button
            type="button"
            className="o"
            style={{ paddingLeft: '20px' }}
            onClick={() => {
              setShowMoreSheet(false);
              handleCopyPhone();
            }}
          >
            Copy phone number
          </button>
          {isAdmin && (
            <button
              type="button"
              className="o"
              style={{ paddingLeft: '20px', color: 'var(--red)' }}
              onClick={() => {
                setShowMoreSheet(false);
                onDelete();
              }}
            >
              Delete lead
            </button>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      <div className={`toast ${toastMsg ? 'show' : ''}`} id="toast">
        {toastMsg}
      </div>
    </div>
  );
};

function formatDate(isoStr?: string) {
  if (!isoStr) return '—';
  return formatIndianDateTime(isoStr, { fallback: isoStr });
}

export default MobileLeadDetailView;
