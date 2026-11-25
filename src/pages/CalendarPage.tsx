import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Check,
  Sparkles,
  PhoneCall,
  FileCheck,
  GraduationCap,
  CreditCard,
  Trash2,
  AlertCircle,
  Phone,
  User,
  CalendarCheck,
  Flag,
  X,
  Filter,
  Bell,
} from 'lucide-react';
import { BrandReminderIcon } from '../components/icons/BrandIcons';
import TimePicker12Hour from '../components/TimePicker12Hour';
import reminderNotificationService, {
  CalendarEvent,
  EventType,
  EventPriority,
  getRemainingTimeInfo,
  formatEventReadable,
} from '../services/reminderNotificationService';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { format12HourTime, IST_TIMEZONE } from '../utils/dateTimeUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatEventDateBadge(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'Today';

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().split('T')[0];
  if (dateStr === yesterday) return 'Yesterday';

  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = t.toISOString().split('T')[0];
  if (dateStr === tomorrow) return 'Tomorrow';

  const [y, m, day] = dateStr.split('-').map(Number);
  const eventDate = new Date(y, m - 1, day);
  return eventDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

interface AppleAgendaItemProps {
  evt: CalendarEvent;
  showDateBadge?: boolean;
  onToggleComplete: (id: string, e?: any) => void;
  onDelete: (id: string, e?: any) => void;
}

function AppleAgendaItem({ evt, showDateBadge, onToggleComplete, onDelete }: AppleAgendaItemProps) {
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
        evt.isCompleted
          ? 'bg-slate-50 border-black/[0.04] opacity-75'
          : 'bg-[#f8f9fa] border-black/[0.06] hover:bg-white hover:border-black/[0.12] shadow-2xs'
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete(evt.id, e);
        }}
        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
          evt.isCompleted
            ? 'bg-[#34c759] border-[#34c759] text-white'
            : 'border-black/[0.2] hover:border-[#007aff]'
        }`}
        title={evt.isCompleted ? 'Mark incomplete' : 'Mark completed'}
      >
        {evt.isCompleted && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Reminder Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-xs font-semibold truncate ${
              evt.isCompleted ? 'line-through text-[#8e8e93]' : 'text-[#1c1c1e]'
            }`}
          >
            {evt.title}
          </p>
          {evt.priority === 'HIGH' || evt.priority === 'URGENT' ? (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-black/[0.04] text-[#ff3b30] border border-black/[0.06]">
              {evt.priority}
            </span>
          ) : null}
        </div>

        {evt.description && (
          <p className="text-[11px] text-[#8e8e93] mt-0.5 leading-relaxed line-clamp-2">
            {evt.description}
          </p>
        )}

        {/* Date, Time, Candidate & Countdown */}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8e8e93] flex-wrap">
          {showDateBadge && (
            <span className="flex items-center gap-1 font-medium">
              <CalendarIcon size={11} />
              {formatEventDateBadge(evt.eventDate)}
            </span>
          )}
          {evt.eventTime && (
            <span className="flex items-center gap-1 font-medium">
              <Clock size={11} />
              {format12HourTime(evt.eventTime)}
            </span>
          )}
          {!evt.isCompleted && (() => {
            const rem = getRemainingTimeInfo(evt.eventDate, evt.eventTime);
            if (!rem) return null;
            if (rem.isPast) {
              return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/[0.04] text-[#8e8e93]">
                  Past
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#007aff]/10 text-[#007aff] border border-[#007aff]/20">
                <Clock size={10} />
                {rem.text}
              </span>
            );
          })()}
          {evt.candidateName && (
            <span className="flex items-center gap-1 font-medium text-[#1c1c1e]">
              <User size={11} className="text-[#8e8e93]" />
              {evt.candidateName}
            </span>
          )}
        </div>
      </div>

      {/* Delete Action Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(evt.id, e);
        }}
        className="w-7 h-7 rounded-lg text-[#8e8e93] hover:text-[#ff3b30] hover:bg-black/[0.04] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        title="Delete reminder"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { showConfirm } = useAlert();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'REMINDER' | 'CALL' | 'HOLIDAY'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    eventTime: '10:00',
    eventType: 'REMINDER' as EventType,
    priority: 'MEDIUM' as EventPriority,
    candidateName: '',
    remindBeforeMinutes: 0,
  });

  // Apple iOS Confirmation Modal State
  const [successReminder, setSuccessReminder] = useState<{
    title: string;
    eventDate: string;
    eventTime: string;
    remainingText: string;
    isPast: boolean;
    remindBeforeMinutes: number;
    eventType: EventType;
  } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadEvents = async () => {
    const list = await reminderNotificationService.fetchEvents({ month: month + 1, year });
    setEvents(list);
  };

  useEffect(() => {
    loadEvents();
    const handleUpdate = () => {
      setEvents(reminderNotificationService.getCachedEvents());
    };
    window.addEventListener('ssa_events_updated', handleUpdate);
    return () => window.removeEventListener('ssa_events_updated', handleUpdate);
  }, [year, month]);

  // Calendar Math & Days Generation (Apple HIG 7-column Matrix)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0: Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
    setHistoryTab('ALL');
  };

  const handleSelectDate = (dateStr: string, targetYear?: number, targetMonth?: number) => {
    setSelectedDateStr(dateStr);
    if (targetYear !== undefined && targetMonth !== undefined && (targetYear !== year || targetMonth !== month)) {
      setCurrentDate(new Date(targetYear, targetMonth, 1));
    }
    setHistoryTab('SELECTED');
  };

  // Apple HIG Date Grid: Leading days, current month days, and trailing days
  const allCalendarDays = useMemo(() => {
    const prevMonthDaysCount = new Date(year, month, 0).getDate();
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthMonth = month === 0 ? 11 : month - 1;

    // Days from previous month
    const prevDays = Array.from({ length: firstDayIndex }).map((_, i) => {
      const dayNum = prevMonthDaysCount - firstDayIndex + 1 + i;
      const dateStr = `${prevMonthYear}-${String(prevMonthMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return {
        dayNum,
        dateStr,
        isCurrentMonth: false,
        targetYear: prevMonthYear,
        targetMonth: prevMonthMonth,
      };
    });

    // Days from current month
    const currentDays = Array.from({ length: daysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return {
        dayNum,
        dateStr,
        isCurrentMonth: true,
        targetYear: year,
        targetMonth: month,
      };
    });

    // Trailing days from next month to complete standard Apple grid
    const totalSlots = firstDayIndex + daysInMonth <= 35 ? 35 : 42;
    const trailingCount = totalSlots - (firstDayIndex + daysInMonth);
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonthMonth = month === 11 ? 0 : month + 1;

    const nextDays = Array.from({ length: trailingCount }).map((_, i) => {
      const dayNum = i + 1;
      const dateStr = `${nextMonthYear}-${String(nextMonthMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return {
        dayNum,
        dateStr,
        isCurrentMonth: false,
        targetYear: nextMonthYear,
        targetMonth: nextMonthMonth,
      };
    });

    return [...prevDays, ...currentDays, ...nextDays];
  }, [year, month, daysInMonth, firstDayIndex]);


  // Map of events keyed by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((evt) => {
      if (!map[evt.eventDate]) map[evt.eventDate] = [];
      map[evt.eventDate].push(evt);
    });
    return map;
  }, [events]);

  // Events on selected date
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  const [historyTab, setHistoryTab] = useState<'ALL' | 'TODAY' | 'SELECTED' | 'COMPLETED'>('ALL');

  // User configured reminders history (sorted with most recent dates first, and chronological within each date)
  const allUserReminders = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = a.eventDate || '';
      const dateB = b.eventDate || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (a.eventTime || '').localeCompare(b.eventTime || '');
    });
  }, [events]);

  const completedEvents = useMemo(() => {
    return allUserReminders.filter((e) => e.isCompleted);
  }, [allUserReminders]);

  const selectedDateShort = useMemo(() => {
    if (!selectedDateStr) return 'Selected';
    const today = new Date().toISOString().split('T')[0];
    if (selectedDateStr === today) return 'Today';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDateStr]);

  const todayStr = new Date().toISOString().split('T')[0];

  const todayEvents = useMemo(() => {
    return eventsByDate[todayStr] || [];
  }, [eventsByDate, todayStr]);

  const displayEvents = useMemo(() => {
    if (historyTab === 'TODAY') {
      return todayEvents;
    }
    if (historyTab === 'SELECTED') {
      return selectedDateEvents;
    }
    if (historyTab === 'COMPLETED') {
      return completedEvents;
    }
    return allUserReminders;
  }, [historyTab, todayEvents, selectedDateEvents, completedEvents, allUserReminders]);

  const selectedDateDisplay = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDateStr]);

  // Open modal for a specific date
  const handleOpenModal = (dateStr?: string) => {
    const d = dateStr || selectedDateStr;
    const now = new Date();
    const defaultHour = String((now.getHours() + 1) % 24).padStart(2, '0');
    setFormData({
      title: '',
      description: '',
      eventDate: d,
      eventTime: `${defaultHour}:00`,
      eventType: 'REMINDER',
      priority: 'MEDIUM',
      candidateName: '',
      remindBeforeMinutes: 0,
    });
    setSaveError(null);
    setShowMoreDetails(false);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    setSaveError(null);

    try {
      const remainingInfo = getRemainingTimeInfo(formData.eventDate, formData.eventTime);

      const saved = await reminderNotificationService.saveEvent({
        userId: user?.login || 'admin',
        title: formData.title.trim(),
        description: formData.description.trim(),
        eventDate: formData.eventDate,
        eventTime: formData.eventTime,
        eventType: formData.eventType,
        priority: formData.priority,
        candidateName: formData.candidateName.trim() || undefined,
        isCompleted: false,
        remindBeforeMinutes: Number(formData.remindBeforeMinutes),
      });

      setIsModalOpen(false);

      // Present Apple iOS-style Confirmation Modal with dynamic countdown
      setSuccessReminder({
        title: formData.title.trim(),
        eventDate: formData.eventDate,
        eventTime: formData.eventTime,
        remainingText: remainingInfo?.text || 'Scheduled',
        isPast: !!remainingInfo?.isPast,
        remindBeforeMinutes: Number(formData.remindBeforeMinutes),
        eventType: formData.eventType,
      });
    } catch (err: any) {
      console.error('[CalendarPage] Failed to save reminder:', err);
      setSaveError(err?.message || 'Failed to save reminder. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string, e?: any) => {
    e?.stopPropagation?.();
    const confirmed = await showConfirm({
      title: 'Delete Reminder',
      message: 'Are you sure you want to delete this reminder?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      await reminderNotificationService.deleteEvent(id);
    }
  };

  const handleToggleComplete = async (id: string, e?: any) => {
    e?.stopPropagation?.();
    await reminderNotificationService.toggleEventComplete(id);
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-12 font-sf-display px-2 sm:px-4">
      {/* Top CRM Control & Header Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] text-[#1c1c1e] flex items-center justify-center shadow-xs shrink-0">
            <BrandReminderIcon size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Calendar & Reminders</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Schedule follow-ups, counseling sessions, and track scheduled candidate tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-[#007aff] hover:bg-[#0062cc] active:scale-[0.99] text-white font-semibold rounded-xl text-xs shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={15} />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 7 Cols Calendar + 5 Cols Sidebar Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Apple HIG Inline Calendar Card (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Apple HIG Month & Navigation Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {MONTH_NAMES[month]} <span className="text-slate-400 font-normal">{year}</span>
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goToToday}
                  className="px-3 py-1 bg-black/[0.04] hover:bg-black/[0.08] text-slate-800 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer mr-1"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                  title="Previous Month"
                  aria-label="Previous Month"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                  title="Next Month"
                  aria-label="Next Month"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Apple HIG Weekday Names Header */}
            <div className="grid grid-cols-7 text-center pb-2.5 border-b border-slate-100">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-[11px] font-bold tracking-wider text-slate-400 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Apple HIG Date Grid Matrix */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 py-3">
              {allCalendarDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDateStr;
                const dayEvents = eventsByDate[day.dateStr] || [];

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => handleSelectDate(day.dateStr, day.targetYear, day.targetMonth)}
                    className={`relative flex flex-col items-center justify-center py-2 sm:py-3 rounded-xl transition-all group focus:outline-none cursor-pointer ${
                      isSelected
                        ? 'bg-[#007aff] text-white shadow-xs'
                        : isToday
                        ? 'bg-[#007aff]/10 text-[#007aff] font-bold border border-[#007aff]/30'
                        : day.isCurrentMonth
                        ? 'hover:bg-slate-50 text-slate-800'
                        : 'text-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <span className={`text-[13px] sm:text-[14px] leading-tight ${isSelected || isToday ? 'font-bold' : 'font-medium'}`}>
                      {day.dayNum}
                    </span>

                    {/* Dot Indicators */}
                    <div className="h-2 flex items-center justify-center gap-1 mt-1">
                      {dayEvents.slice(0, 3).map((evt) => (
                        <span
                          key={evt.id}
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isSelected
                              ? 'bg-white'
                              : evt.isCompleted
                              ? 'bg-slate-300'
                              : evt.priority === 'HIGH' || evt.priority === 'URGENT'
                              ? 'bg-[#ff3b30]'
                              : evt.eventType === 'CALL'
                              ? 'bg-[#34c759]'
                              : 'bg-[#007aff]'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Bottom Legend */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34c759]" /> Call
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#007aff]" /> Follow-up / Task
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff3b30]" /> High Priority
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300" /> Completed
              </span>
            </div>
            <span className="text-slate-400 font-medium">Click any date to view agenda</span>
          </div>
        </div>

        {/* Right Sidebar: Selected Day Agenda & Reminders (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/[0.04] text-[#1c1c1e] flex items-center justify-center">
                  <BrandReminderIcon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {historyTab === 'SELECTED'
                      ? 'Daily Agenda'
                      : historyTab === 'TODAY'
                      ? "Today's Agenda"
                      : historyTab === 'COMPLETED'
                      ? 'Completed Reminders'
                      : 'All Reminders'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {historyTab === 'SELECTED' ? selectedDateDisplay : `${displayEvents.length} scheduled items`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="px-2.5 py-1 bg-[#007aff]/10 hover:bg-[#007aff]/15 text-[#007aff] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>

            {/* Segmented View Switcher */}
            <div className="flex p-1 bg-black/[0.04] rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  historyTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({events.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('TODAY')}
                className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  historyTab === 'TODAY'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Today ({todayEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('SELECTED')}
                className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  historyTab === 'SELECTED'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {selectedDateShort} ({selectedDateEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('COMPLETED')}
                className={`flex-1 py-1 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  historyTab === 'COMPLETED'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Done ({completedEvents.length})
              </button>
            </div>

            {/* Reminders List */}
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5">
              {displayEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <CalendarCheck size={18} strokeWidth={1.8} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {historyTab === 'COMPLETED' ? 'No completed reminders' : 'No reminders scheduled'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Stay on top of candidate follow-ups and scheduled counseling appointments.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenModal()}
                      className="px-3.5 py-1.5 bg-[#007aff] text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      + Create Reminder
                    </button>
                  </div>
                </div>
              ) : (
                displayEvents.map((evt) => (
                  <AppleAgendaItem
                    key={evt.id}
                    evt={evt}
                    showDateBadge={historyTab !== 'SELECTED'}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteEvent}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Reminder / Event Modal (Apple HIG Frosted Sheet UI) */}
      {isModalOpen && (
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
                    <BrandReminderIcon size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1c1c1e] tracking-tight">
                      Schedule Reminder
                    </h2>
                    <p className="text-xs text-[#8e8e93] font-medium mt-0.5">
                      In-App + Android Push Alert System
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  + Set Reminder
                </div>
              </div>

              <span className="text-[11px] text-[#8e8e93] font-medium hidden sm:inline">
                In-App + Android Push Alert
              </span>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#ff9500]" />
                  <span>Quick Presets</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Follow-up Call', title: 'Follow-up call with candidate', type: 'CALL' as EventType, priority: 'HIGH' as EventPriority, icon: <PhoneCall size={13} /> },
                    { label: 'Doc Verification', title: 'Verify academic & visa docs', type: 'FOLLOWUP' as EventType, priority: 'MEDIUM' as EventPriority, icon: <FileCheck size={13} /> },
                    { label: 'Counseling Session', title: 'Admission counseling session', type: 'INTERVIEW' as EventType, priority: 'MEDIUM' as EventPriority, icon: <GraduationCap size={13} /> },
                    { label: 'Fee Confirmation', title: 'Confirm visa processing fee receipt', type: 'REMINDER' as EventType, priority: 'HIGH' as EventPriority, icon: <CreditCard size={13} /> },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, title: p.title, eventType: p.type, priority: p.priority }))}
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
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Follow-up call regarding visa docs"
                  className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-800 shadow-2xs transition-all"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date Picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1c1c1e] flex items-center gap-1.5">
                      <CalendarIcon size={13} className="text-[#007aff]" />
                      <span>Date</span>
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          setFormData((prev) => ({ ...prev, eventDate: d.toISOString().split('T')[0] }));
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
                          setFormData((prev) => ({ ...prev, eventDate: d.toISOString().split('T')[0] }));
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
                          setFormData((prev) => ({ ...prev, eventDate: d.toISOString().split('T')[0] }));
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        +2d
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
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
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, eventTime: '10:00' }))}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        10 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, eventTime: '14:30' }))}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        2:30 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, eventTime: '17:00' }))}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#3c3c43] cursor-pointer"
                      >
                        5 PM
                      </button>
                    </div>
                  </div>
                  <TimePicker12Hour
                    value={formData.eventTime}
                    onChange={(t) => setFormData((prev) => ({ ...prev, eventTime: t }))}
                    className="bg-white border-black/[0.1] px-3.5 py-1.5 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Live Remaining Time Preview */}
              {(() => {
                const liveRem = getRemainingTimeInfo(formData.eventDate, formData.eventTime);
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

              {/* Notification Timing & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Notification Timing
                  </label>
                  <select
                    value={formData.remindBeforeMinutes}
                    onChange={(e) => setFormData({ ...formData, remindBeforeMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <option value={0}>At scheduled time</option>
                    <option value={15}>15 minutes before (Default)</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1c1c1e]">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-black/[0.04] rounded-xl">
                    {(['LOW', 'MEDIUM', 'HIGH'] as EventPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: p })}
                        className={`py-1.5 text-center text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                          formData.priority === p
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

              {/* Candidate Link (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Candidate Name / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={formData.candidateName}
                  onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                  placeholder="e.g. Premkanth (SSA-Gv5ea)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-md text-xs text-slate-800 shadow-2xs transition-all"
                />
              </div>

              {/* Counselor Notes / Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1c1c1e]">
                  Counselor Notes / Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add details, counseling notes, or agenda..."
                  className="w-full px-3.5 py-2 bg-white border border-black/[0.1] rounded-xl text-xs text-[#1c1c1e] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all resize-none"
                />
              </div>

              {saveError && (
                <div className="p-3 rounded-2xl bg-black/[0.04] text-[#ff3b30] border border-black/[0.06] text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim()}
                  className="w-full py-3 bg-[#007aff] hover:bg-[#0062cc] active:scale-[0.99] text-white font-semibold rounded-2xl text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <BrandReminderIcon size={14} />
                  <span>{isSubmitting ? 'Scheduling Reminder...' : 'Set Reminder'}</span>
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs text-[#8e8e93]">
              <span className="text-[11px]">
                {events.length} configured reminders
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1c1c1e] font-semibold rounded-xl transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {successReminder && (
        <div
          className="ios-modal-backdrop animate-in fade-in duration-200 z-[70]"
          onClick={() => setSuccessReminder(null)}
        >
          <div
            className="ios-material-thick rounded-3xl shadow-2xl border border-black/[0.08] max-w-[340px] w-full p-6 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSuccessReminder(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              title="Close"
            >
              <X size={13} strokeWidth={2.5} />
            </button>

            <div className="mx-auto w-12 h-12 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center mb-3">
              <CheckCircle2 size={24} strokeWidth={2.2} />
            </div>

            <h3 className="text-base font-semibold text-[#1d1d1f] tracking-tight">
              Reminder Scheduled
            </h3>
            <p className="text-xs text-[#86868b] mt-1 font-normal line-clamp-2 px-1">
              {successReminder.title}
            </p>

            <div className="mt-4 p-3.5 rounded-2xl bg-black/[0.03] border border-black/[0.04]">
              <div className="text-xs font-semibold text-[#1d1d1f]">
                {formatEventReadable(successReminder.eventDate, successReminder.eventTime)}
              </div>
              <div className="text-xs font-semibold text-[#0071e3] mt-1 flex items-center justify-center gap-1.5">
                <Clock size={13} strokeWidth={2.2} />
                <span>{successReminder.remainingText}</span>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setSuccessReminder(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0062cc] text-white text-xs font-semibold shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
