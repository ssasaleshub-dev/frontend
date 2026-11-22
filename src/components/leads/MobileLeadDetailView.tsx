import React, { useState } from 'react';
import { parseFormResponses, humanizeAnswer, getAttributionRows, getOriginLabel } from '../../utils/metaLead';
import { NavigateFunction } from 'react-router-dom';
import { Lead, LeadActivity } from '../../types';
import { formatIndianDate, formatIndianDateTime } from '../../utils/dateTimeUtils';

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
  onDelete: () => void;
  onAssignStaff: (staffLogin: string) => Promise<void>;
  assigningStaff: boolean;
  onUpdateBudget: (newBudget: string) => Promise<void>;
  navigate: NavigateFunction;
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
  onDelete,
  onAssignStaff,
  assigningStaff,
  onUpdateBudget,
  navigate,
}) => {
  const [activeTab, setActiveTab] = useState<'ov' | 'pay' | 'fm' | 'nt' | 'ac'>('ov');

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
    const currentBudget = lead.budgetRange || lead.clientBudget || '';
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
          Form {formResponses.length > 0 && <em>{formResponses.length}</em>}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'nt' ? 'on' : ''}`}
          onClick={() => setActiveTab('nt')}
        >
          Notes {notesHistory.length > 0 && <em>{notesHistory.length}</em>}
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'ac' ? 'on' : ''}`}
          onClick={() => setActiveTab('ac')}
        >
          Activity
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

          <div className="f">
            <span className="l">Budget</span>
            <span className={`v ${lead.budgetRange || lead.clientBudget ? '' : 'em'}`}>
              {lead.budgetRange || lead.clientBudget || 'Not specified'}
            </span>
          </div>

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

          <div className="big">
            <div>
              <small>Client budget</small>
              <b>{lead.budgetRange || lead.clientBudget || 'Not specified'}</b>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleBudgetClick}
            >
              Set budget
            </button>
          </div>

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
              <div className="f" key={`${r.key}-${i}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span className="l" style={{ width: 'auto' }}>{r.label}</span>
                <span className="v" style={{ textAlign: 'left' }}>{humanizeAnswer(r.value)}</span>
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
              <span className="v" style={row.idIsValue ? { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 } : undefined}>
                {row.value}
                {row.metaId && !row.idIsValue && (
                  <span style={{ display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, color: '#8e8e93' }}>
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
        <section className="card">
          <h3>Add a note</h3>
          <div className="nin">
            <textarea
              id="nt"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note…"
            />
            <button
              type="button"
              className="btn p"
              id="ad"
              disabled={!newNote.trim() || submittingNote}
              onClick={async () => {
                await handleCreateNote();
                showToast('Note added');
              }}
            >
              {submittingNote ? 'Saving…' : 'Add note'}
            </button>
          </div>
          <div id="nl">
            {notesHistory.map((n, i) => (
              <div key={i} className="n">
                <small>
                  {n.author} · {formatDate(n.date)}
                </small>
                <p>{n.note}</p>
                <button
                  type="button"
                  aria-label="Delete note"
                  onClick={() => handleDeleteRemark(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Pane: Activity */}
      <div className={`pane ${activeTab === 'ac' ? 'on' : ''}`} id="p-ac">
        <section className="card">
          <h3>Activity log</h3>
          {activities.length === 0 ? (
            <div className="f">
              <span className="v">Lead created from Meta Lead Ads</span>
              <span className="l" style={{ width: 'auto' }}>
                {inquiriesDate}
              </span>
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="f">
                <div className="v" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600 }}>{act.title}</span>
                  {act.description && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
                      {act.description}
                    </span>
                  )}
                </div>
                <span className="l" style={{ width: 'auto', fontSize: '11px', textAlign: 'right' }}>
                  {formatDate(act.timestamp)}
                </span>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Fixed Bottom Action Bar */}
      <nav className="acts" aria-label="Quick actions">
        <a className="call" id="ca" href={`tel:${cleanPhone}`}>
          <svg viewBox="0 0 24 24">
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
          </svg>
          Call
        </a>
        <a
          className="wa"
          id="wa"
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z" />
            <path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .7a4 4 0 01-2-2l.7-1-1-2z" />
          </svg>
          WhatsApp
        </a>
        <a id="em" href={lead.email ? `mailto:${lead.email}` : undefined} onClick={!lead.email ? () => showToast('No email available') : undefined}>
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          Email
        </a>
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
