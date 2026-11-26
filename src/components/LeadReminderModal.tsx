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
import TimePicker12Hour from './TimePicker12Hour';
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
import { format12HourTime } from '../utils/dateTimeUtils';
import { useAuth } from '../context/AuthContext';

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
  const { user: currentUser } = useAuth();
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
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number>(0);
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
      const serverEvents = await notificationApiService.getEventsForCandidate(candidateId);
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
        userId: assignedStaff || currentUser?.login || 'admin',
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
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[88vh] rounded-t-xl sm:rounded-lg shadow-lg border-t sm:border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Candidate Reminders {pendingCount > 0 ? `(${pendingCount})` : ''}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {candidateName} · {formatMaskedLeadRef(candidateId)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Clean Underline Tabs */}
        <div className="px-4 border-b border-slate-200 flex items-center gap-5 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('NEW')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'NEW'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Set Reminder
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'LIST'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Reminders ({reminders.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-2.5 rounded-md text-xs font-medium flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : (
                <AlertCircle size={14} className="shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {activeTab === 'NEW' ? (
            <form id="lead-reminder-form" onSubmit={handleSaveReminder} className="space-y-3.5">
              {/* Quick Presets */}
              <div>
                <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Quick Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reminder Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-blue-500 focus:outline-none rounded-md text-xs text-slate-900"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Date</label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button type="button" onClick={() => handleQuickDate(0)} className="text-blue-600 hover:underline cursor-pointer">
                        Today
                      </button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => handleQuickDate(1)} className="text-blue-600 hover:underline cursor-pointer">
                        Tomorrow
                      </button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => handleQuickDate(2)} className="text-blue-600 hover:underline cursor-pointer">
                        +2d
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-blue-500 focus:outline-none rounded-md text-xs text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Time</label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button type="button" onClick={() => setEventTime('10:00')} className="text-blue-600 hover:underline cursor-pointer">
                        10 AM
                      </button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => setEventTime('14:30')} className="text-blue-600 hover:underline cursor-pointer">
                        2:30 PM
                      </button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={() => setEventTime('17:00')} className="text-blue-600 hover:underline cursor-pointer">
                        5 PM
                      </button>
                    </div>
                  </div>
                  <TimePicker12Hour
                    value={eventTime}
                    onChange={setEventTime}
                    className="bg-white border-slate-300 px-3 py-1.5 text-xs rounded-md"
                  />
                </div>
              </div>

              {(() => {
                const liveRem = getRemainingTimeInfo(eventDate, eventTime);
                if (!liveRem) return null;
                return (
                  <p className={`text-[11px] ${liveRem.isPast ? 'text-amber-700' : 'text-slate-500'}`}>
                    {liveRem.text}
                  </p>
                );
              })()}

              {/* Remind Before & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notification Timing
                  </label>
                  <select
                    value={remindBeforeMinutes}
                    onChange={(e) => setRemindBeforeMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-blue-500 focus:outline-none rounded-md text-xs text-slate-800 cursor-pointer"
                  >
                    <option value={0}>At scheduled time</option>
                    <option value={15}>15 minutes before (Default)</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 border border-slate-300 rounded-md overflow-hidden">
                    {(['LOW', 'MEDIUM', 'HIGH'] as EventPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-1.5 text-center text-[11px] font-medium cursor-pointer border-r last:border-r-0 border-slate-200 ${
                          priority === p
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details or agenda..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-blue-500 focus:outline-none rounded-md text-xs text-slate-900 resize-none"
                />
              </div>
            </form>
          ) : (
            /* Reminders List View */
            <div className="space-y-2.5">
              {loading ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Loading reminders...
                </div>
              ) : reminders.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs font-medium text-slate-700">No Reminders Set</p>
                  <p className="text-[11px] text-slate-500">
                    Schedule follow-up calls or document checks for {candidateName}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('NEW')}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium cursor-pointer"
                  >
                    + Set Reminder
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {reminders.map((r) => (
                    <div key={r.id} className="p-3 flex items-start justify-between gap-3 bg-white">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(r.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center cursor-pointer shrink-0 ${
                          r.isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-blue-500'
                        }`}
                        title={r.isCompleted ? 'Mark incomplete' : 'Mark completed'}
                      >
                        {r.isCompleted && <Check size={11} strokeWidth={3} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-medium truncate ${r.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {r.title}
                          </p>
                          {(r.priority === 'HIGH' || r.priority === 'URGENT') && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-700 border border-red-200">
                              {r.priority}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                          <span>{r.eventDate}</span>
                          {r.eventTime && <span>· {format12HourTime(r.eventTime)}</span>}
                          {r.isCompleted && <span className="text-emerald-600 font-medium">· Completed</span>}
                        </div>
                        {r.description && (
                          <p className="text-[11px] text-slate-600 mt-1">{r.description}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(r.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
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
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500">
            {pendingCount} pending
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === 'NEW' && (
              <button
                type="submit"
                form="lead-reminder-form"
                disabled={isSubmitting || !title.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Set Reminder'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

