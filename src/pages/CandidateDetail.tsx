import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DotsLoader from '../components/common/DotsLoader';
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
  UserCheck,
  Send,
  Copy,
  Check,
  X,
  Calendar,
  Sparkles,
  PhoneCall,
  FileCheck,
  RefreshCw,
  Globe,
  ShieldCheck,
  FileText,
  Clock,
  CreditCard,
  Wallet,
  Award,
  Upload,
  Search,
  ExternalLink,
  Eye,
  Download,
  AlertTriangle,
  GitMerge,
} from 'lucide-react';
import {
  BrandActivityIcon,
  BrandAttributionIcon,
  BrandWonIcon,
  BrandLostIcon,
  BrandReminderIcon,
} from '../components/icons/BrandIcons';
import crmService, { readLeadPreferenceField } from '../services/api/crmService';
import { CandidateDetailSkeleton } from '../components/common/SkeletonLoader';
import { parseRemarks, buildRemarkEntry, joinRemarks, sanitizeRemarkText, type RemarkEntry } from '../utils/remarks';
import adminService from '../services/api/adminService';
import leadActivityService from '../services/api/leadActivityService';
import integrationsService from '../services/api/integrationsService';
import fileService from '../services/api/fileService';
import notificationApiService, { CalendarEventDTO } from '../services/api/notificationService';
import CandidateActivityLogsModal from '../components/CandidateActivityLogsModal';
import LeadReminderModal from '../components/LeadReminderModal';
import TimePicker12Hour from '../components/TimePicker12Hour';
import MobileLeadDetailView from '../components/leads/MobileLeadDetailView';
import { useAlert } from '../context/AlertContext';
import {
  PLATFORMS,
  LEAD_STATUSES,
  LEAD_STATUS_LIST,
  CANONICAL_LEAD_STATUSES,
  AGE_BRACKETS,
  EDUCATION_QUALIFICATIONS,
  filterLeadsByUserRole,
  isWorkVisaType,
  isStudyVisaType,
  isDomesticAdmissionType,
} from '../config/constants';
import { isAdmin as checkIsAdmin } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import { formatIndianDateTime, formatIndianDate } from '../utils/dateTimeUtils';
import { formatCurrencyDisplay, getLeadSourceLabel, isAcademicScore, formatAcademicScore } from '../utils/formatUtils';
import { parseFormResponses, humanizeAnswer, getAttributionRows, getOriginLabel, getInstagramDmRecipientId } from '../utils/metaLead';
import { Lead, LeadActivity } from '../types';
import { encryptLeadId, decryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';

export default function CandidateDetail() {
  const { id: rawParamId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  const navState = (location.state as { fromNotification?: boolean; searchName?: string } | null) || null;
  const fromNotification = Boolean(navState?.fromNotification);
  const notificationFallbackPath = navState?.searchName
    ? `/leads?search=${encodeURIComponent(navState.searchName)}`
    : '/leads';

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
  const [isServerDown, setIsServerDown] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);
  const [newNote, setNewNote] = useState<string>('');
  const [notesHistory, setNotesHistory] = useState<RemarkEntry[]>([]);
  const [activeSection, setActiveSection] = useState<'info' | 'payments' | 'eligibility' | 'form' | 'attribution' | 'notes' | 'activity' | 'emails' | 'documents' | 'lead-info'>('info');
  const [copiedMetaId, setCopiedMetaId] = useState<string | null>(null);

  // Client Budget & Payment State
  const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [isEditingPaymentDetails, setIsEditingPaymentDetails] = useState<boolean>(false);
  const [paymentDetailsInput, setPaymentDetailsInput] = useState<string>('');
  const [updatingPayment, setUpdatingPayment] = useState<boolean>(false);

  // Student Percentage / CGPA State
  const [isEditingPercentage, setIsEditingPercentage] = useState<boolean>(false);
  const [percentageInput, setPercentageInput] = useState<string>('');

  // Activity & Audit Logs
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [showActivityLogsModal, setShowActivityLogsModal] = useState<boolean>(false);

  // Candidate Reminders
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);
  const [leadReminders, setLeadReminders] = useState<CalendarEventDTO[]>([]);
  const [creatingMeet, setCreatingMeet] = useState<boolean>(false);

  // Google Meet Scheduling & Confirmation Modal State
  const [showMeetScheduleModal, setShowMeetScheduleModal] = useState<boolean>(false);
  const [meetTitle, setMeetTitle] = useState<string>('');
  const [meetDate, setMeetDate] = useState<string>('');
  const [meetTime, setMeetTime] = useState<string>('10:00');
  const [meetDuration, setMeetDuration] = useState<number>(30);
  const [meetSendWhatsApp, setMeetSendWhatsApp] = useState<boolean>(true);
  const [meetSendEmail, setMeetSendEmail] = useState<boolean>(true);
  const [meetCustomNotes, setMeetCustomNotes] = useState<string>('');
  const [schedulingMeet, setSchedulingMeet] = useState<boolean>(false);

  // Related List inline views: 'notes' | 'activity' | 'emails' | 'documents' | null
  const [activeRelatedView, setActiveRelatedView] = useState<'notes' | 'activity' | 'emails' | 'documents' | null>(null);
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string>('');
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [openingEmail, setOpeningEmail] = useState<boolean>(false);
  const [sentEmails, setSentEmails] = useState<
    Array<{ id: string; from: string; to: string; subject: string; body: string; sentAt: string }>
  >(() => {
    try {
      const raw = resolvedLeadId ? localStorage.getItem(`ssa_lead_emails_${resolvedLeadId}`) : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Activity Logs inline filter & search
  const [activityFilterType, setActivityFilterType] = useState<string>('ALL');
  const [activitySearchQuery, setActivitySearchQuery] = useState<string>('');

  // Documents inline upload & list
  const [docTypeInput, setDocTypeInput] = useState<string>('Passport / ID');
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<
    Array<{ id: string; name: string; docType: string; url: string; uploadedAt: string; size?: number }>
  >(() => {
    try {
      const raw = resolvedLeadId ? localStorage.getItem(`ssa_lead_docs_${resolvedLeadId}`) : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{
    id: string;
    name: string;
    docType: string;
    url: string;
    uploadedAt: string;
    size?: number;
  } | null>(null);

  const [showInstagramModal, setShowInstagramModal] = useState<boolean>(false);
  const [igRecipientId, setIgRecipientId] = useState<string>('');
  const [igMessage, setIgMessage] = useState<string>('');
  const [sendingIg, setSendingIg] = useState<boolean>(false);

  // Duplicate Lead Detection & Merge Tool
  const [duplicateLeads, setDuplicateLeads] = useState<Lead[]>([]);
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [mergingLead, setMergingLead] = useState<boolean>(false);
  const [selectedMergeDupId, setSelectedMergeDupId] = useState<string | number | null>(null);

  // Post-Call Outcome / Disposition State (Legacy CRM Standard)
  const [showCallOutcomeModal, setShowCallOutcomeModal] = useState<boolean>(false);
  const [callOutcome, setCallOutcome] = useState<string>('CONNECTED');
  const [callNotes, setCallNotes] = useState<string>('');
  const [callCallbackDate, setCallCallbackDate] = useState<string>('');
  const [callCallbackTime, setCallCallbackTime] = useState<string>('10:00');
  const [savingCallOutcome, setSavingCallOutcome] = useState<boolean>(false);

  const handleInitiateCall = () => {
    if (!lead?.phoneNumber) {
      showAlert({ title: 'Call', message: 'No phone number available for this candidate.' });
      return;
    }
    window.location.href = `tel:${lead.phoneNumber}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCallCallbackDate(tomorrow.toISOString().split('T')[0]);
    setCallOutcome('CONNECTED');
    setCallNotes('');
    setShowCallOutcomeModal(true);
  };

  const handleSaveCallOutcome = async () => {
    if (!lead) return;
    setSavingCallOutcome(true);
    try {
      let outcomeLabel = 'Connected & Spoke with Candidate';
      let nextStatus = lead.status;

      if (callOutcome === 'CONNECTED') {
        outcomeLabel = 'Connected & Qualified';
        if (lead.status === 'CREATED') nextStatus = 'CONTACTED';
      } else if (callOutcome === 'INTERESTED') {
        outcomeLabel = 'Highly Interested Candidate';
        nextStatus = 'QUALIFIED';
      } else if (callOutcome === 'NO_ANSWER') {
        outcomeLabel = 'Ringing / No Answer';
        if (lead.status === 'CREATED') nextStatus = 'CONTACTED';
      } else if (callOutcome === 'BUSY') {
        outcomeLabel = 'Busy / Declined';
      } else if (callOutcome === 'CALLBACK') {
        outcomeLabel = `Callback Requested for ${callCallbackDate} at ${callCallbackTime}`;
      } else if (callOutcome === 'NOT_INTERESTED') {
        outcomeLabel = 'Not Interested / Lost';
        nextStatus = 'LOST';
      }

      const noteEntry = `[Call Outcome: ${outcomeLabel}]${callNotes.trim() ? ` ${callNotes.trim()}` : ''}`;
      const updatedNotes = lead.notes ? `${lead.notes}\n${noteEntry}` : noteEntry;

      if (nextStatus && nextStatus !== lead.status) {
        await crmService.updateLeadStatus(lead.id, nextStatus, updatedNotes);
        setLead((prev) => (prev ? { ...prev, status: nextStatus, notes: updatedNotes } : prev));
      } else {
        await crmService.patchLead(lead.id, { notes: updatedNotes }).catch(() => {});
        setLead((prev) => (prev ? { ...prev, notes: updatedNotes } : prev));
      }

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        userRole: currentUser?.authorities?.[0],
        actionType: 'OUTREACH',
        title: `Call Logged: ${outcomeLabel}`,
        description: callNotes.trim() || `Recorded outcome for call to ${lead.phoneNumber}`,
      });

      if (callOutcome === 'CALLBACK' && callCallbackDate) {
        try {
          await notificationApiService.createEvent({
            title: `Callback with ${lead.customerName || 'Candidate'}`,
            eventDate: callCallbackDate,
            eventTime: callCallbackTime || '10:00',
            eventType: 'CALL',
            priority: 'HIGH',
            description: callNotes || 'Scheduled from call disposition popup',
            candidateId: lead.id,
          });
        } catch {}
      }

      setShowCallOutcomeModal(false);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
      showAlert({ title: 'Call Logged', message: `Outcome "${outcomeLabel}" recorded successfully.` });
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.message || 'Failed to save call outcome.' });
    } finally {
      setSavingCallOutcome(false);
    }
  };

  const connectGoogleDirectly = async () => {
    const authRes = await integrationsService.getGoogleAuthUrl();
    window.location.href = authRes.url;
  };

  const getMeetRemainingTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return null;
    const target = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(target.getTime())) return null;
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return { isPast: true, text: 'Scheduled for earlier or past time' };
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0) return { isPast: false, text: `${mins} min remaining` };
    return { isPast: false, text: `${hours} hour${hours > 1 ? 's' : ''} ${mins} min remaining` };
  };

  const handleCreateGoogleMeet = () => {
    if (!lead) return;
    const candidateName = lead.customerName || lead.fullName || 'Candidate';
    setMeetTitle(`Follow-up with ${candidateName}`);

    // Default to today
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    setMeetDate(dateStr);

    // Next round hour
    now.setHours(now.getHours() + 1);
    const hh = String(now.getHours()).padStart(2, '0');
    setMeetTime(`${hh}:00`);

    setMeetDuration(30);
    setMeetSendWhatsApp(!!lead.phoneNumber);
    setMeetSendEmail(!!lead.email);
    setMeetCustomNotes('');
    setShowMeetScheduleModal(true);
  };

  const handleOpenEmailComposer = async () => {
    setOpeningEmail(true);
    try {
      const status = await integrationsService.getGoogleStatus();
      if (!status.connected) {
        await connectGoogleDirectly();
        return;
      }
      const candidateName = lead?.customerName || lead?.fullName || 'Candidate';
      setConnectedGoogleEmail(status.googleEmail || status.email || '');
      setEmailTo(lead?.email || '');
      setEmailSubject(`Regarding your inquiry - SSA SalesHub`);
      setEmailBody(`Hi ${candidateName},\n\n`);
      setActiveSection('emails');
      setActiveRelatedView('emails');
    } catch (err: any) {
      showAlert({
        title: 'Gmail',
        message: err?.message || 'Unable to connect Gmail right now.',
      });
    } finally {
      setOpeningEmail(false);
    }
  };

  const handleSendCandidateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim()) return;
    setSendingEmail(true);
    try {
      await integrationsService.sendTestEmail({
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: emailBody,
      });
      const newEmailEntry = {
        id: `${Date.now()}`,
        from: connectedGoogleEmail || 'Connected Gmail',
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: emailBody,
        sentAt: new Date().toISOString(),
      };
      setSentEmails((prev) => {
        const next = [newEmailEntry, ...prev];
        if (resolvedLeadId) localStorage.setItem(`ssa_lead_emails_${resolvedLeadId}`, JSON.stringify(next));
        return next;
      });
      if (lead?.id) {
        leadActivityService.logActivity(lead.id, {
          userName: currentUser?.login || currentUser?.firstName || 'Counselor',
          actionType: 'OUTREACH',
          title: `Email sent: ${emailSubject.trim()}`,
          description: `Sent to ${emailTo.trim()}`,
        });
      }
      setActiveRelatedView(null);
      setActiveSection('lead-info');
      showAlert({ title: 'Email Sent', message: `Email sent to ${emailTo.trim()}.` });
    } catch (err: any) {
      showAlert({
        title: 'Email Failed',
        message: err?.response?.data?.error || err?.message || 'Failed to send email.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleUploadCandidateDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead) return;
    setUploadingDoc(true);
    try {
      const res = await fileService.uploadFile(file, 'documents');
      const newDoc = {
        id: `${Date.now()}`,
        name: res.fileName || file.name,
        docType: docTypeInput.trim() || 'Document',
        url: res.url,
        uploadedAt: new Date().toISOString(),
        size: res.fileSize || file.size,
      };
      setCandidateDocs((prev) => {
        const next = [newDoc, ...prev];
        if (resolvedLeadId) localStorage.setItem(`ssa_lead_docs_${resolvedLeadId}`, JSON.stringify(next));
        return next;
      });
      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        actionType: 'DATA_MODIFY',
        title: `Document uploaded: ${newDoc.docType}`,
        description: newDoc.name,
      });
      showAlert({ title: 'Document Uploaded', message: `${newDoc.name} uploaded successfully.` });
    } catch (err: any) {
      showAlert({
        title: 'Upload Failed',
        message: err?.response?.data?.message || err?.message || 'Unable to upload document.',
      });
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleDeleteCandidateDoc = (docId: string) => {
    if (!window.confirm('Remove this document from the candidate dossier?')) return;
    setCandidateDocs((prev) => {
      const next = prev.filter((d) => d.id !== docId);
      if (resolvedLeadId) localStorage.setItem(`ssa_lead_docs_${resolvedLeadId}`, JSON.stringify(next));
      return next;
    });
  };

  const handleOpenInstagramComposer = () => {
    const candidateName = lead?.customerName || lead?.fullName || 'there';
    const prefillId = getInstagramDmRecipientId(lead);
    setIgRecipientId(prefillId);
    setIgMessage(`Hi ${candidateName}, thanks for reaching out to SSA SalesHub!`);
    setShowInstagramModal(true);
  };

  const handleSendInstagramDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igRecipientId.trim() || !igMessage.trim()) return;
    setSendingIg(true);
    try {
      const res = await integrationsService.sendInstagramMessage({
        recipientId: igRecipientId.trim(),
        message: igMessage.trim(),
        leadId: lead?.id ? Number(lead.id) : undefined,
      });
      // API may return 200 with success:false — treat that as failure
      if (res && res.success === false) {
        throw new Error(res.errorMessage || 'Failed to send Instagram DM.');
      }
      setShowInstagramModal(false);
      showAlert({ title: 'Instagram DM Sent', message: 'Direct message delivered.' });
    } catch (err: any) {
      showAlert({
        title: 'Instagram DM Failed',
        message: err?.response?.data?.errorMessage || err?.response?.data?.error || err?.message || 'Failed to send Instagram DM.',
      });
    } finally {
      setSendingIg(false);
    }
  };

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
      if (fromNotification) {
        navigate(notificationFallbackPath, { replace: true });
        return;
      }
      setError('Invalid or expired candidate link.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIsServerDown(false);

    // Fetch activities & candidate reminders in parallel
    leadActivityService.getActivities(targetId).then(setActivities).catch(() => { });
    notificationApiService.getEventsForCandidate(targetId)
      .then(setLeadReminders)
      .catch(() => { });
    try {
      let candidateData: Lead | null = null;
      try {
        candidateData = await crmService.getDetailedLeadById(targetId);
      } catch (innerErr: any) {
        // If server is down, rethrow immediately
        if (innerErr?.isServerDown || (innerErr?.status && innerErr.status >= 500)) {
          throw innerErr;
        }
        // Fallback: search in detailed leads array
        const all = await crmService.getDetailedLeads();
        const found = (Array.isArray(all) ? all : []).find(
          (l) => Number(l.id) === Number(targetId) || l.externalId === String(targetId)
        );
        if (found) {
          candidateData = found;
        } else {
          throw new Error('The requested candidate could not be found.');
        }
      }

      if (candidateData) {
        // Enforce role-based access for non-admin counselors
        if (!isAdmin && filterLeadsByUserRole([candidateData], currentUser).length === 0) {
          throw new Error(`Access restricted: Candidate belongs to a different category outside your assigned scope.`);
        }

        const cachedClosing = localStorage.getItem(`ssa_lead_closing_date_${candidateData.id}`);
        const effectiveClosing = candidateData.closingDate || (candidateData as any).purchaseTimeline || cachedClosing || '';
        if (effectiveClosing && !candidateData.closingDate) {
          candidateData.closingDate = effectiveClosing;
        }

        const cachedBudget = localStorage.getItem(`ssa_lead_budget_${candidateData.id}`);
        const cachedPaymentStatus = localStorage.getItem(`ssa_lead_payment_status_${candidateData.id}`);
        const cachedPaymentDetails = localStorage.getItem(`ssa_lead_payment_details_${candidateData.id}`);
        const cachedPercentage = localStorage.getItem(`ssa_lead_percentage_${candidateData.id}`);

        // Extract student percentage from notes if available (e.g. "CGPA: RNR" or "CGPA/Percentage: 65-75%_(6.5-7.5_cgpa)")
        let extractedPercentage = '';
        if (candidateData.notes) {
          const m = candidateData.notes.match(/(?:what_is_your_cgpa_or_current_percentage|cgpa[\s/]*percentage|cgpa|percentage|score|marks)\s*[:=?/]\s*([^|\n,;]+)/i);
          if (m && m[1]) {
            extractedPercentage = formatAcademicScore(m[1].trim());
          }
        }

        // Also check Meta Form Responses JSON for academic score if present
        if (!extractedPercentage && candidateData.metaFormResponses) {
          try {
            const parsed = JSON.parse(candidateData.metaFormResponses);
            if (Array.isArray(parsed)) {
              const scoreEntry = parsed.find(
                (r: any) =>
                  r &&
                  (/cgpa|percentage|score|marks|grade/i.test(r.key || '') ||
                    /cgpa|percentage|score|marks|grade/i.test(r.label || ''))
              );
              if (scoreEntry && scoreEntry.value) {
                extractedPercentage = formatAcademicScore(String(scoreEntry.value).trim());
              }
            }
          } catch {}
        }

        // Check whether raw budgetRange was erroneously populated with CGPA / percentage
        const rawBudgetCandidate = candidateData.budgetRange || (candidateData as any).budget || (candidateData as any).clientBudget || cachedBudget || '';
        const budgetIsScore = isAcademicScore(rawBudgetCandidate);
        if (!extractedPercentage && budgetIsScore) {
          extractedPercentage = formatAcademicScore(rawBudgetCandidate);
        }

        const effectiveBudget = budgetIsScore ? '' : rawBudgetCandidate;
        const effectivePaymentStatus = readLeadPreferenceField(candidateData, 'paymentStatus') || cachedPaymentStatus || 'UNPAID';
        const effectivePaymentDetails = readLeadPreferenceField(candidateData, 'paymentDetails') || cachedPaymentDetails || '';
        const effectivePercentage = formatAcademicScore(
          (candidateData as any).studentPercentage || (candidateData as any).cgpa || cachedPercentage || extractedPercentage || ''
        );

        candidateData.budgetRange = effectiveBudget;
        candidateData.clientBudget = effectiveBudget;
        (candidateData as any).paymentStatus = effectivePaymentStatus;
        (candidateData as any).paymentDetails = effectivePaymentDetails;
        candidateData.studentPercentage = effectivePercentage;
        candidateData.cgpa = effectivePercentage;

        setBudgetInput(effectiveBudget);
        setPaymentDetailsInput(effectivePaymentDetails);
        setPercentageInput(effectivePercentage);
        setLead(candidateData);
        setEditFormData({
          customerName: candidateData.customerName || '',
          phoneNumber: candidateData.phoneNumber || '',
          email: candidateData.email || '',
          city: candidateData.city || candidateData.location || '',
          visaType: candidateData.visaType || 'WORK_VISA',
          closingDate: effectiveClosing ? effectiveClosing.substring(0, 10) : '',
          age: candidateData.age || AGE_BRACKETS[0],
          educationalQualification: candidateData.educationalQualification || EDUCATION_QUALIFICATIONS[2],
          areYouWorking: candidateData.areYouWorking || 'yes',
          areYouInterested: candidateData.areYouInterested || 'yes',
          leadConfirm: candidateData.leadConfirm || 'Confirmed',
          notes: candidateData.notes || '',
          budgetRange: effectiveBudget,
          clientBudget: effectiveBudget,
          paymentStatus: effectivePaymentStatus,
          paymentDetails: effectivePaymentDetails,
          studentPercentage: effectivePercentage,
          cgpa: effectivePercentage,
        });

        // Newest first; entries saved with a "[date · author]" prefix keep their own date and author
        setNotesHistory(
          parseRemarks(
            candidateData.notes,
            candidateData.createdTime || candidateData.createdAt || new Date().toISOString(),
            candidateData.assignedTo || 'Counselor'
          ).reverse()
        );
      }
    } catch (err: any) {
      const serverDown = Boolean(
        err?.isServerDown ||
        (err?.status && err.status >= 500) ||
        (err?.message && err.message.toLowerCase().includes('server is down')) ||
        (err?.message && err.message.toLowerCase().includes('cloudflare'))
      );
      setIsServerDown(serverDown);
      if (!serverDown && fromNotification) {
        navigate(notificationFallbackPath, { replace: true });
        return;
      }
      setError(serverDown ? 'Server is down. Please contact support team.' : err?.message || 'Failed to load candidate dossier.');
    } finally {
      setLoading(false);
    }
  }, [resolvedLeadId, isAdmin, currentUser, fromNotification, notificationFallbackPath, navigate]);

  useEffect(() => {
    fetchCandidate();
    const handleRefresh = () => fetchCandidate();
    window.addEventListener('app:pull-to-refresh', handleRefresh);
    return () => window.removeEventListener('app:pull-to-refresh', handleRefresh);
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
      showAlert({ title: 'Candidate', message: `Staff assignment failed: ${err?.message || 'Server error'}` });
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

      // Authentic Apple iOS Status Updated Success Modal
      showAlert({
        title: 'Status Updated',
        message: `Candidate stage moved to "${newStatusLabel}".`,
        icon: 'success',
        buttonText: 'Done',
        autoCloseMs: 2200,
      });
    } catch (err: any) {
      showAlert({
        title: 'Update Failed',
        message: err?.message || 'Server error while updating status.',
        icon: 'error',
        buttonText: 'OK',
      });
    }
  };

  // Remarks shown newest-first; stored order (oldest-first) is restored when saving.
  const toNotesHistory = (notes: string | undefined | null, l: Lead): RemarkEntry[] =>
    parseRemarks(
      notes,
      l.createdTime || l.createdAt || new Date().toISOString(),
      l.assignedTo || 'Counselor'
    ).reverse();

  // Local cache mirrors values the server has CONFIRMED (written only after a successful save),
  // so it can never hide a failed save.
  const cacheLeadField = (leadId: string | number, key: string, value: string) => {
    try {
      localStorage.setItem(`ssa_lead_${key}_${leadId}`, value);
    } catch {
      // storage unavailable or full
    }
  };

  const actorName = () => currentUser?.login || currentUser?.firstName || 'Counselor';

  // Saves preference fields; remembers a newly created preference id so later saves update it
  // instead of creating another record.
  const savePreference = async (target: Lead, fields: Record<string, any>) => {
    const res = await crmService.upsertLeadPreference(target, fields);
    const hasPref = (target as any).preferenceId || (target as any).leadPreferenceId;
    if (!hasPref && res?.id) {
      setLead((prev) => (prev ? { ...prev, preferenceId: res.id } : prev));
    }
    return res;
  };

  const showSaveError = (what: string, err: any) => {
    showAlert({
      title: 'Not Saved',
      message: `${what} could not be saved: ${err?.message || 'Server error'}. Your change was undone.`,
      icon: 'error',
      buttonText: 'OK',
    });
  };

  const handleAddNote = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!newNote.trim() || !lead) return;
    const noteText = sanitizeRemarkText(newNote);
    if (!noteText) return;
    const author = currentUser?.firstName || currentUser?.login || 'Counselor';
    const now = new Date();
    const entry = buildRemarkEntry(noteText, author, now);
    setSubmittingNote(true);
    try {
      const combinedNotes = lead.notes ? `${lead.notes} | ${entry}` : entry;

      await crmService.updateLeadStatus(lead.id, lead.status || 'CONTACTED', combinedNotes);

      setNotesHistory((prev) => [
        { note: noteText, date: now.toISOString(), author, raw: entry },
        ...prev,
      ]);

      setLead({ ...lead, notes: combinedNotes });
      setNewNote('');
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      leadActivityService.logActivity(lead.id, {
        userName: actorName(),
        userRole: currentUser?.authorities?.[0],
        actionType: 'REMARKS_ADDED',
        title: 'Counselor Remark Recorded',
        description: noteText,
        fieldChanged: 'notes',
      });
    } catch (err: any) {
      showAlert({ title: 'Remarks', message: `Failed to record discussion note: ${err?.message || 'Server error'}` });
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteRemark = async (indexToDelete: number) => {
    if (!lead) return;
    const confirmed = await showConfirm({
      title: 'Delete Remark',
      message: 'Are you sure you want to delete this remark?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    const updatedHistory = notesHistory.filter((_, idx) => idx !== indexToDelete);
    // History is newest-first; rebuild the stored field oldest-first without touching other entries
    const updatedNotes = joinRemarks([...updatedHistory].reverse());

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
      showAlert({ title: 'Remarks', message: `Failed to delete remark: ${err?.message || 'Server error'}` });
    }
  };

  const handleUpdateBudget = async (newBudget: string) => {
    if (!lead) return;
    const trimmed = formatCurrencyDisplay(newBudget) || newBudget.trim();
    const oldBudget = lead.budgetRange || '';
    setIsEditingBudget(false);
    if (trimmed === oldBudget) return;

    // Optimistic update, rolled back below if the server rejects it
    setLead((prev) => (prev ? { ...prev, budgetRange: trimmed, clientBudget: trimmed } : null));
    setEditFormData((prev) => ({ ...prev, budgetRange: trimmed }));

    try {
      await savePreference(lead, { budgetRange: trimmed });
      cacheLeadField(lead.id, 'budget', trimmed);

      leadActivityService.logActivity(lead.id, {
        userName: actorName(),
        userRole: currentUser?.authorities?.[0] || 'STAFF',
        actionType: 'DATA_MODIFY',
        title: 'Updated Client Budget',
        description: `Client budget updated from "${oldBudget || 'None'}" to "${trimmed || 'None'}"`,
        fieldChanged: 'budgetRange',
        oldValue: oldBudget,
        newValue: trimmed,
      });

      showAlert({ title: 'Success', message: `Client budget updated to ${trimmed || 'Cleared'}` });
    } catch (err: any) {
      setLead((prev) => (prev ? { ...prev, budgetRange: oldBudget, clientBudget: oldBudget } : null));
      setEditFormData((prev) => ({ ...prev, budgetRange: oldBudget }));
      setBudgetInput(oldBudget);
      showSaveError('Client budget', err);
    }
  };

  const handleUpdatePaymentStatus = async (status: 'UNPAID' | 'PARTIAL' | 'PAID') => {
    if (!lead || updatingPayment) return;
    const oldStatus = (lead as any).paymentStatus || 'UNPAID';
    if (oldStatus === status) return;
    setUpdatingPayment(true);

    setLead((prev) => (prev ? { ...prev, paymentStatus: status } : null));
    setEditFormData((prev) => ({ ...prev, paymentStatus: status }));

    const statusLabels: Record<string, string> = {
      UNPAID: 'Not Paid',
      PARTIAL: 'Partially Paid',
      PAID: 'Fully Paid',
    };

    try {
      await savePreference(lead, { paymentStatus: status });
      cacheLeadField(lead.id, 'payment_status', status);

      leadActivityService.logActivity(lead.id, {
        userName: actorName(),
        userRole: currentUser?.authorities?.[0] || 'STAFF',
        actionType: 'STATUS_CHANGE',
        title: 'Updated Payment Status',
        description: `Payment status changed from ${statusLabels[oldStatus] || oldStatus} to ${statusLabels[status] || status}`,
        fieldChanged: 'paymentStatus',
        oldValue: oldStatus,
        newValue: status,
      });

      showAlert({ title: 'Payment Updated', message: `Candidate marked as ${statusLabels[status]}` });
    } catch (err: any) {
      setLead((prev) => (prev ? { ...prev, paymentStatus: oldStatus } : null));
      setEditFormData((prev) => ({ ...prev, paymentStatus: oldStatus }));
      showSaveError('Payment status', err);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleUpdatePaymentDetails = async (details: string) => {
    if (!lead) return;
    const trimmed = details.trim();
    const oldDetails = (lead as any).paymentDetails || '';
    setIsEditingPaymentDetails(false);
    if (trimmed === oldDetails) return;

    setLead((prev) => (prev ? { ...prev, paymentDetails: trimmed } : null));
    setEditFormData((prev) => ({ ...prev, paymentDetails: trimmed }));

    try {
      await savePreference(lead, { paymentDetails: trimmed });
      cacheLeadField(lead.id, 'payment_details', trimmed);

      leadActivityService.logActivity(lead.id, {
        userName: actorName(),
        userRole: currentUser?.authorities?.[0] || 'STAFF',
        actionType: 'DATA_MODIFY',
        title: 'Updated Payment Details',
        description: `Payment details updated: "${trimmed}"`,
        fieldChanged: 'paymentDetails',
        oldValue: oldDetails,
        newValue: trimmed,
      });

      showAlert({ title: 'Success', message: 'Payment details saved successfully' });
    } catch (err: any) {
      setLead((prev) => (prev ? { ...prev, paymentDetails: oldDetails } : null));
      setEditFormData((prev) => ({ ...prev, paymentDetails: oldDetails }));
      setPaymentDetailsInput(oldDetails);
      showSaveError('Payment details', err);
    }
  };

  const handleUpdatePercentage = async (newPercentage: string) => {
    if (!lead) return;
    const trimmed = sanitizeRemarkText(newPercentage);
    const oldPercentage = (lead as any).studentPercentage || (lead as any).cgpa || '';
    const oldNotes = lead.notes || '';
    setIsEditingPercentage(false);
    if (trimmed === oldPercentage) return;

    // Sync to notes: replace existing CGPA entry or prepend
    let updatedNotes = oldNotes;
    const cgpaPattern = /(?:what_is_your_cgpa_or_current_percentage|cgpa|percentage|score|marks)\s*[:=?]\s*([^|\n,;]+)/i;
    if (cgpaPattern.test(updatedNotes)) {
      updatedNotes = updatedNotes.replace(cgpaPattern, `CGPA: ${trimmed}`);
    } else if (trimmed) {
      updatedNotes = updatedNotes ? `CGPA: ${trimmed} | ${updatedNotes}` : `CGPA: ${trimmed}`;
    }

    setLead((prev) => (prev ? { ...prev, studentPercentage: trimmed, cgpa: trimmed, notes: updatedNotes } : null));
    setEditFormData((prev) => ({ ...prev, studentPercentage: trimmed, cgpa: trimmed, notes: updatedNotes }));
    setNotesHistory(toNotesHistory(updatedNotes, lead));

    try {
      // The lead's notes field is the source of truth for the score
      await crmService.patchLead(lead.id, { notes: updatedNotes });

      // Secondary copy on the preference record; not critical if it fails
      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      if (prefId) {
        await crmService.upsertLeadPreference(lead, { notes: updatedNotes }).catch(() => { });
      }

      cacheLeadField(lead.id, 'percentage', trimmed);

      leadActivityService.logActivity(lead.id, {
        userName: actorName(),
        userRole: currentUser?.authorities?.[0] || 'STAFF',
        actionType: 'DATA_MODIFY',
        title: 'Updated Student Percentage / CGPA',
        description: `Student score updated from "${oldPercentage || 'None'}" to "${trimmed || 'None'}"`,
        fieldChanged: 'studentPercentage',
        oldValue: oldPercentage,
        newValue: trimmed,
      });

      showAlert({ title: 'Success', message: `Student score updated to ${trimmed || 'Cleared'}` });
    } catch (err: any) {
      setLead((prev) => (prev ? { ...prev, studentPercentage: oldPercentage, cgpa: oldPercentage, notes: oldNotes } : null));
      setEditFormData((prev) => ({ ...prev, studentPercentage: oldPercentage, cgpa: oldPercentage, notes: oldNotes }));
      setNotesHistory(toNotesHistory(oldNotes, lead));
      setPercentageInput(oldPercentage);
      showSaveError('Student score', err);
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
    if (
      editFormData.closingDate !== undefined &&
      editFormData.closingDate !== (lead.closingDate || (lead as any).purchaseTimeline)
    ) {
      changes.push(
        `Target Closing Date: "${lead.closingDate || (lead as any).purchaseTimeline || 'Not Set'}" → "${editFormData.closingDate || 'Cleared'}"`
      );
    }
    if (editFormData.budgetRange !== undefined && editFormData.budgetRange !== lead.budgetRange) {
      changes.push(`Budget: "${lead.budgetRange || 'None'}" → "${editFormData.budgetRange}"`);
    }
    if (editFormData.paymentStatus !== undefined && editFormData.paymentStatus !== (lead as any).paymentStatus) {
      changes.push(`Payment Status: "${(lead as any).paymentStatus || 'UNPAID'}" → "${editFormData.paymentStatus}"`);
    }
    if (editFormData.paymentDetails !== undefined && editFormData.paymentDetails !== (lead as any).paymentDetails) {
      changes.push(`Payment Details: "${(lead as any).paymentDetails || 'None'}" → "${editFormData.paymentDetails}"`);
    }
    if (editFormData.studentPercentage !== undefined && editFormData.studentPercentage !== (lead as any).studentPercentage) {
      changes.push(`Student Percentage: "${(lead as any).studentPercentage || 'None'}" → "${editFormData.studentPercentage}"`);
    }

    // The student score is persisted inside the lead's notes ("CGPA: ..."), same as the inline editor.
    const percentageChanged =
      editFormData.studentPercentage !== undefined &&
      editFormData.studentPercentage !== (lead as any).studentPercentage;
    let notesToSave = editFormData.notes !== undefined ? editFormData.notes : lead.notes || '';
    if (percentageChanged) {
      const pct = sanitizeRemarkText(editFormData.studentPercentage || '');
      const cgpaPattern = /(?:what_is_your_cgpa_or_current_percentage|cgpa|percentage|score|marks)\s*[:=?]\s*([^|\n,;]+)/i;
      if (cgpaPattern.test(notesToSave)) {
        notesToSave = notesToSave.replace(cgpaPattern, `CGPA: ${pct}`);
      } else if (pct) {
        notesToSave = notesToSave ? `CGPA: ${pct} | ${notesToSave}` : `CGPA: ${pct}`;
      }
    }
    const notesChanged = notesToSave !== (lead.notes || '');

    // Each part is saved separately; failures are collected and reported instead of swallowed.
    const tasks: Array<{ label: string; run: () => Promise<any> }> = [];

    if (lead.customerId) {
      tasks.push({
        label: 'Contact details (name, phone, email, city)',
        run: () =>
          crmService.updateCustomer(lead.customerId, {
            id: Number(lead.customerId),
            fullName: editFormData.customerName || lead.customerName,
            phoneNumber: editFormData.phoneNumber || lead.phoneNumber,
            location: editFormData.city || lead.city || lead.location,
            email: editFormData.email || lead.email,
          } as any),
      });
    }

    tasks.push({
      label: 'Program, budget, payment and closing date',
      run: () =>
        savePreference(lead, {
          visaType: editFormData.visaType || lead.visaType,
          email: editFormData.email || lead.email,
          city: editFormData.city || lead.city,
          age: editFormData.age || lead.age,
          educationalQualification: editFormData.educationalQualification || lead.educationalQualification,
          notes: notesToSave || lead.notes,
          closingDate: editFormData.closingDate || lead.closingDate,
          budgetRange: editFormData.budgetRange !== undefined ? editFormData.budgetRange : lead.budgetRange,
          paymentStatus: editFormData.paymentStatus !== undefined ? editFormData.paymentStatus : (lead as any).paymentStatus,
          paymentDetails: editFormData.paymentDetails !== undefined ? editFormData.paymentDetails : (lead as any).paymentDetails,
        }),
    });

    if (notesChanged) {
      tasks.push({
        label: percentageChanged ? 'Notes and student score' : 'Notes',
        run: () => crmService.updateLeadStatus(lead.id, lead.status || 'CREATED', notesToSave),
      });
    }

    try {
      const results = await Promise.allSettled(tasks.map((t) => t.run()));
      const failed = tasks.filter((_, i) => results[i].status === 'rejected');
      const preferenceSaved = !failed.some((t) => t.label.startsWith('Program'));

      if (preferenceSaved) {
        // Cache only values the server has confirmed
        if (editFormData.closingDate !== undefined) cacheLeadField(lead.id, 'closing_date', editFormData.closingDate);
        if (editFormData.budgetRange !== undefined) cacheLeadField(lead.id, 'budget', editFormData.budgetRange);
        if (editFormData.paymentStatus !== undefined) cacheLeadField(lead.id, 'payment_status', editFormData.paymentStatus);
        if (editFormData.paymentDetails !== undefined) cacheLeadField(lead.id, 'payment_details', editFormData.paymentDetails);
      }
      const notesSaved = !failed.some((t) => t.label.startsWith('Notes'));
      if (percentageChanged && notesSaved) {
        cacheLeadField(lead.id, 'percentage', sanitizeRemarkText(editFormData.studentPercentage || ''));
      }

      if (failed.length > 0) {
        // Keep the edit sheet open with the user's values so they can retry
        const firstError = (results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
        showAlert({
          title: 'Some Changes Not Saved',
          message: `These parts could not be saved:\n• ${failed.map((t) => t.label).join('\n• ')}\n\n${firstError?.message || 'Server error'}. Please try again.`,
          icon: 'error',
          buttonText: 'OK',
        });
        return;
      }

      setLead((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...editFormData,
          customerName: editFormData.customerName || prev.customerName,
          phoneNumber: editFormData.phoneNumber || prev.phoneNumber,
          email: editFormData.email || prev.email,
          city: editFormData.city || prev.city,
          location: editFormData.city || prev.location,
          visaType: editFormData.visaType || prev.visaType,
          closingDate: editFormData.closingDate !== undefined ? editFormData.closingDate : prev.closingDate,
          purchaseTimeline: editFormData.closingDate !== undefined ? editFormData.closingDate : (prev as any).purchaseTimeline,
          notes: notesToSave,
          budgetRange: editFormData.budgetRange !== undefined ? editFormData.budgetRange : prev.budgetRange,
          clientBudget: editFormData.budgetRange !== undefined ? editFormData.budgetRange : (prev as any).clientBudget,
          paymentStatus: editFormData.paymentStatus !== undefined ? editFormData.paymentStatus : (prev as any).paymentStatus,
          paymentDetails: editFormData.paymentDetails !== undefined ? editFormData.paymentDetails : (prev as any).paymentDetails,
          studentPercentage: editFormData.studentPercentage !== undefined ? editFormData.studentPercentage : (prev as any).studentPercentage,
          cgpa: editFormData.studentPercentage !== undefined ? editFormData.studentPercentage : (prev as any).cgpa,
        };
      });
      if (notesChanged) {
        setNotesHistory(toNotesHistory(notesToSave, lead));
      }

      setShowEditModal(false);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      if (changes.length > 0) {
        leadActivityService.logActivity(lead.id, {
          userName: actorName(),
          userRole: currentUser?.authorities?.[0],
          actionType: 'DATA_MODIFY',
          title: 'Candidate Details Updated',
          description: `Counselor updated ${changes.length} field(s):\n• ` + changes.join('\n• '),
        });
      }
    } catch (err: any) {
      showAlert({ title: 'Candidate', message: `Failed to save candidate changes: ${err?.message || 'Server error'}` });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      showAlert({ title: 'Access Denied', message: 'Only administrators can delete candidate leads.' });
      return;
    }
    if (!lead) return;
    const confirmed = await showConfirm({
      title: 'Delete Candidate',
      message: `Permanently delete candidate dossier for "${lead.customerName || 'this record'}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await crmService.deleteLead(lead.id);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
      navigate('/leads');
    } catch (err: any) {
      showAlert({ title: 'Candidate', message: `Delete failed: ${err?.message || 'Server error'}` });
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    return formatIndianDateTime(isoStr, { fallback: isoStr });
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

  const cleanCandidateName = (name?: string) => {
    if (!name) return 'Candidate';
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
      return parts[0];
    }
    return trimmed;
  };

  const handleOpenWhatsAppModal = () => {
    if (!lead) return;
    const cName = cleanCandidateName(lead.customerName || lead.fullName);
    const visa = lead.visaType === 'WORK_VISA' ? 'Work Visa' : lead.visaType === 'STUDY_VISA' ? 'Study Visa' : 'visa';
    if (!customWhatsAppMsg || !customWhatsAppMsg.trim()) {
      setCustomWhatsAppMsg(
        `Hello ${cName}, greetings from SSA SalesHub! We received your inquiry regarding our international ${visa} programs. Are you available for a brief discussion regarding eligibility and visa requirements?`
      );
    }
    setShowWhatsAppTemplateModal(true);
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
      description: `Sent personalized message to ${lead.phoneNumber}: "${text.substring(0, 90)}${text.length > 90 ? '...' : ''
        }"`,
      metadata: { text, phoneNumber: lead.phoneNumber },
    });
  };

  // Check for duplicate leads sharing phone or email
  useEffect(() => {
    if (!lead) return;
    const curPhone = (lead.phoneNumber || '').replace(/\D/g, '');
    const curEmail = (lead.email || '').trim().toLowerCase();
    if (curPhone.length < 7 && !curEmail) {
      setDuplicateLeads([]);
      return;
    }

    crmService
      .getDetailedLeads()
      .then((all) => {
        if (Array.isArray(all)) {
          const matches = all.filter((o) => {
            if (String(o.id) === String(lead.id)) return false;
            const oPhone = (o.phoneNumber || '').replace(/\D/g, '');
            const oEmail = (o.email || '').trim().toLowerCase();
            const pMatch =
              curPhone.length >= 7 &&
              oPhone.length >= 7 &&
              (oPhone.endsWith(curPhone.slice(-10)) || curPhone.endsWith(oPhone.slice(-10)));
            const eMatch = Boolean(curEmail && oEmail && oEmail === curEmail);
            return pMatch || eMatch;
          });
          setDuplicateLeads(matches);
          if (matches.length > 0) {
            setSelectedMergeDupId(matches[0].id);
          }
        }
      })
      .catch(() => {});
  }, [lead?.id, lead?.phoneNumber, lead?.email]);

  const handleMergeDuplicate = async (dupLead: Lead) => {
    if (!lead || !dupLead) return;
    setMergingLead(true);
    try {
      // 1. Combine notes if duplicate has any notes
      let combinedNotes = lead.notes || '';
      if (dupLead.notes && dupLead.notes.trim()) {
        const dupStamp = dupLead.createdTime ? new Date(dupLead.createdTime).toLocaleDateString() : 'Previous Record';
        combinedNotes = `${combinedNotes ? combinedNotes + '\n\n' : ''}--- Merged Notes from Duplicate Record #${dupLead.id} (${dupStamp}) ---\n${dupLead.notes}`;
        await crmService.patchLead(lead.id, { notes: combinedNotes }).catch(() => {});
        setLead((prev) => (prev ? { ...prev, notes: combinedNotes } : prev));
      }

      // 2. Transfer missing data if primary lead was missing email or location
      const updatesToPatch: any = {};
      if (!lead.email && dupLead.email) updatesToPatch.email = dupLead.email;
      if (!lead.city && dupLead.city) updatesToPatch.city = dupLead.city;
      if (Object.keys(updatesToPatch).length > 0) {
        await crmService.patchLead(lead.id, updatesToPatch).catch(() => {});
        setLead((prev) => (prev ? { ...prev, ...updatesToPatch } : prev));
      }

      // 3. Log merge activity
      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        userRole: currentUser?.authorities?.[0],
        actionType: 'DATA_MODIFY',
        title: 'Duplicate Candidate Merged',
        description: `Merged duplicate record #${dupLead.id} (${dupLead.customerName || 'Candidate'}) into this primary profile.`,
      });

      // 4. Delete the duplicate lead record
      await crmService.deleteLead(dupLead.id);

      // 5. Update local state & notify listeners
      setDuplicateLeads((prev) => prev.filter((d) => String(d.id) !== String(dupLead.id)));
      setShowMergeModal(false);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      showAlert({
        title: 'Merge Successful',
        message: `Candidate record #${dupLead.id} was merged and consolidated into this profile.`,
      });
    } catch (err: any) {
      showAlert({
        title: 'Merge Failed',
        message: err?.message || 'Could not merge duplicate records.',
      });
    } finally {
      setMergingLead(false);
    }
  };

  const handleConfirmAndSendMeet = async () => {
    if (!lead) return;
    setSchedulingMeet(true);
    try {
      const candidateName = lead.customerName || lead.fullName || 'Candidate';
      const startDate = meetDate && meetTime ? new Date(`${meetDate}T${meetTime}`) : new Date(Date.now() + 3600000);
      const endDate = new Date(startDate.getTime() + (meetDuration || 30) * 60000);

      const res = await integrationsService.createGoogleMeet(meetTitle || `Consultation - ${candidateName}`, {
        description: `Candidate consultation with ${candidateName}${lead.phoneNumber ? ` (${lead.phoneNumber})` : ''}${meetCustomNotes ? `\n\nNotes: ${meetCustomNotes}` : ''}`,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });

      const meetUrl = res?.meetUrl || res?.url || res?.hangoutsLink;
      if (!meetUrl) throw new Error('No Google Meet link returned');

      try {
        await navigator.clipboard.writeText(meetUrl);
      } catch {
        // Ignore clipboard errors
      }

      const formattedDateStr = startDate.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const messageText = `Hi ${candidateName}, your Google Meet consultation with SSA SalesHub has been scheduled for ${formattedDateStr}.\n\n🔗 Meeting Link: ${meetUrl}\n\nPlease join 5 minutes prior to the scheduled time.\n- SSA SalesHub`;

      const dispatchChannels: string[] = [];

      // 1. Dispatch via WhatsApp if selected
      if (meetSendWhatsApp && lead.phoneNumber) {
        openWhatsAppWithText(messageText);
        dispatchChannels.push('WhatsApp');
      }

      // 2. Dispatch via Email if selected
      if (meetSendEmail && lead.email) {
        try {
          await integrationsService.sendTestEmail({
            to: lead.email.trim(),
            subject: `Google Meet Scheduled: ${meetTitle || `Consultation with SSA SalesHub`}`,
            body: messageText,
          });

          const newEmailEntry = {
            id: String(Date.now()),
            from: connectedGoogleEmail || 'Connected Gmail',
            to: lead.email.trim(),
            subject: `Google Meet Scheduled: ${meetTitle || `Consultation with SSA SalesHub`}`,
            body: messageText,
            sentAt: new Date().toISOString(),
          };
          setSentEmails((prev) => {
            const next = [newEmailEntry, ...prev];
            if (resolvedLeadId) {
              localStorage.setItem(`ssa_lead_emails_${resolvedLeadId}`, JSON.stringify(next));
            }
            return next;
          });
          dispatchChannels.push('Email');

          leadActivityService.logActivity(lead.id, {
            userName: currentUser?.login || currentUser?.firstName || 'Counselor',
            userRole: currentUser?.authorities?.[0],
            actionType: 'OUTREACH',
            title: 'Google Meet Link Sent via Email',
            description: `Sent Google Meet link to ${lead.email}: ${meetUrl}`,
            metadata: { meetUrl, scheduledAt: startDate.toISOString(), email: lead.email },
          });
        } catch (emailErr) {
          console.error('Failed to send meet link via email:', emailErr);
        }
      }

      // Log general schedule event
      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
        userRole: currentUser?.authorities?.[0],
        actionType: 'OUTREACH',
        title: 'Google Meet Consultation Scheduled',
        description: `Scheduled consultation for ${formattedDateStr} (${meetDuration} mins). Link: ${meetUrl}`,
        metadata: { meetUrl, scheduledAt: startDate.toISOString(), durationMinutes: meetDuration },
      });

      setShowMeetScheduleModal(false);

      const channelsMsg = dispatchChannels.length > 0 ? ` and dispatched via ${dispatchChannels.join(' & ')}` : '';
      showAlert({
        title: 'Google Meet Scheduled',
        message: `Meeting created for ${formattedDateStr}${channelsMsg}!\n\nLink copied to clipboard:\n${meetUrl}`,
      });
    } catch (err: any) {
      if (err?.response?.status === 412) {
        try {
          await connectGoogleDirectly();
          return;
        } catch {
          // Fall through
        }
      }
      showAlert({
        title: 'Google Meet',
        message: err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to create Google Meet link.',
      });
    } finally {
      setSchedulingMeet(false);
    }
  };

  const getWhatsAppTemplates = () => {
    const name = lead?.customerName || 'Candidate';
    const vt = lead?.visaType;
    const visa = isWorkVisaType(vt)
      ? 'Work Visa'
      : isStudyVisaType(vt)
        ? 'Study Visa'
        : isDomesticAdmissionType(vt)
          ? 'College Admission'
          : 'Visa';
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
    return <CandidateDetailSkeleton />;
  }

  if (error || !lead) {
    if (isServerDown) {
      return (
        <div className="py-20 max-w-md mx-auto text-center space-y-4 px-4">
          <div className="w-14 h-14 rounded-2xl bg-black/[0.04] text-[#ff3b30] flex items-center justify-center mx-auto border border-black/[0.06] shadow-2xs">
            <AlertCircle size={26} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[#1c1c1e] tracking-tight">Server is down</h3>
            <p className="text-xs text-[#8e8e93] leading-relaxed max-w-sm mx-auto">
              Server is down. Please contact support team.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => fetchCandidate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#007aff] hover:bg-[#0071e3] text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            <button
              onClick={() => navigate('/leads')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-black/[0.03] text-[#1c1c1e] rounded-xl text-xs font-semibold border border-black/[0.08] shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>Back to Candidates</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="py-20 max-w-md mx-auto text-center space-y-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-black/[0.04] text-[#8e8e93] flex items-center justify-center mx-auto border border-black/[0.06] shadow-2xs">
          <AlertCircle size={26} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[#1c1c1e] tracking-tight">Candidate Not Found</h3>
          <p className="text-xs text-[#8e8e93] leading-relaxed max-w-sm mx-auto">
            {error || 'This candidate record does not exist or may have been removed.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-black/[0.03] text-[#1c1c1e] rounded-xl text-xs font-semibold border border-black/[0.08] shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <ChevronLeft size={13} />
          <span>Back to Candidates</span>
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
    return formatIndianDate(d, { fallback });
  };

  const getClosingDateInfo = (startStr?: string | null) => {
    const rawClosing =
      lead?.closingDate ||
      (lead as any)?.purchaseTimeline ||
      (lead?.id ? localStorage.getItem(`ssa_lead_closing_date_${lead.id}`) : null);

    let closingDateDisplay = 'Not Set';
    let progressPercent: number | null = null;
    let milestoneBadge: string | null = null;

    if (rawClosing) {
      closingDateDisplay = formatPipelineDate(rawClosing);
      try {
        const start = startStr ? new Date(startStr) : (lead?.createdAt ? new Date(lead.createdAt) : new Date());
        const end = new Date(rawClosing);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() > start.getTime()) {
          const total = end.getTime() - start.getTime();
          const elapsed = Date.now() - start.getTime();
          const pct = Math.min(Math.max(Math.round((elapsed / total) * 100), 0), 100);
          progressPercent = pct;
          if (pct >= 100) milestoneBadge = '100% Target Reached';
          else if (pct >= 75) milestoneBadge = '75% Elapsed';
          else if (pct >= 50) milestoneBadge = '50% Midway';
          else if (pct >= 25) milestoneBadge = '25% Elapsed';
        }
      } catch {
        // fallback
      }
    } else {
      try {
        const base = startStr ? new Date(startStr) : new Date();
        if (!isNaN(base.getTime())) {
          const closing = new Date(base.getTime() + 63 * 24 * 60 * 60 * 1000);
          closingDateDisplay = formatPipelineDate(closing.toISOString());
        }
      } catch {
        closingDateDisplay = '—';
      }
    }

    return { closingDateDisplay, progressPercent, milestoneBadge, hasCustomClosing: Boolean(rawClosing) };
  };

  // Everything Meta sent for this lead
  const formResponses = parseFormResponses((lead as any).metaFormResponses);
  const attributionRows = getAttributionRows(lead as any);
  const origin = getOriginLabel(lead.isOrganic);
  const copyMetaId = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedMetaId(id);
    setTimeout(() => setCopiedMetaId((cur) => (cur === id ? null : cur)), 1500);
  };

  const closingInfo = getClosingDateInfo(lead.createdTime || (lead as any).createdAt || (lead as any).createdDate);

  const scrollToSection = (id: string, sectionKey: any) => {
    setActiveRelatedView(null);
    setActiveSection(sectionKey);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      const container = mainScrollRef.current;
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop = container.scrollTop + (elRect.top - containerRect.top);
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });
      } else if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const STAGES = [
    { key: 'CREATED', label: 'New Lead' },
    { key: 'CONTACTED', label: 'Contacted' },
    { key: 'QUALIFIED', label: 'Qualified' },
    { key: 'PROPOSAL_SENT', label: 'Docs Requested' },
    { key: 'NEGOTIATION', label: 'In Process' },
    { key: 'CONVERTED', label: 'Converted' },
    { key: 'WON', label: 'Closed Won' },
    { key: 'LOST', label: 'Closed Lost' },
  ];

  const currentStatus = (lead.status || 'CREATED').toUpperCase();
  let curStageIndex = STAGES.findIndex((s) => s.key === currentStatus);
  if (curStageIndex === -1) curStageIndex = 0;

  const effectivePaymentStatus = ((lead as any).paymentStatus || 'UNPAID').toUpperCase();

  const handleOpenEdit = () => {
    if (!lead) return;
    setEditFormData({
      customerName: lead.customerName || '',
      phoneNumber: lead.phoneNumber || '',
      email: lead.email || '',
      city: lead.city || lead.location || '',
      visaType: lead.visaType || 'WORK_VISA',
      closingDate: (lead.closingDate || (lead as any).purchaseTimeline || '').substring(0, 10),
      age: lead.age || AGE_BRACKETS[0],
      educationalQualification: lead.educationalQualification || EDUCATION_QUALIFICATIONS[2],
      areYouWorking: lead.areYouWorking || 'yes',
      areYouInterested: lead.areYouInterested || 'yes',
      leadConfirm: lead.leadConfirm || 'Confirmed',
      notes: lead.notes || '',
      budgetRange: lead.budgetRange || '',
      clientBudget: lead.budgetRange || '',
      paymentStatus: (lead as any).paymentStatus || 'UNPAID',
      paymentDetails: (lead as any).paymentDetails || '',
      studentPercentage: (lead as any).studentPercentage || (lead as any).cgpa || '',
      cgpa: (lead as any).studentPercentage || (lead as any).cgpa || '',
    });
    setShowEditModal(true);
  };

  return (
    <>
      {/* Mobile Screen Lead Detail Layout (< 768px) */}
      <div className="block md:hidden">
        {/* Duplicate Lead Detection Alert Banner (Mobile) */}
        {duplicateLeads.length > 0 && (
          <div className="mx-3 mt-2 p-2.5 bg-amber-500/[0.08] border border-amber-500/25 rounded-xl flex items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-950 truncate">
                  {duplicateLeads.length} Duplicate Record{duplicateLeads.length > 1 ? 's' : ''} Found
                </p>
                <p className="text-[10px] text-amber-800 truncate">
                  {duplicateLeads[0].customerName || 'Candidate'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMergeModal(true)}
              className="px-2.5 py-1 bg-amber-600 active:scale-95 text-white rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <GitMerge size={11} />
              <span>Merge</span>
            </button>
          </div>
        )}
        <MobileLeadDetailView
          lead={lead}
          notesHistory={notesHistory}
          activities={activities}
          availableStaff={availableStaff}
          isAdmin={isAdmin}
          STAGES={STAGES}
          curStageIndex={curStageIndex}
          closingInfo={closingInfo}
          effectivePaymentStatus={effectivePaymentStatus}
          handleStatusChange={handleStatusChange}
          handleUpdatePaymentStatus={handleUpdatePaymentStatus}
          handleCreateNote={handleAddNote}
          handleDeleteRemark={handleDeleteRemark}
          newNote={newNote}
          setNewNote={setNewNote}
          submittingNote={submittingNote}
          onOpenEdit={handleOpenEdit}
          onOpenReminder={() => setShowReminderModal(true)}
          onOpenEmail={handleOpenEmailComposer}
          onOpenInstagram={handleOpenInstagramComposer}
          onCreateGoogleMeet={handleCreateGoogleMeet}
          onDelete={handleDelete}
          onAssignStaff={handleAssignStaff}
          assigningStaff={assigningStaff}
          onUpdateBudget={handleUpdateBudget}
          navigate={navigate}
          sentEmails={sentEmails}
          candidateDocs={candidateDocs}
          onUploadDoc={handleUploadCandidateDoc}
          onDeleteDoc={handleDeleteCandidateDoc}
          onPreviewDoc={(doc) => setSelectedPreviewDoc(doc)}
          emailTo={emailTo}
          setEmailTo={setEmailTo}
          emailSubject={emailSubject}
          setEmailSubject={setEmailSubject}
          emailBody={emailBody}
          setEmailBody={setEmailBody}
          sendingEmail={sendingEmail}
          connectedGoogleEmail={connectedGoogleEmail}
          handleSendCandidateEmail={handleSendCandidateEmail}
          docTypeInput={docTypeInput}
          setDocTypeInput={setDocTypeInput}
          uploadingDoc={uploadingDoc}
        />
      </div>

      {/* Desktop Screen Lead Detail Layout (>= 768px) */}
      <div className="hidden md:block crm-page" id="crmPage">
        <div className="wrap">
        {/* Fixed Top Header Area (stays pinned while only center section scrolls) */}
        <div className="shrink-0 bg-[#f4f5f7] pt-1 pb-2">
          <a className="crumb" onClick={() => navigate('/leads')}>
            ‹ Back to Leads
          </a>

          {/* Duplicate Lead Detection Alert Banner (Desktop) */}
          {duplicateLeads.length > 0 && (
            <div className="mb-3 p-3 bg-amber-500/[0.08] border border-amber-500/25 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-950 truncate">
                    {duplicateLeads.length} Duplicate Candidate Record{duplicateLeads.length > 1 ? 's' : ''} Detected
                  </p>
                  <p className="text-[11px] text-amber-800 truncate">
                    Matching contact ({lead.phoneNumber || lead.email}) found for: {duplicateLeads.map((d) => d.customerName || d.fullName).join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeModal(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-semibold shrink-0 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <GitMerge size={13} />
                <span>Review & Merge</span>
              </button>
            </div>
          )}

          {/* Top Header Card */}
          <section className="card">
            <div className="head">
              <div className="av">
                {(lead.customerName || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="hi">
                <h1>
                  <span>{lead.customerName || 'Candidate'}</span>
                  <span className="tag">
                    {lead.visaType === 'WORK_VISA' ? 'Work Visa' : lead.visaType === 'STUDY_VISA' ? 'Study Visa' : 'Other Visa'}
                  </span>
                </h1>
                <div className="sub">
                  {lead.city || lead.location || 'Location'} · Inquired on {formatIndianDateTime(lead.createdTime || (lead as any).createdAt, { fallback: 'Recent' })}
                </div>
              </div>
              <div className="acts">
                <button
                  type="button"
                  className="btn g"
                  onClick={handleOpenWhatsAppModal}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (lead.phoneNumber) window.location.href = `tel:${lead.phoneNumber}`;
                    else showAlert({ title: 'Call', message: 'No phone number available' });
                  }}
                >
                  Call
                </button>
                <button
                  type="button"
                  className="btn inline-flex items-center gap-1.5"
                  disabled={openingEmail}
                  onClick={handleOpenEmailComposer}
                >
                  <img src="/icons/gmail-classic.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                  <span>{openingEmail ? 'Connecting…' : 'Send Email'}</span>
                </button>
                {Boolean(getInstagramDmRecipientId(lead)) && (
                  <button
                    type="button"
                    className="btn inline-flex items-center gap-1.5"
                    onClick={handleOpenInstagramComposer}
                  >
                    <img src="/icons/instagram.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                    <span>Instagram</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowReminderModal(true)}
                >
                  Reminder
                </button>
                <button
                  type="button"
                  className="btn inline-flex items-center gap-1.5"
                  disabled={creatingMeet}
                  onClick={handleCreateGoogleMeet}
                >
                  <img src="/icons/google-meet.png" alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                  <span>{creatingMeet ? 'Creating Meet…' : 'Google Meet'}</span>
                </button>
                <button
                  type="button"
                  className="btn p"
                  onClick={handleOpenEdit}
                >
                  Edit
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="dates">
              <span>
                Start: <b>{formatIndianDate(lead.createdTime || (lead as any).createdAt, { fallback: '22 Nov 2026' })}</b>
              </span>
              <span>
                Closing: <b>{closingInfo.closingDateDisplay || '24 Jan 2027'}</b>
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
                    onClick={() => handleStatusChange(s.key)}
                    title={`Move stage to ${s.label}`}
                  >
                    {isDone ? '✓ ' : ''}{s.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* 3-Column Grid */}
        <div className="grid">
          {/* Left Aside: Navigation & Related Counts */}
          <aside className="card side">
            <h6>Overview</h6>
            <a
              className={activeSection === 'info' ? 'on' : ''}
              onClick={() => scrollToSection('lead-info', 'info')}
            >
              Lead Information
            </a>
            <a
              className={activeSection === 'payments' ? 'on' : ''}
              onClick={() => scrollToSection('payment-settlement', 'payments')}
            >
              <span>Payments</span>
              <small style={{ color: effectivePaymentStatus === 'PAID' ? 'var(--done)' : effectivePaymentStatus === 'PARTIAL' ? 'var(--warn)' : 'var(--danger)', fontWeight: 600 }}>
                {effectivePaymentStatus === 'PAID' ? 'Paid' : effectivePaymentStatus === 'PARTIAL' ? 'Partially Paid' : 'Not Paid'}
              </small>
            </a>
            <a
              className={activeSection === 'eligibility' ? 'on' : ''}
              onClick={() => scrollToSection('eligibility-responses', 'eligibility')}
            >
              Eligibility
            </a>
            <a
              className={activeSection === 'form' ? 'on' : ''}
              onClick={() => scrollToSection('form-responses', 'form')}
            >
              <span>Form Responses</span>
              <small>{formResponses.length}</small>
            </a>
            <a
              className={activeSection === 'attribution' ? 'on' : ''}
              onClick={() => scrollToSection('ad-attribution', 'attribution')}
            >
              <span>Ad Attribution</span>
              <small>{origin.text}</small>
            </a>

            <h6>Related List</h6>
            <a
              className={activeSection === 'notes' ? 'on' : ''}
              onClick={() => {
                setActiveSection('notes');
                setActiveRelatedView('notes');
              }}
            >
              <span>Notes</span>
              <small>{notesHistory.length}</small>
            </a>
            <a
              className={activeSection === 'activity' ? 'on' : ''}
              onClick={() => {
                setActiveSection('activity');
                setActiveRelatedView('activity');
              }}
            >
              <span>Activity Logs</span>
              <small>{activities.length}</small>
            </a>
            <a
              className={activeSection === 'emails' ? 'on' : ''}
              onClick={handleOpenEmailComposer}
            >
              <span>Emails</span>
              <small>{sentEmails.length}</small>
            </a>
            <a
              className={activeSection === 'documents' ? 'on' : ''}
              onClick={() => {
                setActiveSection('documents');
                setActiveRelatedView('documents');
              }}
            >
              <span>Documents</span>
              <small>{candidateDocs.length}</small>
            </a>
          </aside>

          {/* Center Main: Related List Inline Views or Lead Info Sections */}
          <main ref={mainScrollRef}>
            {activeRelatedView === 'emails' ? (
              <div className="space-y-4">
                <section className="card sec" id="emails-section">
                  <form onSubmit={handleSendCandidateEmail} className="divide-y divide-slate-200">
                    <div className="px-5 py-3 flex items-center gap-4">
                      <span className="w-16 shrink-0 text-[13px] text-slate-400 font-medium">From</span>
                      <span className="text-[13px] font-semibold text-slate-900 truncate">
                        {connectedGoogleEmail || 'Connected Gmail'}
                      </span>
                    </div>

                    <div className="px-5 py-2.5 flex items-center gap-4">
                      <label htmlFor="cand-email-to" className="w-16 shrink-0 text-[13px] text-slate-400 font-medium">
                        To
                      </label>
                      <input
                        id="cand-email-to"
                        type="email"
                        required
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="candidate@example.com"
                        className="flex-1 h-9 px-3 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div className="px-5 py-2.5 flex items-center gap-4">
                      <label htmlFor="cand-email-subject" className="w-16 shrink-0 text-[13px] text-slate-400 font-medium">
                        Subject
                      </label>
                      <input
                        id="cand-email-subject"
                        type="text"
                        required
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject"
                        className="flex-1 h-9 px-3 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div className="p-5">
                      <textarea
                        required
                        rows={8}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Write your message..."
                        className="w-full p-3 text-[13px] text-slate-800 leading-relaxed border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none resize-y bg-white"
                      />
                    </div>

                    <div className="px-5 py-3.5 flex items-center justify-between bg-slate-50/50">
                      <button
                        type="submit"
                        disabled={sendingEmail}
                        className="btn p"
                      >
                        {sendingEmail ? 'Sending…' : 'Send Email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRelatedView(null);
                          setActiveSection('lead-info');
                        }}
                        className="btn"
                      >
                        Discard
                      </button>
                    </div>
                  </form>
                </section>

                {sentEmails.length > 0 && (
                  <section className="card sec">
                    <div className="divide-y divide-slate-100">
                      {sentEmails.map((em) => (
                        <div key={em.id} className="p-4 pl-5 border-l-2 border-blue-600 space-y-1">
                          <div className="flex items-center justify-between text-[12px] text-slate-500">
                            <span className="font-semibold text-slate-800">{em.subject}</span>
                            <span>{formatDate(em.sentAt)}</span>
                          </div>
                          <div className="text-[12px] text-slate-500">To: {em.to}</div>
                          <p className="text-[13px] text-slate-700 whitespace-pre-wrap pt-1">{em.body}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : activeRelatedView === 'notes' ? (
              <section className="card sec" id="inline-notes-section">
                <div className="p-5 border-b border-slate-200 space-y-3">
                  <textarea
                    rows={3}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note…"
                    className="w-full p-3 text-[13px] text-slate-800 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none resize-y bg-white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn p"
                      disabled={!newNote.trim() || submittingNote}
                      onClick={handleAddNote}
                    >
                      {submittingNote ? 'Adding…' : 'Add Note'}
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {notesHistory.length > 0 ? (
                    notesHistory.map((n, i) => (
                      <div key={i} className="pl-3.5 border-l-2 border-blue-600 flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-[12px] text-slate-500">
                            {n.author || 'Counselor'} · {formatDate(n.date)}
                          </div>
                          <p className="text-[13px] text-slate-900 break-words">{n.note}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRemark(i)}
                          title="Delete note"
                          className="text-slate-400 hover:text-rose-600 text-xs px-1 cursor-pointer shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">No notes recorded yet</p>
                  )}
                </div>
              </section>
            ) : activeRelatedView === 'activity' ? (
              <section className="card sec" id="inline-activity-section">
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={activitySearchQuery}
                      onChange={(e) => setActivitySearchQuery(e.target.value)}
                      placeholder="Search activity logs..."
                      className="w-full h-9 !pl-9 pr-8 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
                    />
                    {activitySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setActivitySearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { id: 'ALL', label: 'All Events' },
                      { id: 'STATUS_CHANGE', label: 'Stage Updates' },
                      { id: 'DATA_MODIFY', label: 'Dossier Edits' },
                      { id: 'REMARKS_ADDED', label: 'Counselor Notes' },
                      { id: 'OUTREACH', label: 'Outreach' },
                    ].map((tab) => {
                      const active = activityFilterType === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActivityFilterType(tab.id)}
                          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0066ff] text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {(() => {
                    const filtered = activities.filter((act) => {
                      if (activityFilterType !== 'ALL' && act.actionType !== activityFilterType) return false;
                      if (!activitySearchQuery.trim()) return true;
                      const q = activitySearchQuery.toLowerCase();
                      return (
                        act.userName?.toLowerCase().includes(q) ||
                        act.title?.toLowerCase().includes(q) ||
                        act.description?.toLowerCase().includes(q) ||
                        act.fieldChanged?.toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-8 text-center">
                          No matching activity events found
                        </p>
                      );
                    }

                    return filtered.map((act, idx) => (
                      <div key={act.id || idx} className="pl-3.5 border-l-2 border-blue-600 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="font-semibold text-slate-900">
                            {act.userName || 'System'}
                          </span>
                          <span className="text-slate-500">{formatDate(act.createdAt || act.timestamp)}</span>
                        </div>
                        <div className="text-[13px] font-semibold text-slate-900">{act.title}</div>
                        {act.description && (
                          <div className="text-[13px] text-slate-600">{act.description}</div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </section>
            ) : activeRelatedView === 'documents' ? (
              <section className="card sec" id="inline-documents-section">
                <input
                  ref={docFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUploadCandidateDoc}
                />
                <div className="p-5 border-b border-slate-200 flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="cand-doc-type" className="block text-[12px] font-medium text-slate-500">
                      Document Type
                    </label>
                    <input
                      id="cand-doc-type"
                      type="text"
                      value={docTypeInput}
                      onChange={(e) => setDocTypeInput(e.target.value)}
                      placeholder="Passport / ID"
                      className="h-9 w-56 px-3 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={uploadingDoc}
                    onClick={() => docFileInputRef.current?.click()}
                    className="btn p inline-flex items-center gap-1.5"
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
                  <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-center">
                    <DotsLoader size="sm" label="Uploading document..." />
                  </div>
                )}

                {candidateDocs.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-1.5">
                    <h4 className="text-[14px] font-semibold text-slate-900">No Documents Uploaded</h4>
                    <p className="text-[13px] text-slate-500 max-w-md mx-auto">
                      Upload passports, resumes, academic transcripts, or visa documents for this candidate.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {candidateDocs.map((doc) => (
                      <div key={doc.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-slate-900 truncate">{doc.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {doc.docType} · {formatDate(doc.uploadedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewDoc(doc)}
                            className="btn inline-flex items-center gap-1 cursor-pointer"
                            title="Preview document securely inside application"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidateDoc(doc.id)}
                            className="btn text-rose-600 cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
            {/* Section 1: Lead Information */}
            <section className="card sec" id="lead-info">
              <h3>
                <span>Lead Information</span>
                <button type="button" onClick={handleOpenEdit}>
                  Edit
                </button>
              </h3>
              <div className="fields">
                <div className="f">
                  <label>Lead Name</label>
                  <span>{lead.customerName || '—'}</span>
                </div>
                <div className="f">
                  <label>Phone</label>
                  <span>
                    {lead.phoneNumber || '—'}{' '}
                    {lead.phoneNumber && (
                      <>
                        · <button type="button" onClick={handleCopyPhone}>{copiedPhone ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </span>
                </div>
                <div className="f">
                  <label>Email</label>
                  <span>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`}>{lead.email}</a>
                    ) : (
                      <span className="em">Not provided</span>
                    )}
                  </span>
                </div>
                <div className="f">
                  <label>City / Location</label>
                  <span>{lead.city || lead.location || '—'}</span>
                </div>
                <div className="f">
                  <label>Lead Owner</label>
                  <select
                    value={lead.assignedTo || ''}
                    onChange={(e) => handleAssignStaff(e.target.value)}
                    disabled={assigningStaff || !isAdmin}
                  >
                    <option value="">Unassigned (General Pool)</option>
                    {availableStaff.map((staff) => (
                      <option key={staff.login} value={staff.login}>
                        {staff.name || staff.login}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="f">
                  <label>Visa Type</label>
                  <span>
                    {lead.visaType === 'WORK_VISA'
                      ? 'Work Visa'
                      : lead.visaType === 'STUDY_VISA'
                      ? 'Study Visa'
                      : 'Other Visa'}
                  </span>
                </div>
                <div className="f">
                  <label>Client Budget</label>
                  <span>
                    {lead.budgetRange && !isAcademicScore(lead.budgetRange) ? (
                      formatCurrencyDisplay(lead.budgetRange) || lead.budgetRange
                    ) : (
                      <span className="em">Not specified</span>
                    )}
                  </span>
                </div>
                <div className="f">
                  <label>Payment Status</label>
                  <span
                    style={{
                      color:
                        effectivePaymentStatus === 'PAID'
                          ? 'var(--done)'
                          : effectivePaymentStatus === 'PARTIAL'
                          ? 'var(--warn)'
                          : 'var(--danger)',
                    }}
                  >
                    {effectivePaymentStatus === 'PAID'
                      ? 'Fully Paid'
                      : effectivePaymentStatus === 'PARTIAL'
                      ? 'Partially Paid'
                      : 'Not Paid'}
                  </span>
                </div>
                <div className="f">
                  <label>Lead Source</label>
                  <span>{plat.label || lead.platform || 'Meta Lead Ads'}</span>
                </div>
                <div className="f">
                  <label>Campaign</label>
                  <span>{getLeadSourceLabel(lead).text}</span>
                </div>
              </div>
            </section>

            {/* Section 2: Payment Settlement */}
            <section className="card sec" id="payment-settlement">
              <h3>
                <span>Payment Settlement</span>
                <button
                  type="button"
                  onClick={() => setIsEditingPaymentDetails((prev) => !prev)}
                >
                  {isEditingPaymentDetails ? 'Close Remarks' : 'Edit Remarks'}
                </button>
              </h3>
              <div className="pay">
                <div className="seg">
                  <button
                    type="button"
                    className={effectivePaymentStatus === 'UNPAID' ? 'on np' : ''}
                    onClick={() => handleUpdatePaymentStatus('UNPAID')}
                  >
                    Not Paid
                  </button>
                  <button
                    type="button"
                    className={effectivePaymentStatus === 'PARTIAL' ? 'on pp' : ''}
                    onClick={() => handleUpdatePaymentStatus('PARTIAL')}
                  >
                    Partially Paid
                  </button>
                  <button
                    type="button"
                    className={effectivePaymentStatus === 'PAID' ? 'on fp' : ''}
                    onClick={() => handleUpdatePaymentStatus('PAID')}
                  >
                    Fully Paid
                  </button>
                </div>

                <div className="amt">
                  <div>
                    <div className="sub">Client Budget</div>
                    {isEditingBudget ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          placeholder="e.g. ₹5,00,000"
                          className="border border-slate-300 rounded px-2 py-1 text-sm font-bold w-40"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn p text-xs py-1 px-2.5"
                          onClick={() => handleUpdateBudget(budgetInput)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn text-xs py-1 px-2"
                          onClick={() => {
                            setBudgetInput(lead.budgetRange && !isAcademicScore(lead.budgetRange) ? lead.budgetRange : '');
                            setIsEditingBudget(false);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <b>
                        {lead.budgetRange && !isAcademicScore(lead.budgetRange)
                          ? (formatCurrencyDisplay(lead.budgetRange) || lead.budgetRange)
                          : 'Not Specified'}
                      </b>
                    )}
                  </div>
                  {!isEditingBudget && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setIsEditingBudget(true)}
                    >
                      {lead.budgetRange && !isAcademicScore(lead.budgetRange) ? 'Change Budget' : '+ Set Budget'}
                    </button>
                  )}
                </div>

                {isEditingPaymentDetails ? (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <textarea
                      value={paymentDetailsInput}
                      onChange={(e) => setPaymentDetailsInput(e.target.value)}
                      placeholder="Advance, payment schedule, or receipt remarks..."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        className="btn p text-xs"
                        onClick={() => handleUpdatePaymentDetails(paymentDetailsInput)}
                      >
                        Save Remarks
                      </button>
                      <button
                        type="button"
                        className="btn text-xs"
                        onClick={() => setIsEditingPaymentDetails(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (lead as any).paymentDetails ? (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900 block mb-0.5">Payment Remarks:</span>
                    {(lead as any).paymentDetails}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Section 3: Eligibility & Survey Responses */}
            <section className="card sec" id="eligibility-responses">
              <h3>
                <span>Eligibility &amp; Survey Responses</span>
                <span className="tag">Candidate Profile</span>
              </h3>
              <div className="fields">
                <div className="f">
                  <label>Qualification</label>
                  <span>{lead.educationalQualification || <span className="em">Not specified</span>}</span>
                </div>
                <div className="f">
                  <label>Age Bracket</label>
                  <span>{lead.age || <span className="em">Not specified</span>}</span>
                </div>
                <div className="f">
                  <label>Working Status</label>
                  <span className="capitalize">{lead.areYouWorking || <span className="em">Not specified</span>}</span>
                </div>
                <div className="f">
                  <label>Score / CGPA</label>
                  <span>{formatAcademicScore((lead as any).studentPercentage || (lead as any).cgpa) || <span className="em">Not specified</span>}</span>
                </div>
                <div className="f">
                  <label>Confirmation</label>
                  <span>{lead.leadConfirm || <span className="em">Confirmed</span>}</span>
                </div>
                <div className="f">
                  <label>Interested</label>
                  <span className="capitalize">{lead.areYouInterested || <span className="em">Yes</span>}</span>
                </div>
              </div>
            </section>

            {/* Section 4: Lead Form Responses (every answer from the Meta Instant Form / export) */}
            <section className="card sec" id="form-responses">
              <h3>
                <span>Lead Form Responses</span>
                <span className="tag">
                  {formResponses.length} answer{formResponses.length === 1 ? '' : 's'}
                </span>
              </h3>
              {formResponses.length === 0 ? (
                <p className="text-xs text-slate-400 px-5 py-3 leading-relaxed">
                  No form answers were captured for this lead. Leads saved before form capture was added, and leads
                  created by hand, don't have them.
                </p>
              ) : (
                <dl className="divide-y divide-slate-100 px-5 py-1">
                  {formResponses.map((r, i) => (
                    <div key={`${r.key}-${i}`} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6">
                      <dt className="text-xs sm:text-[13px] text-slate-600 leading-snug flex-1">
                        {r.label}
                      </dt>
                      <dd className="shrink-0 text-left sm:text-right">
                        <span className="text-[13px] font-semibold text-slate-900 break-words" title={r.value}>
                          {humanizeAnswer(r.value)}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {/* Section 5: Ad Attribution (campaign → ad set → ad → form → page) */}
            <section className="card sec" id="ad-attribution">
              <h3>
                <span>Ad Attribution</span>
                <span
                  className="tag"
                  title={
                    origin.tone === 'organic'
                      ? 'Meta reported this lead as organic (not from a paid ad).'
                      : origin.tone === 'paid'
                        ? 'This lead came from a paid ad.'
                        : 'Meta did not report whether this lead was organic or paid.'
                  }
                >
                  {origin.text}
                </span>
              </h3>
              <div className="fields" style={{ gridTemplateColumns: '1fr', padding: '10px 20px 14px' }}>
                {attributionRows.map((row) => (
                  <div key={row.label} className="f" style={{ gridTemplateColumns: '170px 1fr', alignItems: 'flex-start' }}>
                    <label style={{ paddingTop: '2px' }}>{row.label}</label>
                    <div className="min-w-0">
                      <span
                        className={`block select-text ${row.idIsValue ? 'font-mono text-[12px] text-slate-800' : 'text-[13px] font-semibold text-slate-900'}`}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                      >
                        {row.value}
                      </span>
                      {row.metaId && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {!row.idIsValue && <span className="font-mono text-[11px] text-slate-400">ID {row.metaId}</span>}
                          <button
                            type="button"
                            onClick={() => copyMetaId(row.metaId!)}
                            className="text-[11px] font-semibold text-[#007aff] hover:underline cursor-pointer"
                          >
                            {copiedMetaId === row.metaId ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="f" style={{ gridTemplateColumns: '170px 1fr' }}>
                  <label>Submitted</label>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    {formatDate(lead.createdTime || (lead as any).createdAt)}
                  </span>
                </div>
              </div>
            </section>
              </>
            )}
          </main>

          {/* Right Aside: Notes & WhatsApp Shortcuts */}
          <aside>
            {/* Notes Section */}
            <section className="card sec" id="notes-section">
              <h3>Notes</h3>
              <div className="note-in">
                <textarea
                  id="nt"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                />
                <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn p"
                    id="add"
                    disabled={!newNote.trim() || submittingNote}
                    onClick={handleAddNote}
                  >
                    {submittingNote ? 'Adding…' : 'Add Note'}
                  </button>
                </div>
              </div>
              <div className="nl" id="nl">
                {notesHistory.length > 0 ? (
                  notesHistory.map((n, i) => (
                    <div key={i} className="n">
                      <div>
                        <span>{n.author || 'Counselor'} · {formatDate(n.date)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRemark(i)}
                          title="Delete remark"
                        >
                          ✕
                        </button>
                      </div>
                      <p>{n.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-3 text-center">No notes recorded yet</p>
                )}
              </div>
            </section>

            {/* WhatsApp Shortcuts */}
            <section className="card sec">
              <h3>WhatsApp Shortcuts</h3>
              <div className="wa">
                <button
                  type="button"
                  onClick={() =>
                    openWhatsAppWithText(
                      `Hello ${lead.customerName || 'Candidate'}, greetings from our Overseas Visa Consultancy! We received your inquiry regarding our international ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'
                      } programs. Are you available for a brief discussion regarding eligibility and visa requirements?`
                    )
                  }
                >
                  Intro &amp; greeting
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openWhatsAppWithText(
                      `Dear ${lead.customerName || 'Candidate'}, following our counseling discussion regarding your ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'
                      } application, please share your updated resume/CV, highest educational certificates, and passport copy so our team can evaluate your profile.`
                    )
                  }
                >
                  Request documents
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openWhatsAppWithText(
                      `Hello ${lead.customerName || 'Candidate'}, this is a gentle reminder regarding the processing fee and enrollment advance for your ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : 'Study Visa'
                      } application. Please let us know once transferred so we can proceed with your dossier.`
                    )
                  }
                >
                  Payment reminder
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
      </div>
      {/* Edit Candidate Details Modal (Apple HIG Glass Sheet UI) */}
      {showEditModal && (
        <div className="ios-modal-backdrop animate-in fade-in duration-200">
          <div className="ios-material-thick rounded-3xl shadow-2xl border border-black/[0.08] max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            <div className="pt-3 pb-1">
              <div className="ios-sheet-grabber" />
            </div>
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                  Edit Candidate Details
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  Update candidate contact and inquiry information
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full bg-black/[0.05] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.1] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Full Name <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.customerName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editFormData.phoneNumber || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* City / Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  City / Location
                </label>
                <input
                  type="text"
                  value={editFormData.city || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Visa Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Visa Type
                </label>
                <select
                  value={editFormData.visaType || 'WORK_VISA'}
                  onChange={(e) => setEditFormData({ ...editFormData, visaType: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:bg-slate-50 hover:border-slate-400 border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium cursor-pointer"
                >
                  <option value="WORK_VISA">Work Visa</option>
                  <option value="STUDY_VISA">Study Visa</option>
                  <option value="OTHER_VISA">Other Visa</option>
                </select>
              </div>

              {/* Student Percentage / CGPA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Student Percentage / CGPA
                  </label>
                  <span className="text-[11px] text-slate-400">Academic Marks / Score</span>
                </div>
                <input
                  type="text"
                  value={editFormData.studentPercentage || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      studentPercentage: e.target.value,
                      cgpa: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Target Closing Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Target Closing Date
                  </label>
                  <span className="text-[11px] text-slate-400">Visa Conversion Deadline</span>
                </div>
                <input
                  type="date"
                  value={editFormData.closingDate || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, closingDate: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium cursor-pointer"
                />
              </div>

              {/* Client Budget */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Client Budget
                  </label>
                  <span className="text-[11px] text-slate-400">Candidate Financial Capacity</span>
                </div>
                <input
                  type="text"
                  value={isAcademicScore(editFormData.budgetRange) ? '' : (editFormData.budgetRange || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, budgetRange: e.target.value })}
                  placeholder="e.g. ₹5,00,000"
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Payment Settlement Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Payment Settlement Status
                </label>
                <select
                  value={editFormData.paymentStatus || 'UNPAID'}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white hover:bg-slate-50 hover:border-slate-400 border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium cursor-pointer"
                >
                  <option value="UNPAID">Not Paid / Unpaid</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </div>

              {/* Payment Details & Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Payment Details & Receipt Notes
                </label>
                <input
                  type="text"
                  value={editFormData.paymentDetails || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentDetails: e.target.value })}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Notes
                </label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white hover:border-slate-400 focus:bg-white border border-slate-300 rounded-md text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-white hover:bg-black/[0.03] text-[#1c1c1e] rounded-xl text-xs font-medium border border-black/[0.08] shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-[#007aff] hover:bg-[#0071e3] text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Message Modal — Simple Form Style */}
      {showWhatsAppTemplateModal && lead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div
            className="bg-white border border-slate-200 rounded shadow-lg w-full max-w-lg"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <img src="/icons/whatsapp.png" alt="WhatsApp" className="w-4 h-4 object-contain" />
                <h3 className="text-sm font-semibold text-slate-900">Send WhatsApp Message</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >×</button>
            </div>

            <div className="p-4 space-y-3">
              {/* To row */}
              <div className="flex items-center border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">To</span>
                <span className="text-xs text-slate-800 font-medium">
                  {cleanCandidateName(lead.customerName || lead.fullName)} • {lead.phoneNumber || 'No phone'}
                </span>
              </div>

              {/* Quick Templates */}
              <div>
                <span className="text-xs text-slate-500 block mb-1.5">Quick Templates</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'Initial Consultation',
                      text: `Hello ${cleanCandidateName(lead.customerName || lead.fullName)}, greetings from SSA SalesHub! We received your inquiry regarding our international ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : lead.visaType === 'STUDY_VISA' ? 'Study Visa' : 'visa'
                      } programs. Are you available for a brief discussion regarding eligibility and visa requirements?`,
                    },
                    {
                      label: 'Doc Request',
                      text: `Dear ${cleanCandidateName(lead.customerName || lead.fullName)}, following our counseling discussion regarding your ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : lead.visaType === 'STUDY_VISA' ? 'Study Visa' : 'visa'
                      } application, please share your updated resume/CV, highest educational certificates, and passport copy so our team can evaluate your profile.`,
                    },
                    {
                      label: 'Follow-up Call',
                      text: `Hi ${cleanCandidateName(lead.customerName || lead.fullName)}, this is from SSA SalesHub following up on your consultation. Please let us know when is a convenient time to speak.`,
                    },
                    {
                      label: 'Fee Confirmation',
                      text: `Hello ${cleanCandidateName(lead.customerName || lead.fullName)}, this is a gentle reminder regarding the processing fee and enrollment advance for your ${
                        lead.visaType === 'WORK_VISA' ? 'Work Visa' : lead.visaType === 'STUDY_VISA' ? 'Study Visa' : 'visa'
                      } application. Please let us know once transferred so we can proceed with your dossier.`,
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setCustomWhatsAppMsg(tpl.text)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-medium">Message Text <span className="text-red-500">*</span></label>
                  <span className="text-[11px] text-slate-400">{customWhatsAppMsg.length} characters</span>
                </div>
                <textarea
                  value={customWhatsAppMsg}
                  onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                  rows={5}
                  placeholder="Type your WhatsApp message..."
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 resize-none focus:outline-none focus:border-slate-400"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Dispatches via WhatsApp Web / App</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppTemplateModal(false)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >Cancel</button>
                  <button
                    type="button"
                    onClick={() => openWhatsAppWithText(customWhatsAppMsg)}
                    disabled={!customWhatsAppMsg.trim()}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={12} />
                    Open WhatsApp & Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apple HIG Merge Duplicate Candidates Modal */}
      {showMergeModal && lead && duplicateLeads.length > 0 && (() => {
        const activeDup = duplicateLeads.find((d) => String(d.id) === String(selectedMergeDupId)) || duplicateLeads[0];
        return (
          <div className="ios-modal-backdrop animate-in fade-in duration-200">
            <div
              className="w-full max-w-2xl ios-material-thick rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-black/[0.08] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
              role="dialog"
              aria-modal="true"
            >
              {/* Grabber handle */}
              <div className="pt-3 pb-1">
                <div className="ios-sheet-grabber" />
              </div>

              {/* Modal Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                    <GitMerge size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#1c1c1e] leading-tight tracking-tight">
                      Merge Duplicate Candidates
                    </h3>
                    <p className="text-[12px] text-[#8e8e93] mt-0.5">
                      Consolidate candidate records sharing contact ({lead.phoneNumber || lead.email})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="w-8 h-8 rounded-full bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close dialog"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Duplicate Switcher if multiple duplicates */}
                {duplicateLeads.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1c1c1e]">
                      Select Duplicate Record to Merge:
                    </label>
                    <select
                      value={selectedMergeDupId || activeDup.id}
                      onChange={(e) => setSelectedMergeDupId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    >
                      {duplicateLeads.map((dup) => (
                        <option key={dup.id} value={dup.id}>
                          #{dup.id} - {dup.customerName || dup.fullName} ({dup.phoneNumber || dup.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Primary Record (Will Be Kept) */}
                  <div className="p-4 rounded-2xl bg-white border-2 border-[#007aff]/30 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                      <span className="font-bold text-[#007aff] uppercase tracking-wider text-[10px]">
                        Primary Record (Keep)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#007aff]/10 text-[#007aff] font-semibold text-[10px]">
                        Lead #{lead.id}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#8e8e93] block">Candidate Name</span>
                      <p className="font-semibold text-[#1c1c1e] text-[13px]">{lead.customerName || lead.fullName || 'Candidate'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-[#8e8e93] block">Phone</span>
                        <p className="font-medium text-[#1c1c1e]">{lead.phoneNumber || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[#8e8e93] block">Email</span>
                        <p className="font-medium text-[#1c1c1e] truncate">{lead.email || '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-[#8e8e93] block">Program</span>
                        <p className="font-medium text-[#1c1c1e]">{lead.visaType || 'Work Visa'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[#8e8e93] block">Status</span>
                        <p className="font-medium text-[#1c1c1e]">{lead.status || 'Created'}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#8e8e93] block">Notes & Remarks</span>
                      <p className="text-[11px] text-[#515154] line-clamp-3 bg-black/[0.02] p-2 rounded-lg mt-0.5">
                        {lead.notes || 'No notes on primary record'}
                      </p>
                    </div>
                  </div>

                  {/* Duplicate Record (Will Be Merged & Removed) */}
                  <div className="p-4 rounded-2xl bg-[#fff9f2] border border-amber-300 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                      <span className="font-bold text-amber-700 uppercase tracking-wider text-[10px]">
                        Duplicate Record (To Merge)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">
                        Lead #{activeDup.id}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-amber-700 block">Candidate Name</span>
                      <p className="font-semibold text-amber-950 text-[13px]">{activeDup.customerName || activeDup.fullName || 'Candidate'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-amber-700 block">Phone</span>
                        <p className="font-medium text-amber-950">{activeDup.phoneNumber || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-amber-700 block">Email</span>
                        <p className="font-medium text-amber-950 truncate">{activeDup.email || '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-amber-700 block">Program</span>
                        <p className="font-medium text-amber-950">{activeDup.visaType || 'Work Visa'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-amber-700 block">Status</span>
                        <p className="font-medium text-amber-950">{activeDup.status || 'Created'}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-amber-700 block">Notes & Remarks</span>
                      <p className="text-[11px] text-amber-900 line-clamp-3 bg-amber-100/50 p-2 rounded-lg mt-0.5">
                        {activeDup.notes || 'No notes on duplicate record'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Merge Action Plan Summary */}
                <div className="p-3 bg-black/[0.03] rounded-2xl space-y-1.5 text-xs text-[#515154]">
                  <p className="font-semibold text-[#1c1c1e] text-[12px]">What will happen when you merge:</p>
                  <ul className="space-y-1 text-[11px] list-disc list-inside">
                    <li>All counselor remarks & notes from Duplicate #{activeDup.id} will be appended into this profile.</li>
                    <li>Any missing contact details (email or city) will be carried over to this record.</li>
                    <li>A merge audit log will be written to this candidate's activity history.</li>
                    <li>The duplicate record #{activeDup.id} will be safely deleted to avoid duplicate counts.</li>
                  </ul>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={mergingLead}
                    onClick={() => handleMergeDuplicate(activeDup)}
                    className="w-full py-3 bg-[#007aff] hover:bg-[#0062cc] active:scale-[0.99] text-white font-semibold rounded-2xl text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <GitMerge size={15} />
                    <span>{mergingLead ? 'Merging Records...' : `Confirm & Merge Lead #${activeDup.id} into Primary`}</span>
                  </button>
                </div>

                {/* Footer Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] text-xs text-[#8e8e93]">
                  <span>Action cannot be undone</span>
                  <button
                    type="button"
                    onClick={() => setShowMergeModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-black/[0.06] hover:bg-black/[0.1] text-xs font-semibold text-[#1c1c1e] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Instagram DM Modal — Legacy CRM Style */}
      {showInstagramModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div
            className="bg-white border border-slate-200 rounded shadow-lg w-full max-w-md"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <img src="/icons/instagram.png" alt="Instagram" className="w-4 h-4 object-contain" />
                <h3 className="text-sm font-semibold text-slate-900">Instagram Direct Message</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstagramModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
                title="Close"
              >×</button>
            </div>

            <form onSubmit={handleSendInstagramDm} className="p-4 space-y-3">
              {/* Candidate context */}
              <p className="text-xs text-slate-500">
                Sending to: <strong className="text-slate-800">{lead?.customerName || lead?.fullName || 'Candidate'}</strong>
                {lead?.platform && (
                  <span className="ml-2 text-slate-400">• Source: {lead.platform}</span>
                )}
              </p>

              {/* IG User ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IG User ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={igRecipientId}
                  onChange={(e) => setIgRecipientId(e.target.value)}
                  placeholder="Instagram-scoped user ID"
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-blue-500"
                />

              </div>

              {/* Quick templates */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quick Templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Intro', text: `Hi ${lead?.customerName || 'there'}, thanks for reaching out to SSA SalesHub! How can we assist you today?` },
                    { label: 'Free Consult', text: `Hi ${lead?.customerName || 'there'}, we'd love to offer you a free counseling session for your visa options. When are you free?` },
                    { label: 'Doc Follow-up', text: `Hi ${lead?.customerName || 'there'}, following up on your application. Let us know if you need help with your documents.` },
                  ].map((p, i) => (
                    <button key={i} type="button"
                      onClick={() => setIgMessage(p.text)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={igMessage}
                  onChange={(e) => setIgMessage(e.target.value)}
                  placeholder="Write your Instagram direct message..."
                  className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInstagramModal(false)}
                  className="px-4 py-1.5 text-xs border border-slate-300 rounded text-slate-700 hover:bg-slate-50 cursor-pointer"
                >Cancel</button>
                <button
                  type="submit"
                  disabled={sendingIg || !igRecipientId.trim() || !igMessage.trim()}
                  className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white rounded font-medium disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <img src="/icons/instagram.png" alt="" className="w-3 h-3 object-contain brightness-0 invert" />
                  {sendingIg ? 'Sending...' : 'Send DM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Candidate Reminders Modal */}
      {lead && (
        <LeadReminderModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          candidateId={resolvedLeadId || lead.id}
          candidateName={lead.customerName || lead.fullName || 'Candidate'}
          assignedStaff={lead.assignedTo || (currentUser as any)?.login}
          onReminderSaved={() => {
            const targetId = resolvedLeadId || lead.id;
            notificationApiService.getEventsForCandidate(targetId)
              .then(setLeadReminders)
              .catch(() => { });
            leadActivityService.getActivities(targetId).then(setActivities).catch(() => { });
          }}
        />
      )}

      {/* Schedule & Confirm Google Meet Modal (Apple HIG Frosted Sheet UI) */}
      {showMeetScheduleModal && lead && (
        <div className="ios-modal-backdrop animate-in fade-in duration-200">
          <div
            className="w-full max-w-xl max-h-[92vh] ios-material-thick rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-black/[0.08] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Apple iOS Frosted Header */}
            <div className="px-6 pt-3 pb-4 border-b border-black/[0.06] bg-white flex flex-col sticky top-0 z-10">
              <div className="ios-sheet-grabber mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black/[0.04] text-[#1c1c1e] flex items-center justify-center shadow-xs">
                    <img src="/icons/google-meet.png" alt="Google Meet" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                      Schedule Google Meet
                    </h2>
                    <p className="text-xs text-[#8e8e93] font-medium mt-0.5">
                      {lead.customerName || lead.fullName || 'Candidate'} • Ref {formatMaskedLeadRef(lead.id)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMeetScheduleModal(false)}
                  className="w-8 h-8 rounded-full bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#8e8e93] hover:text-[#1c1c1e] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Segmented Top Bar */}
            <div className="px-6 pt-3 pb-2 bg-[#f8f9fa] border-b border-black/[0.05] flex items-center justify-between gap-3">
              <div className="inline-flex p-1 bg-black/[0.05] rounded-xl">
                <div className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#1c1c1e] shadow-xs">
                  + Schedule Meet
                </div>
              </div>

              <span className="text-[11px] text-[#8e8e93] font-medium hidden sm:inline">
                In-App + Automated Link Dispatch
              </span>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#ff9500]" />
                  <span>Quick Presets</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'Follow-up Call',
                      title: `Follow-up call with ${lead.customerName || lead.fullName || 'Candidate'}`,
                      duration: 30,
                      icon: <PhoneCall size={13} />,
                    },
                    {
                      label: 'Doc Verification',
                      title: `Verify academic & visa docs for ${lead.customerName || lead.fullName || 'Candidate'}`,
                      duration: 30,
                      icon: <FileCheck size={13} />,
                    },
                    {
                      label: 'Counseling Session',
                      title: `Admission counseling session with ${lead.customerName || lead.fullName || 'Candidate'}`,
                      duration: 45,
                      icon: <GraduationCap size={13} />,
                    },
                    {
                      label: 'Fee Confirmation',
                      title: `Confirm visa processing fee receipt for ${lead.customerName || lead.fullName || 'Candidate'}`,
                      duration: 30,
                      icon: <CreditCard size={13} />,
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMeetTitle(preset.title);
                        setMeetDuration(preset.duration);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer"
                    >
                      {preset.icon}
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Meeting Title / Task <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="text"
                  value={meetTitle}
                  onChange={(e) => setMeetTitle(e.target.value)}
                  required
                  placeholder={`Consultation - ${lead.customerName || lead.fullName || 'Candidate'}`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-800 shadow-2xs transition-all"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date Picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#007aff]" />
                      <span>Date</span>
                    </label>
                    {/* Quick Date Pills */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          setMeetDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          setMeetDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 2);
                          setMeetDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        +2d
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={meetDate}
                    onChange={(e) => setMeetDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-800 shadow-2xs transition-all"
                  />
                </div>

                {/* Time Picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                      <Clock size={13} className="text-[#007aff]" />
                      <span>Time</span>
                    </label>
                    {/* Quick Time Pills */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setMeetTime('10:00')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        10 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetTime('14:30')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        2:30 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetTime('17:00')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        5 PM
                      </button>
                    </div>
                  </div>
                  <TimePicker12Hour
                    value={meetTime}
                    onChange={setMeetTime}
                    className="bg-white border-black/[0.1] px-3.5 py-1.5 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Live Remaining Time Preview */}
              {(() => {
                const liveRem = getMeetRemainingTime(meetDate, meetTime);
                if (!liveRem) return null;
                return (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-medium transition-all ${
                      liveRem.isPast
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-900'
                        : 'bg-[#007aff]/[0.08] border-[#007aff]/20 text-[#007aff]'
                    }`}
                  >
                    <Clock size={13} className="shrink-0" />
                    <span>{liveRem.text}</span>
                  </div>
                );
              })()}

              {/* Duration & Dispatch Channels Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Meeting Duration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Meeting Duration
                  </label>
                  <select
                    value={meetDuration}
                    onChange={(e) => setMeetDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes (Standard)</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hour)</option>
                  </select>
                </div>

                {/* Dispatch Channels */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Auto-Dispatch Link To
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <label
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        meetSendWhatsApp
                          ? 'bg-[#25D366]/10 border-[#25D366]/40 text-[#128C7E]'
                          : 'bg-black/[0.02] border-black/[0.08] text-[#8e8e93] hover:bg-black/[0.04]'
                      } ${!lead.phoneNumber ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={meetSendWhatsApp}
                        disabled={!lead.phoneNumber}
                        onChange={(e) => setMeetSendWhatsApp(e.target.checked)}
                        className="hidden"
                      />
                      <span>WhatsApp</span>
                    </label>
                    <label
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        meetSendEmail
                          ? 'bg-[#ea4335]/10 border-[#ea4335]/40 text-[#c5221f]'
                          : 'bg-black/[0.02] border-black/[0.08] text-[#8e8e93] hover:bg-black/[0.04]'
                      } ${!lead.email ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={meetSendEmail}
                        disabled={!lead.email}
                        onChange={(e) => setMeetSendEmail(e.target.checked)}
                        className="hidden"
                      />
                      <span>Email</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Counselor Notes / Agenda */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Counselor Notes / Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  value={meetCustomNotes}
                  onChange={(e) => setMeetCustomNotes(e.target.value)}
                  placeholder="Add meeting agenda or notes..."
                  className="w-full px-3.5 py-2 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all resize-none"
                />
              </div>

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={schedulingMeet || !meetTitle.trim() || (!meetSendWhatsApp && !meetSendEmail && !lead.phoneNumber && !lead.email)}
                  onClick={handleConfirmAndSendMeet}
                  className="w-full py-3 bg-[#007aff] hover:bg-[#0062cc] active:scale-[0.99] text-white font-semibold rounded-2xl text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {schedulingMeet ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <img src="/icons/google-meet.png" alt="" className="w-4 h-4 object-contain brightness-0 invert" />
                  )}
                  <span>{schedulingMeet ? 'Scheduling & Dispatching Link...' : 'Schedule & Send Link'}</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs text-[#8e8e93]">
              <span className="text-[11px]">
                {meetSendWhatsApp && lead.phoneNumber
                  ? `WhatsApp to ${lead.phoneNumber}`
                  : meetSendEmail && lead.email
                  ? `Email to ${lead.email}`
                  : 'Manual dispatch'}
              </span>
              <button
                type="button"
                onClick={() => setShowMeetScheduleModal(false)}
                className="px-5 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] font-semibold rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure In-App Document Preview Modal */}
      {selectedPreviewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#f8f9fa] px-5 py-3.5 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <FileText size={17} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {selectedPreviewDoc.name}
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    {selectedPreviewDoc.docType} · Uploaded {formatDate(selectedPreviewDoc.uploadedAt)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedPreviewDoc.url}
                  download={selectedPreviewDoc.name}
                  className="h-8 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Download copy"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewDoc(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* In-App Document Viewer Body */}
            <div className="h-[70vh] w-full bg-slate-100 flex items-center justify-center overflow-auto p-4">
              {/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(selectedPreviewDoc.name || selectedPreviewDoc.url) ? (
                <img
                  src={selectedPreviewDoc.url}
                  alt={selectedPreviewDoc.name}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm bg-white"
                />
              ) : (
                <iframe
                  src={selectedPreviewDoc.url}
                  title={selectedPreviewDoc.name}
                  className="w-full h-full border-0 rounded-lg bg-white shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
