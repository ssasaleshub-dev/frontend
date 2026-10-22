import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Share2,
  UserCheck,
  Send,
  Copy,
  Check,
  X,
  RefreshCw,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import adminService from '../services/api/adminService';
import {
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  CANONICAL_LEAD_STATUSES,
  AGE_BRACKETS,
  EDUCATION_QUALIFICATIONS,
  filterLeadsByUserRole,
} from '../config/constants';
import { isAdmin as checkIsAdmin } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import { Lead } from '../types';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const isAdmin = checkIsAdmin(currentUser);
  const [availableStaff, setAvailableStaff] = useState<Array<{ login: string; name?: string }>>([]);
  const [assigningStaff, setAssigningStaff] = useState<boolean>(false);

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);
  const [newNote, setNewNote] = useState<string>('');
  const [notesHistory, setNotesHistory] = useState<Array<{ note: string; date: string; author: string }>>([]);

  // Modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showWhatsAppTemplateModal, setShowWhatsAppTemplateModal] = useState<boolean>(false);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState<string>('');
  const [editFormData, setEditFormData] = useState<Partial<Lead>>({});
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const hasLoadedRef = useRef<boolean>(false);

  const fetchCandidate = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let candidateData: Lead | null = null;
      try {
        candidateData = await crmService.getDetailedLeadById(id);
      } catch {
        // Fallback: search in detailed leads array
        const all = await crmService.getDetailedLeads();
        const found = (Array.isArray(all) ? all : []).find(
          (l) => String(l.id) === String(id) || l.externalId === String(id)
        );
        if (found) {
          candidateData = found;
        } else {
          throw new Error(`Candidate #${id} could not be found.`);
        }
      }

      if (candidateData) {
        // Enforce role-based access for non-admin counselors
        if (!isAdmin && filterLeadsByUserRole([candidateData], currentUser).length === 0) {
          throw new Error(`Access restricted: Candidate #${id} belongs to a different visa desk outside your assigned scope.`);
        }

        setLead(candidateData);
        setEditFormData({
          customerName: candidateData.customerName || '',
          phoneNumber: candidateData.phoneNumber || '',
          email: candidateData.email || '',
          city: candidateData.city || candidateData.location || '',
          visaType: candidateData.visaType || 'WORK_VISA',
          age: candidateData.age || AGE_BRACKETS[0],
          educationalQualification: candidateData.educationalQualification || EDUCATION_QUALIFICATIONS[2],
          areYouWorking: candidateData.areYouWorking || 'yes',
          areYouInterested: candidateData.areYouInterested || 'yes',
          leadConfirm: candidateData.leadConfirm || 'Confirmed',
          notes: candidateData.notes || '',
        });

        if (candidateData.notes) {
          setNotesHistory([
            {
              note: candidateData.notes,
              date: candidateData.createdTime || candidateData.createdAt || new Date().toISOString(),
              author: candidateData.assignedTo || 'Counselor',
            },
          ]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load candidate dossier.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchCandidate();
    }
  }, [fetchCandidate]);

  useEffect(() => {
    adminService
      .getUsers(0, 100)
      .then((users) => {
        const list = Array.isArray(users) ? users : (users as any)?.content || [];
        if (Array.isArray(list)) {
          setAvailableStaff(
            list.map((u) => ({
              login: u.login,
              name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.login,
            }))
          );
        }
      })
      .catch(() => {
        setAvailableStaff([]);
      });
  }, []);

  const handleAssignStaff = async (newAssignee: string) => {
    if (!lead) return;
    setAssigningStaff(true);
    try {
      await crmService.assignLead(lead.id, newAssignee);
      setLead({ ...lead, assignedTo: newAssignee });
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      alert(`Staff assignment failed: ${err?.message || 'Server error'}`);
    } finally {
      setAssigningStaff(false);
    }
  };

  const handleCopyPhone = () => {
    if (!lead?.phoneNumber) return;
    navigator.clipboard.writeText(lead.phoneNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    try {
      await crmService.updateLeadStatus(lead.id, newStatus, lead.notes || '');
      setLead({ ...lead, status: newStatus });
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !lead) return;
    setSubmittingNote(true);
    try {
      const combinedNotes = lead.notes
        ? `${lead.notes} | ${newNote.trim()}`
        : newNote.trim();

      await crmService.updateLeadStatus(lead.id, lead.status || 'CONTACTED', combinedNotes);

      setNotesHistory((prev) => [
        {
          note: newNote.trim(),
          date: new Date().toISOString(),
          author: currentUser?.firstName || currentUser?.login || 'You',
        },
        ...prev,
      ]);

      setLead({ ...lead, notes: combinedNotes });
      setNewNote('');
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      alert(`Failed to record discussion note: ${err?.message || 'Server error'}`);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setSavingEdit(true);
    try {
      // 1. Update customer profile
      if (lead.customerId) {
        await crmService.updateCustomer(lead.customerId, {
          fullName: editFormData.customerName,
          phoneNumber: editFormData.phoneNumber,
          location: editFormData.city,
        });
      }

      // 2. Update lead details
      await crmService.patchLead(lead.id, {
        visaType: editFormData.visaType,
        notes: editFormData.notes,
        age: editFormData.age,
        educationalQualification: editFormData.educationalQualification,
        areYouWorking: editFormData.areYouWorking,
        areYouInterested: editFormData.areYouInterested,
        leadConfirm: editFormData.leadConfirm,
      });

      setLead({
        ...lead,
        ...editFormData,
      });

      setShowEditModal(false);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      alert(`Failed to save candidate changes: ${err?.message || 'Server error'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!window.confirm(`Permanently delete candidate dossier #${lead.id} (${lead.customerName || 'record'})? This cannot be undone.`)) return;
    try {
      await crmService.deleteLead(lead.id);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
      navigate('/leads');
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Server error'}`);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const renderVisaBadge = (type?: string) => {
    const isWork = (type || '').toUpperCase() === 'WORK_VISA';
    const isStudy = (type || '').toUpperCase() === 'STUDY_VISA';

    if (isWork) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
          <span className="w-2 h-2 rounded-full bg-[#5856d6] shadow-2xs shrink-0"></span>
          <span>Work Visa</span>
        </span>
      );
    }
    if (isStudy) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
          <span className="w-2 h-2 rounded-full bg-[#34c759] shadow-2xs shrink-0"></span>
          <span>Study Visa</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1c1c1e]">
        <span className="w-2 h-2 rounded-full bg-[#ff9500] shadow-2xs shrink-0"></span>
        <span>{type === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}</span>
      </span>
    );
  };

  const openWhatsAppWithText = (text: string) => {
    if (!lead?.phoneNumber) return;
    const cleanNum = lead.phoneNumber.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowWhatsAppTemplateModal(false);
  };

  const getWhatsAppTemplates = () => {
    const name = lead?.customerName || 'Candidate';
    const visa = lead?.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa';
    return [
      {
        id: 'intro',
        title: 'Initial Welcome & Inquiry Outreach',
        text: `Hello ${name}, greetings from our Overseas Visa Consultancy! We received your inquiry regarding our international ${visa} programs. Are you available for a brief discussion regarding eligibility and visa requirements?`,
      },
      {
        id: 'docs',
        title: 'Document Checklist Request',
        text: `Dear ${name}, following our counseling discussion regarding your ${visa} application, please share your updated resume/CV, highest educational certificates, and passport copy so our team can evaluate your profile.`,
      },
      {
        id: 'followup',
        title: 'Follow-up & Next Steps',
        text: `Hello ${name}, following up on your ${visa} file. We have new job/university openings that match your profile. Would you like to schedule a callback today?`,
      },
    ];
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
        <RefreshCw size={22} className="animate-spin text-slate-800" />
        <p className="text-xs font-medium">Loading candidate dossier...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="py-16 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle size={22} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Candidate Not Found</h3>
          <p className="text-xs text-slate-500 mt-1">{error || 'This candidate record does not exist or was removed.'}</p>
        </div>
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-2xs hover:bg-slate-800"
        >
          <ChevronLeft size={14} />
          <span>Return to Candidate Leads</span>
        </button>
      </div>
    );
  }

  const plat = (lead.platform && PLATFORMS[lead.platform]) || PLATFORMS.OTHER;
  const currentStatusConfig = (lead.status && LEAD_STATUSES[lead.status]) || {
    label: lead.status || 'New',
    color: 'bg-slate-100 text-slate-700',
  };

  // Find index of current stage in funnel
  const currentStageIndex = LEAD_STATUS_LIST.findIndex((s) => s.value === lead.status);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors w-fit"
        >
          <ChevronLeft size={16} />
          <span>Back to Candidate Pipeline</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-medium shadow-2xs transition-colors"
          >
            <Edit2 size={13} className="text-slate-500" />
            <span>Edit Dossier</span>
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-xl border border-rose-200 text-xs font-medium transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Candidate Profile Hero Card */}
      <div className="ios-card p-5 sm:p-6 bg-white space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          {/* Avatar and Primary Identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
              {(lead.customerName?.[0] || 'C').toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                  {lead.customerName || `Candidate #${lead.id}`}
                </h1>
                {renderVisaBadge(lead.visaType)}
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${currentStatusConfig.color} border-slate-200/90 shadow-2xs`}>
                  {currentStatusConfig.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                <span className="font-mono text-slate-400">
                  {lead.externalId ? `ID: ${lead.externalId}` : `Ref #${lead.id}`}
                </span>
                <span>·</span>
                {(lead.city || lead.location) && (
                  <span className="flex items-center gap-1 capitalize">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{lead.city || lead.location}</span>
                  </span>
                )}
                <span>·</span>
                <span>Inquired on {formatDate(lead.createdTime || lead.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Direct Communication Hub & Stage Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct WhatsApp Trigger */}
            {lead.phoneNumber && (
              <button
                onClick={() => {
                  setCustomWhatsAppMsg(
                    `Hello ${lead.customerName || 'Candidate'}, greetings from our Overseas Visa Consultancy! We received your ${
                      lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'
                    } inquiry.`
                  );
                  setShowWhatsAppTemplateModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                title="Send personalized WhatsApp message"
              >
                <MessageCircle size={14} />
                <span>WhatsApp Outreach</span>
              </button>
            )}

            {lead.phoneNumber && (
              <a
                href={`tel:${lead.phoneNumber}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                title="Call phone number"
              >
                <Phone size={14} />
                <span>Call Phone</span>
              </a>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors"
                title="Send email"
              >
                <Mail size={14} />
              </a>
            )}
          </div>
        </div>

        {/* Interactive Lifecycle Stage Stepper */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
              Counseling Stage Funnel
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Current Stage:</span>
              <select
                value={lead.status || 'CREATED'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                {LEAD_STATUS_LIST.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label} ({st.value})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 pt-1">
            {LEAD_STATUS_LIST.map((st, idx) => {
              const isCurrent = lead.status === st.value;
              const isPast = currentStageIndex >= 0 && idx < currentStageIndex;

              return (
                <button
                  key={st.value}
                  onClick={() => handleStatusChange(st.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                    isCurrent
                      ? 'border-slate-900 bg-slate-900 text-white font-semibold shadow-xs'
                      : isPast
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900 font-medium'
                      : 'border-slate-200/90 bg-slate-50 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono opacity-60">0{idx + 1}</span>
                    {isPast && <CheckCircle2 size={11} className="text-emerald-700" />}
                  </div>
                  <p className="truncate mt-0.5" title={st.label}>{st.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Dossier Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Candidate Detailed Profile (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Contact Information */}
          <div className="ios-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck size={14} className="text-slate-400" />
                <span>Contact Dossier</span>
              </h3>
              <button
                onClick={handleCopyPhone}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {copiedPhone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiedPhone ? 'Phone Copied!' : 'Copy Phone'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Primary Phone</span>
                <p className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                  {lead.phoneNumber || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Email Address</span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                  {lead.email || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">City / Location</span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">
                  {lead.city || lead.location || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px] block">Assigned Counselor</span>
                {isAdmin ? (
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={lead.assignedTo || ''}
                      onChange={(e) => handleAssignStaff(e.target.value)}
                      disabled={assigningStaff}
                      className="text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Unassigned (General Pool)</option>
                      {availableStaff.map((staff) => (
                        <option key={staff.login} value={staff.login}>
                          {staff.name ? `${staff.name} (@${staff.login})` : staff.login}
                        </option>
                      ))}
                    </select>
                    {assigningStaff && <RefreshCw size={12} className="animate-spin text-blue-600" />}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {lead.assignedTo || 'General Pool'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Candidate Eligibility & Survey Answers */}
          <div className="ios-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-slate-400" />
                <span>Eligibility & Survey Responses</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Candidate Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Highest Educational Qualification</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  {lead.educationalQualification || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Age Demographic</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  {lead.age || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Currently Employed?</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5 capitalize">
                  {lead.areYouWorking ? (lead.areYouWorking === 'yes' ? 'Yes, Employed' : 'No / Fresher') : '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Interested in Visa Process?</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5 capitalize">
                  {lead.areYouInterested ? (lead.areYouInterested === 'yes' ? 'Yes, Ready' : 'Exploring') : '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 col-span-1 sm:col-span-2">
                <span className="text-slate-400 text-[11px]">Lead Confirmation Status</span>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  {lead.leadConfirm || 'Confirmed Candidate'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Marketing Attribution & Origin */}
          <div className="ios-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Share2 size={14} className="text-slate-400" />
                <span>Marketing Origin Telemetry</span>
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${plat.color}`}>
                {plat.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 col-span-1 sm:col-span-2">
                <span className="text-slate-400 text-[11px]">Meta Campaign Name</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {lead.campaignName || 'Direct / Organic Walk-in'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Ad Set Name</span>
                <p className="font-semibold text-slate-900 mt-0.5 truncate">
                  {lead.adSetName || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px]">Ad Creative</span>
                <p className="font-semibold text-slate-900 mt-0.5 truncate">
                  {lead.adName || '—'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 col-span-1 sm:col-span-2">
                <span className="text-slate-400 text-[11px]">Meta Instant Form Name / ID</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {lead.leadFormName || lead.formId || 'Instant Lead Form'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Counselor Discussion Notes & Communication (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Counselor Note-Taking Box */}
          <div className="ios-card p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-slate-400" />
              <span>Counselor Discussion Log</span>
            </h3>

            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 transition-all"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40"
                >
                  <Send size={12} />
                  <span>{submittingNote ? 'Recording...' : 'Add Note'}</span>
                </button>
              </div>
            </form>

            {/* Historical Notes Stream */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Discussion History
              </span>

              {notesHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No discussion notes recorded yet.
                </p>
              ) : (
                notesHistory.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-700">{item.author}</span>
                      <span>{formatDate(item.date)}</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed pt-0.5">{item.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick WhatsApp Templates Card */}
          <div className="ios-card p-5 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-emerald-600" />
              <span>WhatsApp Outreach Shortcuts</span>
            </h3>
            <p className="text-xs text-slate-500">
              One-click preset outreach messages tailored for this candidate:
            </p>

            <div className="space-y-2">
              {getWhatsAppTemplates().map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => openWhatsAppWithText(tpl.text)}
                  className="w-full p-3 rounded-xl border border-slate-200/90 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-all text-xs group bg-white shadow-2xs"
                >
                  <p className="font-semibold text-slate-900 group-hover:text-emerald-800">
                    {tpl.title}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1 line-clamp-2 leading-relaxed">
                    "{tpl.text}"
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Candidate Dossier Modal (Zoho CRM Modal & Field UI) */}
      {showEditModal && (
        <div className="zoho-modal-backdrop">
          <div className="zoho-modal-card max-w-lg animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Get Candidate Info
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-3 mb-4">
              Order Information
            </div>

            <form onSubmit={handleSaveEdit} className="text-xs">
              {/* Full Name (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Name of the Candidate">
                  Name of the Cus...
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={editFormData.customerName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="ios-input ios-input-required w-full font-medium"
                  />
                </div>
              </div>

              {/* Customer Email */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Customer Email">
                  Customer Email
                </label>
                <div className="flex-1">
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="ios-input w-full"
                  />
                </div>
              </div>

              {/* Candidate Phone (Required: Red Left Accent Bar) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Candidate Phone">
                  Candidate Phone
                </label>
                <div className="flex-1">
                  <input
                    type="tel"
                    required
                    value={editFormData.phoneNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                    className="ios-input ios-input-required w-full font-medium"
                  />
                </div>
              </div>

              {/* Order / Candidate ID */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Candidate ID">
                  Candidate ID
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    value={lead?.id || '—'}
                    className="ios-input w-full text-slate-700 opacity-90 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              {/* Date and Time of Record (Compound Field matching screenshot) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Date and Time">
                  Date and Time of ...
                </label>
                <div className="flex-1 flex rounded-md overflow-hidden border border-[#d0dcf0] bg-[#edf2f9]">
                  <div className="flex-1 px-3 py-2 border-r border-[#d0dcf0] text-xs text-slate-800 bg-[#edf2f9]">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="w-28 px-3 py-2 text-xs text-slate-800 bg-[#edf2f9] text-center font-medium">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Product / Visa Program (Dropdown matching screenshot) */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Product / Visa Program">
                  Product / Visa
                </label>
                <div className="flex-1">
                  <select
                    value={editFormData.visaType || 'WORK_VISA'}
                    onChange={(e) => setEditFormData({ ...editFormData, visaType: e.target.value })}
                    className="zoho-select font-medium"
                  >
                    <option value="WORK_VISA">Work Visa</option>
                    <option value="STUDY_VISA">Study Visa</option>
                    <option value="OTHER_VISA">Other Visa</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="zoho-btn-done"
                >
                  {savingEdit ? 'Saving...' : 'Done'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Template Customization Modal */}
      {showWhatsAppTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageCircle size={15} className="text-emerald-600" />
                <span>Personalize WhatsApp Message</span>
              </h3>
              <button
                onClick={() => setShowWhatsAppTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-slate-500 text-[11px]">
                Review or edit the message to be sent to{' '}
                <strong className="text-slate-900">{lead.customerName}</strong> ({lead.phoneNumber}):
              </p>

              <textarea
                value={customWhatsAppMsg}
                onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppTemplateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => openWhatsAppWithText(customWhatsAppMsg)}
                  className="px-4 py-1.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={12} />
                  <span>Open WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
