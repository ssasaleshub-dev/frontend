import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
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
  FileText,
  ThumbsUp,
  ThumbsDown,
  History,
  Clock,
} from 'lucide-react';
import crmService from '../services/api/crmService';
import adminService from '../services/api/adminService';
import leadActivityService from '../services/api/leadActivityService';
import CandidateActivityLogsModal from '../components/CandidateActivityLogsModal';
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
import { Lead, LeadActivity } from '../types';
import { encryptLeadId, decryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';

export default function CandidateDetail() {
  const { id: rawParamId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const resolvedLeadId = decryptLeadId(rawParamId);

  // Silently and immediately replace open numeric database ID with encrypted token in the URL bar
  useEffect(() => {
    if (rawParamId && resolvedLeadId) {
      const encrypted = encryptLeadId(resolvedLeadId);
      if (rawParamId !== encrypted) {
        navigate(`/leads/${encrypted}`, { replace: true });
      }
    }
  }, [rawParamId, resolvedLeadId, navigate]);

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

  // Activity & Audit Logs
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [showActivityLogsModal, setShowActivityLogsModal] = useState<boolean>(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showWhatsAppTemplateModal, setShowWhatsAppTemplateModal] = useState<boolean>(false);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState<string>('');
  const [editFormData, setEditFormData] = useState<Partial<Lead>>({});
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const hasLoadedRef = useRef<boolean>(false);

  const fetchCandidate = useCallback(async () => {
    const targetId = resolvedLeadId;
    if (!targetId) {
      setError('Invalid or expired candidate link.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Fetch activities in parallel
    leadActivityService.getActivities(targetId).then(setActivities).catch(() => {});
    try {
      let candidateData: Lead | null = null;
      try {
        candidateData = await crmService.getDetailedLeadById(targetId);
      } catch {
        // Fallback: search in detailed leads array
        const all = await crmService.getDetailedLeads();
        const found = (Array.isArray(all) ? all : []).find(
          (l) => Number(l.id) === Number(targetId) || l.externalId === String(targetId)
        );
        if (found) {
          candidateData = found;
        } else {
          throw new Error(`Candidate #${formatMaskedLeadRef(targetId)} could not be found.`);
        }
      }

      if (candidateData) {
        // Enforce role-based access for non-admin counselors
        if (!isAdmin && filterLeadsByUserRole([candidateData], currentUser).length === 0) {
          throw new Error(`Access restricted: Candidate belongs to a different visa desk outside your assigned scope.`);
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
          const parts = candidateData.notes.split(/\s*\|\s*/).filter(Boolean);
          setNotesHistory(
            parts.map((p: string) => ({
              note: p,
              date: candidateData.createdTime || candidateData.createdAt || new Date().toISOString(),
              author: candidateData.assignedTo || 'Counselor',
            }))
          );
        } else {
          setNotesHistory([]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load candidate dossier.');
    } finally {
      setLoading(false);
    }
  }, [resolvedLeadId, isAdmin, currentUser]);

  useEffect(() => {
    fetchCandidate();
  }, [fetchCandidate]);

  useEffect(() => {
    const handleActivityLogged = (e: any) => {
      const targetId = resolvedLeadId;
      if (
        (String(e.detail?.leadId) === String(targetId) || String(e.detail?.leadId) === String(rawParamId)) &&
        e.detail?.activity
      ) {
        setActivities((prev) => [
          e.detail.activity,
          ...prev.filter((a) => a.id !== e.detail.activity.id),
        ]);
      }
    };
    window.addEventListener('ssa_lead_activity_logged', handleActivityLogged);
    return () => window.removeEventListener('ssa_lead_activity_logged', handleActivityLogged);
  }, [resolvedLeadId, rawParamId]);

  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  const handleAssignStaff = async (newAssignee: string) => {
    if (!lead) return;
    const oldAssignee = lead.assignedTo || 'Unassigned';
    if (oldAssignee === newAssignee) return;

    setAssigningStaff(true);
    try {
      await crmService.assignLead(lead.id, newAssignee);
      setLead({ ...lead, assignedTo: newAssignee });
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Admin',
        userRole: currentUser?.authorities?.[0],
        actionType: 'ASSIGNMENT',
        title: 'Counselor Assignment Updated',
        description: `Candidate dossier reassigned from ${oldAssignee} to ${newAssignee}.`,
        fieldChanged: 'assignedTo',
        oldValue: oldAssignee,
        newValue: newAssignee,
      });
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
    const oldStatus = lead.status || 'CREATED';
    if (oldStatus === newStatus) return;

    const oldStatusLabel = LEAD_STATUSES[oldStatus]?.label || oldStatus;
    const newStatusLabel = LEAD_STATUSES[newStatus]?.label || newStatus;

    try {
      await crmService.updateLeadStatus(lead.id, newStatus, lead.notes || '');
      setLead({ ...lead, status: newStatus });
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        userRole: currentUser?.authorities?.[0],
        actionType: 'STATUS_CHANGE',
        title: 'Pipeline Stage Transition',
        description: `Counselor transitioned candidate stage from "${oldStatusLabel}" to "${newStatusLabel}".`,
        fieldChanged: 'status',
        oldValue: oldStatusLabel,
        newValue: newStatusLabel,
      });
    } catch (err: any) {
      alert(`Status update failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !lead) return;
    const noteText = newNote.trim();
    setSubmittingNote(true);
    try {
      const combinedNotes = lead.notes
        ? `${lead.notes} | ${noteText}`
        : noteText;

      await crmService.updateLeadStatus(lead.id, lead.status || 'CONTACTED', combinedNotes);

      setNotesHistory((prev) => [
        {
          note: noteText,
          date: new Date().toISOString(),
          author: currentUser?.firstName || currentUser?.login || 'You',
        },
        ...prev,
      ]);

      setLead({ ...lead, notes: combinedNotes });
      setNewNote('');
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        userRole: currentUser?.authorities?.[0],
        actionType: 'REMARKS_ADDED',
        title: 'Counselor Remark Recorded',
        description: noteText,
        fieldChanged: 'notes',
      });
    } catch (err: any) {
      alert(`Failed to record discussion note: ${err?.message || 'Server error'}`);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteRemark = async (indexToDelete: number) => {
    if (!lead) return;
    if (!window.confirm('Delete this remark?')) return;

    const updatedHistory = notesHistory.filter((_, idx) => idx !== indexToDelete);
    const updatedNotes = updatedHistory.map((item) => item.note).join(' | ');

    try {
      try {
        await crmService.updateLeadStatus(lead.id, lead.status || 'CONTACTED', updatedNotes);
      } catch {
        await crmService.patchLead(lead.id, { notes: updatedNotes });
      }
      setNotesHistory(updatedHistory);
      setLead({ ...lead, notes: updatedNotes });
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } catch (err: any) {
      alert(`Failed to delete remark: ${err?.message || 'Server error'}`);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setSavingEdit(true);

    // Compute diff of modified fields
    const changes: string[] = [];
    if (editFormData.customerName && editFormData.customerName !== lead.customerName) {
      changes.push(`Name: "${lead.customerName || 'None'}" → "${editFormData.customerName}"`);
    }
    if (editFormData.phoneNumber && editFormData.phoneNumber !== lead.phoneNumber) {
      changes.push(`Phone: "${lead.phoneNumber || 'None'}" → "${editFormData.phoneNumber}"`);
    }
    if (editFormData.city !== undefined && editFormData.city !== (lead.city || lead.location)) {
      changes.push(`Location: "${lead.city || lead.location || 'None'}" → "${editFormData.city}"`);
    }
    if (editFormData.visaType && editFormData.visaType !== lead.visaType) {
      changes.push(`Visa Type: "${lead.visaType}" → "${editFormData.visaType}"`);
    }
    if (
      editFormData.educationalQualification !== undefined &&
      editFormData.educationalQualification !== lead.educationalQualification
    ) {
      changes.push(
        `Education: "${lead.educationalQualification || 'None'}" → "${editFormData.educationalQualification}"`
      );
    }
    if (editFormData.age !== undefined && editFormData.age !== lead.age) {
      changes.push(`Age: "${lead.age || 'None'}" → "${editFormData.age}"`);
    }
    if (editFormData.leadConfirm !== undefined && editFormData.leadConfirm !== lead.leadConfirm) {
      changes.push(`Confirmation: "${lead.leadConfirm}" → "${editFormData.leadConfirm}"`);
    }

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

      if (changes.length > 0) {
        leadActivityService.logActivity(lead.id, {
          userName: currentUser?.login || currentUser?.firstName || 'Counselor',
          userRole: currentUser?.authorities?.[0],
          actionType: 'DATA_MODIFY',
          title: 'Candidate Dossier Modified',
          description: `Counselor updated ${changes.length} field(s):\n• ` + changes.join('\n• '),
        });
      }
    } catch (err: any) {
      alert(`Failed to save candidate changes: ${err?.message || 'Server error'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!window.confirm(`Permanently delete candidate dossier Ref #${formatMaskedLeadRef(lead.id)} (${lead.customerName || 'record'})? This cannot be undone.`)) return;
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
        <span className="text-xs font-medium text-[#1c1c1e]">
          Work Visa
        </span>
      );
    }
    if (isStudy) {
      return (
        <span className="text-xs font-medium text-[#1c1c1e]">
          Study Visa
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-[#1c1c1e]">
        {type === 'OTHER_VISA' ? 'Other Visa' : type || 'Other Visa'}
      </span>
    );
  };

  const openWhatsAppWithText = (text: string) => {
    if (!lead?.phoneNumber) return;
    const cleanNum = lead.phoneNumber.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowWhatsAppTemplateModal(false);

    leadActivityService.logActivity(lead.id, {
      userName: currentUser?.login || currentUser?.firstName || 'Counselor',
      userRole: currentUser?.authorities?.[0],
      actionType: 'OUTREACH',
      title: 'WhatsApp Outreach Initiated',
      description: `Sent personalized message to ${lead.phoneNumber}: "${text.substring(0, 90)}${
        text.length > 90 ? '...' : ''
      }"`,
      metadata: { text, phoneNumber: lead.phoneNumber },
    });
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

  const formatPipelineDate = (d?: string | null, fallback: string = 'Mar 16, 2026') => {
    if (!d) return fallback;
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return fallback;
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return fallback;
    }
  };

  const getExpectedClosingDate = (startStr?: string | null) => {
    if ((lead as any)?.closingDate) return formatPipelineDate((lead as any).closingDate);
    try {
      const base = startStr ? new Date(startStr) : new Date();
      if (isNaN(base.getTime())) return 'May 18, 2026';
      const closing = new Date(base.getTime() + 63 * 24 * 60 * 60 * 1000);
      return closing.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'May 18, 2026';
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-[#007aff] transition-all shadow-xs border border-black/[0.05] active:scale-95 backdrop-blur-md"
        >
          <ChevronLeft size={16} />
          <span>Back to Candidate Pipeline</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-800 rounded-xl border border-black/[0.06] text-xs font-semibold shadow-xs transition-all active:scale-95 backdrop-blur-md"
          >
            <Edit2 size={13} className="text-[#007aff]" />
            <span>Edit Dossier</span>
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#ff3b30] rounded-xl border border-rose-200/50 text-xs font-semibold transition-all active:scale-95"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Candidate Profile Hero Card - Apple macOS / iOS Inset Card */}
      <div className="ios-card p-6 bg-white space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5 border-b border-black/[0.06]">
          {/* Avatar and Primary Identity */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0 border border-white/10">
              {(lead.customerName?.[0] || 'C').toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1c1c1e] leading-tight">
                  {lead.customerName || `Candidate #${formatMaskedLeadRef(lead.id)}`}
                </h1>
                {renderVisaBadge(lead.visaType)}
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${currentStatusConfig.color} shadow-xs`}>
                  {currentStatusConfig.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-[#86868b] font-medium">
                <span className="font-mono text-slate-400">
                  {lead.externalId ? `ID: ${lead.externalId}` : `Ref #${formatMaskedLeadRef(lead.id)}`}
                </span>
                <span>·</span>
                {(lead.city || lead.location) && (
                  <span className="flex items-center gap-1 capitalize text-slate-600">
                    <MapPin size={12} className="text-[#007aff]" />
                    <span>{lead.city || lead.location}</span>
                  </span>
                )}
                <span>·</span>
                <span>Inquired on {formatDate(lead.createdTime || lead.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Direct Communication Hub & Stage Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#34c759] hover:bg-[#30b753] text-white rounded-xl text-xs font-semibold shadow-[0_2px_10px_rgba(52,199,89,0.35)] transition-all active:scale-95"
                title="Send personalized WhatsApp message"
              >
                <MessageCircle size={15} />
                <span>WhatsApp Outreach</span>
              </button>
            )}

            {lead.phoneNumber && (
              <a
                href={`tel:${lead.phoneNumber}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-slate-800 rounded-xl text-xs font-semibold transition-all active:scale-95"
                title="Call phone number"
              >
                <Phone size={14} />
                <span>Call Phone</span>
              </a>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="p-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-slate-700 rounded-xl transition-all active:scale-95"
                title="Send email"
              >
                <Mail size={15} />
              </a>
            )}

            {/* Apple iOS Activity & Audit Logs Button */}
            <button
              onClick={() => setShowActivityLogsModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-xl text-xs font-semibold border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all active:scale-95 cursor-pointer"
              title="View counselor audit logs and candidate activity history"
            >
              <History size={14} className="text-[#007aff]" />
              <span>Activity Logs</span>
              {activities.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#007aff]/10 text-[#007aff] rounded-full">
                  {activities.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Apple Segmented Pipeline Stage Control */}
        <div className="space-y-2.5 pt-1">
          {/* Top Metadata Row: START & CLOSING */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                START
              </span>
              <span className="text-xs font-medium text-slate-700">
                {formatPipelineDate(lead.createdTime || (lead as any).createdAt || (lead as any).createdDate)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                CLOSING
              </span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/10 text-[#ff3b30] flex-shrink-0">
                  <Clock size={11} />
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {getExpectedClosingDate(lead.createdTime || (lead as any).createdAt || (lead as any).createdDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Apple macOS / iOS Segmented Pill Pipeline Bar */}
          <div className="p-1.5 bg-[#e5e5ea]/80 backdrop-blur-md rounded-2xl flex items-center gap-1 overflow-x-auto shadow-inner border border-black/[0.04]">
            {LEAD_STATUS_LIST.map((st) => {
              const isCurrent = lead.status === st.value;
              const isWon = st.value === 'WON';
              const isLost = st.value === 'LOST';

              let stageLabel = st.label;
              if (isWon) stageLabel = 'Closed Won';
              if (isLost) stageLabel = 'Closed Lost';

              let activeClasses = 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.04)] font-bold';
              if (isWon && isCurrent) activeClasses = 'bg-[#34c759] text-white shadow-[0_2px_10px_rgba(52,199,89,0.4)] font-bold';
              if (isLost && isCurrent) activeClasses = 'bg-[#ff3b30] text-white shadow-[0_2px_10px_rgba(255,59,48,0.4)] font-bold';

              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => handleStatusChange(st.value)}
                  title={`${st.label} (${st.value})`}
                  className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                    isCurrent
                      ? activeClasses
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium'
                  }`}
                >
                  {isWon && (
                    <ThumbsUp
                      size={12}
                      className={isCurrent ? 'fill-white text-white' : 'text-emerald-600'}
                    />
                  )}
                  {isLost && (
                    <ThumbsDown
                      size={12}
                      className={isCurrent ? 'fill-white text-white' : 'text-rose-600'}
                    />
                  )}
                  <span className="truncate">{stageLabel}</span>
                  {isCurrent && !isWon && !isLost && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007aff]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Dossier Content - Apple Inset Grouped Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Candidate Detailed Profile (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Contact Information */}
          <div className="ios-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
                <UserCheck size={14} className="text-[#007aff]" />
                <span>Contact Dossier</span>
              </h3>
              <button
                onClick={handleCopyPhone}
                className="text-xs font-semibold text-[#007aff] hover:text-[#0071e3] flex items-center gap-1 transition-colors"
              >
                {copiedPhone ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedPhone ? 'Phone Copied!' : 'Copy Phone'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Primary Phone</span>
                <p className="font-mono text-sm font-bold text-[#1c1c1e] mt-1">
                  {lead.phoneNumber || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Email Address</span>
                <p className="text-sm font-semibold text-[#1c1c1e] mt-1 truncate">
                  {lead.email || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">City / Location</span>
                <p className="text-sm font-semibold text-[#1c1c1e] mt-1 capitalize">
                  {lead.city || lead.location || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider block">Assigned Counselor</span>
                {isAdmin ? (
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={lead.assignedTo || ''}
                      onChange={(e) => handleAssignStaff(e.target.value)}
                      disabled={assigningStaff}
                      className="text-xs font-semibold text-slate-800 bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 disabled:opacity-50"
                    >
                      <option value="">Unassigned (General Pool)</option>
                      {availableStaff.map((staff) => (
                        <option key={staff.login} value={staff.login}>
                          {staff.name ? `${staff.name} (@${staff.login})` : staff.login}
                        </option>
                      ))}
                    </select>
                    {assigningStaff && <RefreshCw size={12} className="animate-spin text-[#007aff]" />}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-[#1c1c1e] mt-1">
                    {lead.assignedTo || 'General Pool'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Candidate Eligibility & Survey Answers */}
          <div className="ios-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
                <GraduationCap size={14} className="text-[#007aff]" />
                <span>Eligibility & Survey Responses</span>
              </h3>
              <span className="text-[11px] text-[#86868b] font-medium">Candidate Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Highest Qualification</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1">
                  {lead.educationalQualification || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Age Demographic</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1">
                  {lead.age || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Currently Employed?</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1 capitalize">
                  {lead.areYouWorking ? (lead.areYouWorking === 'yes' ? 'Yes, Employed' : 'No / Fresher') : '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Interested in Visa Process?</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1 capitalize">
                  {lead.areYouInterested ? (lead.areYouInterested === 'yes' ? 'Yes, Ready' : 'Exploring') : '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors col-span-1 sm:col-span-2">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Lead Confirmation Status</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1">
                  {lead.leadConfirm || 'Confirmed Candidate'}
                </p>
              </div>

              {/* Candidate Remarks Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 col-span-1 sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-amber-900 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-600" />
                    <span>Candidate Remarks</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('counselor-remarks-input');
                      input?.focus();
                    }}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors"
                  >
                    + Add New Remark
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-800 mt-1.5 whitespace-pre-line leading-relaxed">
                  {lead.notes || 'No remarks recorded yet.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Marketing Attribution & Origin */}
          <div className="ios-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
                <Share2 size={14} className="text-[#007aff]" />
                <span>Marketing Origin Telemetry</span>
              </h3>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${plat.color}`}>
                {plat.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors col-span-1 sm:col-span-2">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Meta Campaign Name</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1">
                  {lead.campaignName || 'Direct / Organic Walk-in'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Ad Set Name</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1 truncate">
                  {lead.adSetName || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Ad Creative</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1 truncate">
                  {lead.adName || '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors col-span-1 sm:col-span-2">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">Meta Instant Form Name / ID</span>
                <p className="font-bold text-[#1c1c1e] text-sm mt-1">
                  {lead.leadFormName || lead.formId || 'Instant Lead Form'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Counselor Discussion Notes & Communication (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Counselor Note-Taking Box */}
          <div className="ios-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
                <MessageCircle size={14} className="text-[#007aff]" />
                <span>Remarks & Counselor Log</span>
              </h3>
              <span className="text-[11px] text-[#86868b] font-medium">Quick Intake</span>
            </div>

            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                id="counselor-remarks-input"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Record candidate conversation notes, eligibility checks, or next steps..."
                className="w-full px-4 py-3 bg-[#f2f2f7] border border-black/[0.06] rounded-2xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium placeholder:text-slate-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#007aff] hover:bg-[#0071e3] text-white rounded-xl text-xs font-semibold shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-all active:scale-95 disabled:opacity-40"
                >
                  <Send size={12} />
                  <span>{submittingNote ? 'Saving Remarks...' : 'Add Remarks / Note'}</span>
                </button>
              </div>
            </form>

            {/* Historical Notes Stream */}
            <div className="pt-3 border-t border-black/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                Remarks & Discussion History
              </span>

              {notesHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No discussion notes recorded yet.
                </p>
              ) : (
                notesHistory.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[#f8f9fa] border border-black/[0.04] space-y-1.5 text-xs group hover:border-black/[0.08] transition-all">
                    <div className="flex items-center justify-between text-[11px] text-[#86868b]">
                      <span className="font-semibold text-slate-800">{item.author}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatDate(item.date)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRemark(idx)}
                          title="Delete this remark"
                          className="text-slate-400 hover:text-[#ff3b30] p-1 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-800 leading-relaxed pt-0.5 whitespace-pre-wrap font-medium">{item.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick WhatsApp Templates Card */}
          <div className="ios-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
              <MessageCircle size={14} className="text-[#34c759]" />
              <span>WhatsApp Outreach Shortcuts</span>
            </h3>
            <p className="text-xs text-[#86868b]">
              One-click preset outreach messages tailored for this candidate:
            </p>

            <div className="space-y-2">
              {getWhatsAppTemplates().map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => openWhatsAppWithText(tpl.text)}
                  className="w-full p-3.5 rounded-2xl border border-black/[0.06] hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-all text-xs group bg-white shadow-xs active:scale-[0.99]"
                >
                  <p className="font-bold text-[#1c1c1e] group-hover:text-emerald-800">
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

              {/* Remarks Field */}
              <div className="zoho-form-row">
                <label className="zoho-form-label" title="Candidate Remarks">
                  Remarks
                </label>
                <div className="flex-1">
                  <textarea
                    value={editFormData.notes || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={2}
                    className="ios-input w-full text-slate-800 text-xs font-medium"
                  />
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

      {/* Candidate Activity & Audit Logs Modal */}
      {lead && (
        <CandidateActivityLogsModal
          isOpen={showActivityLogsModal}
          onClose={() => setShowActivityLogsModal(false)}
          activities={activities}
          candidateName={lead.customerName}
          leadId={lead.id}
        />
      )}
    </div>
  );
}
