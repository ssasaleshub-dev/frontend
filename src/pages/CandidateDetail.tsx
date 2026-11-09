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
  UserCheck,
  Send,
  Copy,
  Check,
  X,
  RefreshCw,
  Globe,
  ShieldCheck,
  FileText,
  Clock,
  CreditCard,
  Wallet,
  Award,
} from 'lucide-react';
import {
  BrandActivityIcon,
  BrandAttributionIcon,
  BrandWonIcon,
  BrandLostIcon,
  BrandReminderIcon,
} from '../components/icons/BrandIcons';
import axiosClient from '../services/api/axiosClient';
import crmService from '../services/api/crmService';
import adminService from '../services/api/adminService';
import leadActivityService from '../services/api/leadActivityService';
import notificationApiService, { CalendarEventDTO } from '../services/api/notificationService';
import CandidateActivityLogsModal from '../components/CandidateActivityLogsModal';
import LeadReminderModal from '../components/LeadReminderModal';
import { useAlert } from '../context/AlertContext';
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
import { formatIndianDateTime, formatIndianDate } from '../utils/dateTimeUtils';
import { Lead, LeadActivity } from '../types';
import { encryptLeadId, decryptLeadId, formatMaskedLeadRef } from '../utils/leadIdCrypto';

export default function CandidateDetail() {
  const { id: rawParamId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showAlert } = useAlert();

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
  const [notesHistory, setNotesHistory] = useState<Array<{ note: string; date: string; author: string }>>([]);

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
    setIsServerDown(false);

    // Fetch activities & candidate reminders in parallel
    leadActivityService.getActivities(targetId).then(setActivities).catch(() => {});
    notificationApiService.getEvents({ candidateId: targetId as any })
      .then((evts) => {
        if (Array.isArray(evts)) setLeadReminders(evts);
      })
      .catch(() => {});
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
          throw new Error(`Candidate #${formatMaskedLeadRef(targetId)} could not be found.`);
        }
      }

      if (candidateData) {
        // Enforce role-based access for non-admin counselors
        if (!isAdmin && filterLeadsByUserRole([candidateData], currentUser).length === 0) {
          throw new Error(`Access restricted: Candidate belongs to a different visa desk outside your assigned scope.`);
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

        // Extract student percentage from notes if available (e.g. "CGPA: RNR" or "CGPA: 75%")
        let extractedPercentage = '';
        if (candidateData.notes) {
          const m = candidateData.notes.match(/(?:what_is_your_cgpa_or_current_percentage|cgpa|percentage|score|marks)\s*[:=?]\s*([^|\n,;]+)/i);
          if (m && m[1]) {
            extractedPercentage = m[1].trim();
          }
        }

        const effectiveBudget = candidateData.budgetRange || (candidateData as any).budget || (candidateData as any).clientBudget || cachedBudget || '';
        const effectivePaymentStatus = (candidateData as any).paymentStatus || candidateData.mattressType || cachedPaymentStatus || 'UNPAID';
        const effectivePaymentDetails = (candidateData as any).paymentDetails || candidateData.mattressSize || cachedPaymentDetails || '';
        const effectivePercentage = (candidateData as any).studentPercentage || (candidateData as any).cgpa || cachedPercentage || extractedPercentage || '';

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
      const serverDown = Boolean(
        err?.isServerDown ||
        (err?.status && err.status >= 500) ||
        (err?.message && err.message.toLowerCase().includes('server is down')) ||
        (err?.message && err.message.toLowerCase().includes('cloudflare'))
      );
      setIsServerDown(serverDown);
      setError(serverDown ? 'Server is down. Please contact support team.' : err?.message || 'Failed to load candidate dossier.');
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

  const handleUpdateBudget = async (newBudget: string) => {
    if (!lead) return;
    const trimmed = newBudget.trim();
    const oldBudget = lead.budgetRange || '';

    // Optimistically update
    setLead((prev) => (prev ? { ...prev, budgetRange: trimmed, clientBudget: trimmed } : null));
    setEditFormData((prev) => ({ ...prev, budgetRange: trimmed }));
    localStorage.setItem(`ssa_lead_budget_${lead.id}`, trimmed);
    setIsEditingBudget(false);

    try {
      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      const payload: any = { budgetRange: trimmed };
      if (prefId) {
        payload.id = Number(prefId);
        await axiosClient.patch(`/api/lead-preferences/${prefId}`, payload);
      } else {
        payload.lead = { id: lead.id };
        await axiosClient.post('/api/lead-preferences', payload);
      }

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
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
      console.warn('Failed to save budget:', err);
    }
  };

  const handleUpdatePaymentStatus = async (status: 'UNPAID' | 'PARTIAL' | 'PAID') => {
    if (!lead || updatingPayment) return;
    setUpdatingPayment(true);
    const oldStatus = (lead as any).paymentStatus || 'UNPAID';

    // Optimistically update
    setLead((prev) => (prev ? { ...prev, paymentStatus: status } : null));
    setEditFormData((prev) => ({ ...prev, paymentStatus: status }));
    localStorage.setItem(`ssa_lead_payment_status_${lead.id}`, status);

    try {
      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      const payload: any = { mattressType: status };
      if (prefId) {
        payload.id = Number(prefId);
        await axiosClient.patch(`/api/lead-preferences/${prefId}`, payload);
      } else {
        payload.lead = { id: lead.id };
        await axiosClient.post('/api/lead-preferences', payload);
      }

      const statusLabels: Record<string, string> = {
        UNPAID: 'Not Paid',
        PARTIAL: 'Partially Paid',
        PAID: 'Fully Paid',
      };

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
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
      console.warn('Failed to save payment status:', err);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleUpdatePaymentDetails = async (details: string) => {
    if (!lead) return;
    const trimmed = details.trim();
    const oldDetails = (lead as any).paymentDetails || '';

    // Optimistically update
    setLead((prev) => (prev ? { ...prev, paymentDetails: trimmed } : null));
    setEditFormData((prev) => ({ ...prev, paymentDetails: trimmed }));
    localStorage.setItem(`ssa_lead_payment_details_${lead.id}`, trimmed);
    setIsEditingPaymentDetails(false);

    try {
      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      const payload: any = { mattressSize: trimmed };
      if (prefId) {
        payload.id = Number(prefId);
        await axiosClient.patch(`/api/lead-preferences/${prefId}`, payload);
      } else {
        payload.lead = { id: lead.id };
        await axiosClient.post('/api/lead-preferences', payload);
      }

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
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
      console.warn('Failed to save payment details:', err);
    }
  };

  const handleUpdatePercentage = async (newPercentage: string) => {
    if (!lead) return;
    const trimmed = newPercentage.trim();
    const oldPercentage = (lead as any).studentPercentage || (lead as any).cgpa || '';

    // Optimistically update
    setLead((prev) => (prev ? { ...prev, studentPercentage: trimmed, cgpa: trimmed } : null));
    setEditFormData((prev) => ({ ...prev, studentPercentage: trimmed, cgpa: trimmed }));
    localStorage.setItem(`ssa_lead_percentage_${lead.id}`, trimmed);
    setIsEditingPercentage(false);

    // Sync to notes: replace existing CGPA entry or prepend
    let updatedNotes = lead.notes || '';
    if (/(?:what_is_your_cgpa_or_current_percentage|cgpa|percentage|score|marks)\s*[:=?]\s*([^|\n,;]+)/i.test(updatedNotes)) {
      updatedNotes = updatedNotes.replace(
        /(?:what_is_your_cgpa_or_current_percentage|cgpa|percentage|score|marks)\s*[:=?]\s*([^|\n,;]+)/i,
        `CGPA: ${trimmed}`
      );
    } else if (trimmed) {
      updatedNotes = updatedNotes ? `CGPA: ${trimmed} | ${updatedNotes}` : `CGPA: ${trimmed}`;
    }

    try {
      const promises: Promise<any>[] = [];
      promises.push(crmService.patchLead(lead.id, { notes: updatedNotes }).catch(() => {}));

      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      if (prefId) {
        promises.push(
          axiosClient
            .patch(`/api/lead-preferences/${prefId}`, { id: Number(prefId), notes: updatedNotes })
            .catch(() => {})
        );
      }

      await Promise.allSettled(promises);

      leadActivityService.logActivity(lead.id, {
        userName: currentUser?.login || currentUser?.firstName || 'Counselor',
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
      console.warn('Failed to save student percentage:', err);
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

    try {
      const promises: Promise<any>[] = [];

      // 1. Update customer profile (must pass id in body)
      if (lead.customerId) {
        promises.push(
          crmService.updateCustomer(lead.customerId, {
            id: Number(lead.customerId),
            fullName: editFormData.customerName || lead.customerName,
            phoneNumber: editFormData.phoneNumber || lead.phoneNumber,
            location: editFormData.city || lead.city || lead.location,
            email: editFormData.email || lead.email,
          }).catch((err) => {
            console.warn('Customer profile update warning:', err);
          })
        );
      }

      // 2. Update lead preferences (must pass id in body)
      const prefId = lead.preferenceId || (lead as any).leadPreferenceId;
      const prefPayload: any = {
        visaType: editFormData.visaType || lead.visaType,
        email: editFormData.email || lead.email,
        city: editFormData.city || lead.city,
        age: editFormData.age || lead.age,
        educationalQualification: editFormData.educationalQualification || lead.educationalQualification,
        notes: editFormData.notes || lead.notes,
        purchaseTimeline: editFormData.closingDate || lead.closingDate,
        closingDate: editFormData.closingDate || lead.closingDate,
        budgetRange: editFormData.budgetRange !== undefined ? editFormData.budgetRange : lead.budgetRange,
        mattressType: editFormData.paymentStatus !== undefined ? editFormData.paymentStatus : (lead as any).paymentStatus,
        mattressSize: editFormData.paymentDetails !== undefined ? editFormData.paymentDetails : (lead as any).paymentDetails,
      };

      if (prefId) {
        prefPayload.id = Number(prefId);
        promises.push(
          axiosClient.patch(`/api/lead-preferences/${prefId}`, prefPayload).catch((err) => {
            console.warn('Lead preference update warning:', err);
          })
        );
      } else {
        prefPayload.lead = { id: lead.id };
        promises.push(
          axiosClient.post('/api/lead-preferences', prefPayload).catch((err) => {
            console.warn('Lead preference create warning:', err);
          })
        );
      }

      // Persist to local storage for instant offline resilience
      if (editFormData.closingDate !== undefined) {
        localStorage.setItem(`ssa_lead_closing_date_${lead.id}`, editFormData.closingDate);
      }
      if (editFormData.budgetRange !== undefined) {
        localStorage.setItem(`ssa_lead_budget_${lead.id}`, editFormData.budgetRange);
      }
      if (editFormData.paymentStatus !== undefined) {
        localStorage.setItem(`ssa_lead_payment_status_${lead.id}`, editFormData.paymentStatus);
      }
      if (editFormData.paymentDetails !== undefined) {
        localStorage.setItem(`ssa_lead_payment_details_${lead.id}`, editFormData.paymentDetails);
      }
      if (editFormData.studentPercentage !== undefined) {
        localStorage.setItem(`ssa_lead_percentage_${lead.id}`, editFormData.studentPercentage);
      }

      // 3. Update lead status/notes if changed
      if (editFormData.notes !== undefined && editFormData.notes !== lead.notes) {
        promises.push(
          crmService.updateLeadStatus(lead.id, lead.status || 'CREATED', editFormData.notes)
            .catch((err) => {
              console.warn('Lead status update warning:', err);
            })
        );
      }

      await Promise.all(promises);

      // Optimistically update local state immediately so user sees changes instantly
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
          notes: editFormData.notes !== undefined ? editFormData.notes : prev.notes,
          budgetRange: editFormData.budgetRange !== undefined ? editFormData.budgetRange : prev.budgetRange,
          clientBudget: editFormData.budgetRange !== undefined ? editFormData.budgetRange : (prev as any).clientBudget,
          paymentStatus: editFormData.paymentStatus !== undefined ? editFormData.paymentStatus : (prev as any).paymentStatus,
          paymentDetails: editFormData.paymentDetails !== undefined ? editFormData.paymentDetails : (prev as any).paymentDetails,
          studentPercentage: editFormData.studentPercentage !== undefined ? editFormData.studentPercentage : (prev as any).studentPercentage,
          cgpa: editFormData.studentPercentage !== undefined ? editFormData.studentPercentage : (prev as any).cgpa,
        };
      });

      setShowEditModal(false);
      window.dispatchEvent(new CustomEvent('crm-data-updated'));

      if (changes.length > 0) {
        leadActivityService.logActivity(lead.id, {
          userName: currentUser?.login || currentUser?.firstName || 'Counselor',
          userRole: currentUser?.authorities?.[0],
          actionType: 'DATA_MODIFY',
          title: 'Candidate Details Updated',
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
              <span>Return to Pipeline</span>
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
          <span>Return to Pipeline</span>
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

  const closingInfo = getClosingDateInfo(lead.createdTime || (lead as any).createdAt || (lead as any).createdDate);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-[#007aff] transition-all shadow-xs border border-black/[0.05] active:scale-95 backdrop-blur-md"
        >
          <ChevronLeft size={16} />
          <span>Back to Leads</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (lead) {
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
              }
              setShowEditModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-800 rounded-xl border border-black/[0.06] text-xs font-semibold shadow-xs transition-all active:scale-95 backdrop-blur-md cursor-pointer"
          >
            <Edit2 size={13} className="text-[#007aff]" />
            <span>Edit Details</span>
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-black/[0.04] text-[#8e8e93] hover:text-[#ff3b30] rounded-xl border border-black/[0.08] hover:border-black/[0.15] text-xs font-medium transition-all active:scale-95 shadow-2xs cursor-pointer"
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-black/[0.04] text-[#1c1c1e] border border-black/[0.06]">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-xl text-xs font-medium border border-black/[0.08] shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="View counselor audit logs and candidate activity history"
            >
              <BrandActivityIcon size={14} className="text-[#8e8e93]" />
              <span>Activity Logs</span>
              {activities.length > 0 && (
                <span className="text-xs text-[#8e8e93] font-normal">
                  ({activities.length})
                </span>
              )}
            </button>

            {/* Apple iOS Candidate Reminder Button */}
            <button
              onClick={() => setShowReminderModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f2f2f7] text-[#1c1c1e] rounded-xl text-xs font-medium border border-black/[0.08] shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Set and manage reminders for this candidate"
            >
              <BrandReminderIcon size={14} className="text-[#8e8e93]" />
              <span>Reminder</span>
              {leadReminders.filter((r) => !r.isCompleted).length > 0 && (
                <span className="text-xs text-[#8e8e93] font-normal">
                  ({leadReminders.filter((r) => !r.isCompleted).length})
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
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 hover:text-[#007aff] px-2 py-0.5 rounded-lg hover:bg-black/[0.04] transition-colors cursor-pointer group"
                title="Click to edit target conversion closing date"
              >
                <Clock size={13} className="text-[#8e8e93] group-hover:text-[#007aff]" />
                <span className="font-semibold underline decoration-dotted underline-offset-2">
                  {closingInfo.closingDateDisplay}
                </span>
                {closingInfo.milestoneBadge && lead.status !== 'WON' && lead.status !== 'LOST' && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      closingInfo.progressPercent && closingInfo.progressPercent >= 100
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : closingInfo.progressPercent && closingInfo.progressPercent >= 75
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {closingInfo.milestoneBadge}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Apple iOS Human Interface Segmented Pipeline Control */}
          <div className="p-1 bg-[#767680]/12 rounded-xl flex items-center gap-0.5 overflow-x-auto border border-black/[0.04]">
            {LEAD_STATUS_LIST.map((st) => {
              const isCurrent = lead.status === st.value;
              const isWon = st.value === 'WON';
              const isLost = st.value === 'LOST';

              let stageLabel = st.label;
              if (isWon) stageLabel = 'Closed Won';
              if (isLost) stageLabel = 'Closed Lost';

              let activeClasses = 'bg-white text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] font-semibold';
              if (isWon && isCurrent) activeClasses = 'bg-[#34c759] text-white shadow-sm font-semibold';
              if (isLost && isCurrent) activeClasses = 'bg-[#ff3b30] text-white shadow-sm font-semibold';

              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => handleStatusChange(st.value)}
                  title={`${st.label} (${st.value})`}
                  className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                    isCurrent
                      ? activeClasses
                      : 'text-[#636366] hover:text-[#1c1c1e] hover:bg-black/[0.03] font-medium'
                  }`}
                >
                  {isWon && (
                    <BrandWonIcon
                      size={13}
                      className={isCurrent ? 'text-white' : 'text-[#34c759]'}
                    />
                  )}
                  {isLost && (
                    <BrandLostIcon
                      size={13}
                      className={isCurrent ? 'text-white' : 'text-[#8e8e93]'}
                    />
                  )}
                  <span className="truncate">{stageLabel}</span>
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
                <span>Contact Details</span>
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

              {/* Client Budget Quick Card */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
                    <CreditCard size={12} className="text-[#007aff]" />
                    <span>Client Budget</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(lead.budgetRange || '');
                      setIsEditingBudget(true);
                    }}
                    className="text-[11px] font-semibold text-[#007aff] hover:underline"
                  >
                    {lead.budgetRange ? 'Change' : '+ Set'}
                  </button>
                </div>
                <p className="text-sm font-bold text-[#1c1c1e] mt-1">
                  {lead.budgetRange || <span className="text-[#8e8e93] font-normal italic">Not specified</span>}
                </p>
              </div>

              {/* Payment Status Quick Card */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider block">Payment Status</span>
                <div className="mt-1 flex items-center gap-2">
                  {(() => {
                    const st = ((lead as any).paymentStatus || 'UNPAID').toUpperCase();
                    if (st === 'PAID') {
                      return (
                        <span className="text-xs font-semibold text-emerald-700">
                          Fully Paid
                        </span>
                      );
                    }
                    if (st === 'PARTIAL') {
                      return (
                        <span className="text-xs font-medium text-amber-700">
                          Partially Paid
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs font-medium text-slate-500">
                        Not Paid
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Client Budget & Payment Settlement (Apple HIG Inset Grouped Card) */}
          <div className="ios-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b] flex items-center gap-2">
                <Wallet size={14} className="text-[#007aff]" />
                <span>Financial & Payment Settlement</span>
              </h3>
              <span className="text-[11px] text-[#86868b] font-medium">Manual Staff Settlement</span>
            </div>

            {/* Quick 1-Click Status Segmented Control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                Settlement Status (1-Click Toggle)
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-[#f2f2f7] rounded-2xl border border-black/[0.04]">
                {[
                  { value: 'UNPAID', label: 'Not Paid', color: 'bg-rose-500 text-white shadow-xs', inactive: 'text-rose-700 hover:bg-rose-500/10' },
                  { value: 'PARTIAL', label: 'Partially Paid', color: 'bg-amber-500 text-white shadow-xs', inactive: 'text-amber-700 hover:bg-amber-500/10' },
                  { value: 'PAID', label: 'Fully Paid', color: 'bg-emerald-500 text-white shadow-xs', inactive: 'text-emerald-700 hover:bg-emerald-500/10' },
                ].map((st) => {
                  const currentStatus = ((lead as any).paymentStatus || 'UNPAID').toUpperCase();
                  const isSelected = currentStatus === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => handleUpdatePaymentStatus(st.value as any)}
                      disabled={updatingPayment}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center cursor-pointer active:scale-95 ${
                        isSelected
                          ? st.color
                          : `${st.inactive} font-medium`
                      }`}
                    >
                      <span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget Range / Client Budget Details */}
            <div className="p-4 rounded-2xl bg-[#f2f2f7]/60 border border-black/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={13} className="text-[#007aff]" />
                  <span>Client Budget (Dynamic & Editable)</span>
                </span>
                {!isEditingBudget && (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(lead.budgetRange || '');
                      setIsEditingBudget(true);
                    }}
                    className="text-xs font-semibold text-[#007aff] hover:text-[#0071e3] transition-colors"
                  >
                    Edit Budget
                  </button>
                )}
              </div>

              {isEditingBudget ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8e8e93]">₹</span>
                      <input
                        type="text"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        placeholder="e.g. 1,50,000 or 2 Lakhs"
                        className="w-full pl-7 pr-3 py-2 text-xs font-semibold bg-white border border-black/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateBudget(budgetInput)}
                      className="px-3.5 py-2 bg-[#007aff] text-white rounded-xl text-xs font-semibold hover:bg-[#0071e3] transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBudget(false)}
                      className="px-3 py-2 bg-black/[0.05] text-[#1c1c1e] rounded-xl text-xs font-medium hover:bg-black/[0.1] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['₹25K', '₹50K', '₹1 Lakh', '₹2 Lakhs', '₹3.5 Lakhs', '₹5 Lakhs+'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setBudgetInput(preset);
                          handleUpdateBudget(preset);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-black/[0.08] text-[11px] font-medium text-[#1c1c1e] hover:bg-black/[0.04] transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold tracking-tight text-[#1c1c1e]">
                    {lead.budgetRange ? lead.budgetRange : 'Not Specified'}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Remarks & Receipt Notes */}
            <div className="p-4 rounded-2xl bg-[#f2f2f7]/60 border border-black/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider">
                  Payment Details & Transaction Remarks
                </span>
                {!isEditingPaymentDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentDetailsInput((lead as any).paymentDetails || '');
                      setIsEditingPaymentDetails(true);
                    }}
                    className="text-xs font-semibold text-[#007aff] hover:text-[#0071e3] transition-colors"
                  >
                    Edit Remarks
                  </button>
                )}
              </div>

              {isEditingPaymentDetails ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={paymentDetailsInput}
                    onChange={(e) => setPaymentDetailsInput(e.target.value)}
                    rows={2}
                    placeholder="e.g. Advance ₹25,000 received via UPI on Oct 24. Ref: UPI98231..."
                    className="w-full px-3 py-2 text-xs bg-white border border-black/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 leading-relaxed"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPaymentDetails(false)}
                      className="px-3 py-1.5 bg-black/[0.05] text-[#1c1c1e] rounded-xl text-xs font-medium hover:bg-black/[0.1] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePaymentDetails(paymentDetailsInput)}
                      className="px-3.5 py-1.5 bg-[#007aff] text-white rounded-xl text-xs font-semibold hover:bg-[#0071e3] transition-colors cursor-pointer"
                    >
                      Save Remarks
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#3c3c43] font-medium leading-relaxed">
                  {(lead as any).paymentDetails || (
                    <span className="text-[#8e8e93] italic">No payment transactions recorded yet. Tap "Edit Remarks" to record advance, receipts, or notes.</span>
                  )}
                </p>
              )}
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

              {/* Student Percentage / CGPA (Dynamic & Inline-Editable) */}
              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[#86868b] text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Award size={13} className="text-[#007aff]" />
                    <span>Student Percentage / CGPA</span>
                  </span>
                  {!isEditingPercentage && (
                    <button
                      type="button"
                      onClick={() => {
                        setPercentageInput((lead as any).studentPercentage || (lead as any).cgpa || '');
                        setIsEditingPercentage(true);
                      }}
                      className="text-[11px] font-semibold text-[#007aff] hover:underline cursor-pointer"
                    >
                      {(lead as any).studentPercentage || (lead as any).cgpa ? 'Edit' : '+ Set'}
                    </button>
                  )}
                </div>

                {isEditingPercentage ? (
                  <div className="space-y-2 mt-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={percentageInput}
                        onChange={(e) => setPercentageInput(e.target.value)}
                        placeholder="e.g. 75% or 7.8 CGPA or RNR"
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold bg-white border border-black/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007aff]/30"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdatePercentage(percentageInput)}
                        className="px-2.5 py-1.5 bg-[#007aff] text-white rounded-xl text-xs font-semibold hover:bg-[#0071e3] transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPercentage(false)}
                        className="px-2 py-1.5 bg-black/[0.05] text-[#1c1c1e] rounded-xl text-xs font-medium hover:bg-black/[0.1] transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Quick percentage chips */}
                    <div className="flex flex-wrap gap-1">
                      {['60-70%', '70-80%', '80%+', '6.5+ CGPA', '7.5+ CGPA', 'RNR'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setPercentageInput(chip);
                            handleUpdatePercentage(chip);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-white border border-black/[0.08] text-[10px] font-medium text-[#1c1c1e] hover:bg-black/[0.04] cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="font-bold text-[#1c1c1e] text-sm">
                      {(lead as any).studentPercentage || (lead as any).cgpa || '—'}
                    </p>
                    {((lead as any).studentPercentage || (lead as any).cgpa) && (
                      <span className="text-[10px] font-semibold text-[#007aff] bg-[#007aff]/10 px-2 py-0.5 rounded-full">
                        Score Set
                      </span>
                    )}
                  </div>
                )}
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

              <div className="p-3.5 rounded-2xl bg-[#f2f2f7]/60 hover:bg-[#f2f2f7] border border-black/[0.04] transition-colors">
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
                <BrandAttributionIcon size={14} className="text-[#007aff]" />
                <span>Lead Source</span>
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
                <span>Counselor Notes</span>
              </h3>
              <span className="text-[11px] text-[#86868b] font-medium">Quick Note</span>
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
                  <span>{submittingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </div>
            </form>

            {/* Historical Notes Stream */}
            <div className="pt-3 border-t border-black/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                Notes History
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
                  placeholder="e.g. Mahendran"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Phone Number <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editFormData.phoneNumber || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  placeholder="e.g. +919360185226"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium"
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
                  placeholder="candidate@example.com"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                />
              </div>

              {/* City / Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  City / Location
                </label>
                <input
                  type="text"
                  value={editFormData.city || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                  placeholder="e.g. Namakkal, Salem, Chennai"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                />
              </div>

              {/* Visa Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Visa Type
                </label>
                <select
                  value={editFormData.visaType || 'WORK_VISA'}
                  onChange={(e) => setEditFormData({ ...editFormData, visaType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium cursor-pointer"
                >
                  <option value="WORK_VISA">Work Visa</option>
                  <option value="STUDY_VISA">Study Visa</option>
                  <option value="OTHER_VISA">Other Visa</option>
                </select>
              </div>

              {/* Student Percentage / CGPA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1c1c1e]">
                    Student Percentage / CGPA
                  </label>
                  <span className="text-[11px] text-[#8e8e93]">Academic Marks / Score</span>
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
                  placeholder="e.g. 75% or 8.2 CGPA or RNR"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                />
              </div>

              {/* Target Closing Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1c1c1e]">
                    Target Closing Date
                  </label>
                  <span className="text-[11px] text-[#8e8e93]">Visa Conversion Deadline</span>
                </div>
                <input
                  type="date"
                  value={editFormData.closingDate || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, closingDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium cursor-pointer"
                />
              </div>

              {/* Client Budget */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1c1c1e]">
                    Client Budget
                  </label>
                  <span className="text-[11px] text-[#8e8e93]">Candidate Financial Capacity</span>
                </div>
                <input
                  type="text"
                  value={editFormData.budgetRange || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, budgetRange: e.target.value })}
                  placeholder="e.g. ₹1,50,000 or ₹2 Lakhs"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                />
              </div>

              {/* Payment Settlement Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Payment Settlement Status
                </label>
                <select
                  value={editFormData.paymentStatus || 'UNPAID'}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentStatus: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-medium cursor-pointer"
                >
                  <option value="UNPAID">Not Paid / Unpaid</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </div>

              {/* Payment Details & Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Payment Details & Receipt Notes
                </label>
                <input
                  type="text"
                  value={editFormData.paymentDetails || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentDetails: e.target.value })}
                  placeholder="e.g. Advance ₹20,000 received via UPI on 24 Oct"
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1c1c1e]">
                  Notes
                </label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add notes about this candidate..."
                  className="w-full px-3.5 py-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea]/50 focus:bg-white border border-black/[0.06] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all leading-relaxed"
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

      {/* WhatsApp Template Customization Modal (Apple HIG Glass Sheet UI) */}
      {showWhatsAppTemplateModal && (
        <div className="ios-modal-backdrop animate-in fade-in duration-200">
          <div className="ios-material-thick rounded-3xl border border-black/[0.08] shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 text-xs">
            <div className="ios-sheet-grabber mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="text-sm font-semibold text-[#1c1c1e] flex items-center gap-1.5">
                <MessageCircle size={15} className="text-[#34c759]" />
                <span>Personalize WhatsApp Message</span>
              </h3>
              <button
                onClick={() => setShowWhatsAppTemplateModal(false)}
                className="w-7 h-7 rounded-full bg-black/[0.05] text-[#8e8e93] hover:text-[#1c1c1e] hover:bg-black/[0.1] flex items-center justify-center transition-colors"
              >
                <X size={15} />
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
            notificationApiService.getEvents({ candidateId: targetId as any })
              .then((evts) => {
                if (Array.isArray(evts)) setLeadReminders(evts);
              })
              .catch(() => {});
            leadActivityService.getActivities(targetId).then(setActivities).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
