import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Check,
  Plus,
  User,
  PhoneCall,
  FileCheck,
  GraduationCap,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { BrandReminderIcon } from './icons/BrandIcons';
import notificationApiService, {
  CalendarEventDTO,
  EventPriority,
  EventType,
} from '../services/api/notificationService';
import reminderNotificationService, {
  getRemainingTimeInfo,
  formatEventReadable,
} from '../services/reminderNotificationService';
import { formatMaskedLeadRef } from '../utils/leadIdCrypto';

interface LeadReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string | number;
  candidateName: string;
  assignedStaff?: string;
  onReminderSaved?: () => void;
}

export default function LeadReminderModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  assignedStaff,
  onReminderSaved,
}: LeadReminderModalProps) {
  // Existing candidate reminders
  const [reminders, setReminders] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'NEW' | 'LIST'>('NEW');

  // New Reminder form state
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // tomorrow by default
    return d.toISOString().split('T')[0];
  });
  const [eventTime, setEventTime] = useState('10:00');
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number>(15);
  const [priority, setPriority] = useState<EventPriority>('MEDIUM');
  const [eventType, setEventType] = useState<EventType>('FOLLOWUP');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quick Preset options
  const PRESETS = [
    {
      label: 'Follow-up Call',
      title: `Follow up call with ${candidateName}`,
      type: 'CALL' as EventType,
      priority: 'HIGH' as EventPriority,
      icon: <PhoneCall size={13} />,
    },
    {
      label: 'Doc Verification',
      title: `Verify academic & visa docs for ${candidateName}`,
      type: 'FOLLOWUP' as EventType,
      priority: 'MEDIUM' as EventPriority,
      icon: <FileCheck size={13} />,
    },
    {
      label: 'Counseling Session',
      title: `Admission counseling session with ${candidateName}`,
      type: 'INTERVIEW' as EventType,
      priority: 'MEDIUM' as EventPriority,
      icon: <GraduationCap size={13} />,
    },
    {
      label: 'Fee Confirmation',
      title: `Confirm visa processing fee receipt for ${candidateName}`,
      type: 'REMINDER' as EventType,
      priority: 'HIGH' as EventPriority,
      icon: <CreditCard size={13} />,
    },
  ];

  // Fetch reminders for this specific candidate
  const loadCandidateReminders = async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      // 1. Fetch from backend API
      const serverEvents = await notificationApiService.getEvents({ candidateId: candidateId as any });
      if (Array.isArray(serverEvents) && serverEvents.length > 0) {
        setReminders(serverEvents);
        if (serverEvents.length > 0 && !title) {
          // If reminders exist, show list or keep new
        }
      } else {
        // Fallback to local cache filtered by candidateId
        const cached = reminderNotificationService.getCachedEvents();
        const filtered = cached.filter((e) => String(e.candidateId) === String(candidateId));
        setReminders(filtered);
      }
    } catch {
      const cached = reminderNotificationService.getCachedEvents();
      const filtered = cached.filter((e) => String(e.candidateId) === String(candidateId));
      setReminders(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCandidateReminders();
      setFeedback(null);
      // Pre-fill initial title if empty
      if (!title) {
        setTitle(`Follow-up with ${candidateName}`);
      }
    }
  }, [isOpen, candidateId, candidateName]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setTitle(preset.title);
    setEventType(preset.type);
    setPriority(preset.priority);
  };

  // Quick Date presets
  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setEventDate(d.toISOString().split('T')[0]);
  };

  // Save new reminder
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      setFeedback({ type: 'error', message: 'Please enter a reminder title and scheduled date.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const newEventData: Omit<CalendarEventDTO, 'id' | 'createdAt' | 'updatedAt' | 'notificationSent'> = {
        userId: assignedStaff || 'current',
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate,
        eventTime,
        eventType,
        priority,
        candidateId,
        candidateName,
        isCompleted: false,
        remindBeforeMinutes,
      };

      // Save via persistent service (dispatches both to PostgreSQL & optimistic local cache)
      await reminderNotificationService.saveEvent(newEventData);

      setFeedback({
        type: 'success',
        message: 'Reminder scheduled successfully. Push & in-app notifications will alert you when due.',
      });

      // Reload reminders and notify parent
      await loadCandidateReminders();
      if (onReminderSaved) {
        onReminderSaved();
      }

      // Reset form
      setTimeout(() => {
        setActiveTab('LIST');
      }, 1000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to schedule reminder. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async (reminderId: string) => {
    try {
      await reminderNotificationService.toggleEventComplete(reminderId);
      await loadCandidateReminders();
      if (onReminderSaved) onReminderSaved();
    } catch {}
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await reminderNotificationService.deleteEvent(reminderId);
      await loadCandidateReminders();
      if (onReminderSaved) onReminderSaved();
    } catch {}
  };

  const pendingCount = reminders.filter((r) => !r.isCompleted).length;

  return (
    <div className="ios-modal-backdrop animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl max-h-[92vh] ios-material-thick rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-white/60 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Apple iOS Frosted Header */}
        <div className="px-6 pt-3 pb-4 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl flex flex-col sticky top-0 z-10">
          <div className="ios-sheet-grabber mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/[0.04] text-[#1c1c1e] flex items-center justify-center shadow-xs">
              <BrandReminderIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                  Candidate Reminders
                </h2>
                {pendingCount > 0 && (
                  <span className="text-xs text-[#8e8e93] font-normal">
                    ({pendingCount})
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8e8e93] font-medium mt-0.5">
                {candidateName} • Ref {formatMaskedLeadRef(candidateId)}
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
      </div>

        {/* Segmented Top Toggle (New Reminder vs Active Reminders) */}
        <div className="px-6 pt-3 pb-2 bg-[#f8f9fa] border-b border-black/[0.05] flex items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-black/[0.05] rounded-xl">
            <button
              onClick={() => setActiveTab('NEW')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'NEW'
                  ? 'bg-white text-[#1c1c1e] shadow-xs'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              + Set Reminder
            </button>
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'LIST'
                  ? 'bg-white text-[#1c1c1e] shadow-xs'
                  : 'text-[#8e8e93] hover:text-[#1c1c1e]'
              }`}
            >
              <span>Reminders List</span>
              {reminders.length > 0 && (
                <span className="text-xs text-[#8e8e93] font-normal">
                  ({reminders.length})
                </span>
              )}
            </button>
          </div>

          <span className="text-[11px] text-[#8e8e93] font-medium hidden sm:inline">
            In-App + Android Push Alert
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                feedback.type === 'success'
                  ? 'bg-black/[0.04] text-[#1c1c1e] border border-black/[0.06]'
                  : 'bg-black/[0.04] text-[#ff3b30] border border-black/[0.06]'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {activeTab === 'NEW' ? (
            /* New Reminder Form */
            <form onSubmit={handleSaveReminder} className="space-y-4">
              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#ff9500]" />
                  <span>Quick Presets</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer"
                    >
                      {p.icon}
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Reminder Title / Task <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call candidate to review visa documentation"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all"
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
                        onClick={() => handleQuickDate(0)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDate(1)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDate(2)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        +2d
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all"
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
                        onClick={() => setEventTime('10:00')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        10 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventTime('14:30')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        2:30 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventTime('17:00')}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43]"
                      >
                        5 PM
                      </button>
                    </div>
                  </div>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all"
                  />
                </div>
              </div>

              {/* Live Remaining Time Preview */}
              {(() => {
                const liveRem = getRemainingTimeInfo(eventDate, eventTime);
                if (!liveRem) return null;
                return (
                  <div
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-[11px] font-medium transition-all ${
                      liveRem.isPast
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-900'
                        : 'bg-[#007aff]/[0.08] border-[#007aff]/20 text-[#007aff]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock size={12} className="shrink-0" />
                      <span>{liveRem.isPast ? liveRem.text : `⏱ ${liveRem.text}`}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 shrink-0 shadow-2xs">
                      {liveRem.isPast ? 'Passed' : 'Countdown'}
                    </span>
                  </div>
                );
              })()}

              {/* Remind Before & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Remind Before */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Notification Timing
                  </label>
                  <select
                    value={remindBeforeMinutes}
                    onChange={(e) => setRemindBeforeMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all"
                  >
                    <option value={0}>At scheduled time</option>
                    <option value={15}>15 minutes before (Default)</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-xl">
                    {(['LOW', 'MEDIUM', 'HIGH'] as EventPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-1.5 text-center text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                          priority === p
                            ? 'bg-white text-[#1c1c1e] shadow-xs'
                            : 'text-[#8e8e93] hover:text-[#1c1c1e]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description / Counselor Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Counselor Notes / Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional context or specific checklist items..."
                  className="w-full px-3.5 py-2 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#007aff] hover:bg-[#0062cc] active:scale-[0.99] text-white font-semibold rounded-2xl text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <BrandReminderIcon size={14} />
                  <span>{isSubmitting ? 'Scheduling Reminder...' : 'Set Reminder'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Reminders List View */
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-xs text-[#8e8e93]">
                  Loading candidate reminders...
                </div>
              ) : reminders.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <BrandReminderIcon size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1c1c1e]">No Reminders Set</h3>
                  <p className="text-xs text-[#8e8e93] max-w-xs mx-auto">
                    Schedule follow-up calls, document checks, or counseling alerts for {candidateName}.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('NEW')}
                      className="px-4 py-2 bg-[#007aff] text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      + Create First Reminder
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {reminders.map((r) => (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        r.isCompleted
                          ? 'bg-slate-50 border-black/[0.04] opacity-75'
                          : 'bg-[#f8f9fa] border-black/[0.06] hover:bg-white hover:border-black/[0.12] shadow-2xs'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(r.id)}
                        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          r.isCompleted
                            ? 'bg-[#34c759] border-[#34c759] text-white'
                            : 'border-black/[0.2] hover:border-[#007aff]'
                        }`}
                        title={r.isCompleted ? 'Mark incomplete' : 'Mark completed'}
                      >
                        {r.isCompleted && <Check size={12} strokeWidth={3} />}
                      </button>

                      {/* Reminder Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-semibold truncate ${
                              r.isCompleted ? 'line-through text-[#8e8e93]' : 'text-[#1c1c1e]'
                            }`}
                          >
                            {r.title}
                          </p>
                          {r.priority === 'HIGH' || r.priority === 'URGENT' ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/[0.04] text-[#ff3b30] border border-black/[0.06]">
                              {r.priority}
                            </span>
                          ) : null}
                        </div>

                        {/* Date & Time */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8e8e93] flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar size={11} />
                            {r.eventDate}
                          </span>
                          {r.eventTime && (
                            <span className="flex items-center gap-1 font-medium">
                              <Clock size={11} />
                              {r.eventTime}
                            </span>
                          )}
                          {!r.isCompleted && (() => {
                            const rem = getRemainingTimeInfo(r.eventDate, r.eventTime);
                            if (!rem || rem.isPast) return null;
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
                                <Clock size={10} />
                                {rem.text}
                              </span>
                            );
                          })()}
                          {r.isCompleted && (
                            <span className="text-[#34c759] font-semibold">• Completed</span>
                          )}
                        </div>

                        {/* Description */}
                        {r.description && (
                          <p className="text-[11px] text-[#3c3c43] mt-1.5 leading-relaxed">
                            {r.description}
                          </p>
                        )}
                      </div>

                      {/* Delete Action */}
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(r.id)}
                        className="p-1.5 text-slate-400 hover:text-[#ff3b30] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Delete reminder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs text-[#8e8e93]">
          <span className="text-[11px]">
            {pendingCount} pending {pendingCount === 1 ? 'reminder' : 'reminders'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] font-semibold rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

