import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
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
import reminderNotificationService, {
  CalendarEvent,
  IndianHoliday,
  INDIAN_HOLIDAYS,
  EventType,
  EventPriority,
  getRemainingTimeInfo,
  formatEventReadable,
} from '../services/reminderNotificationService';
import { useAuth } from '../context/AuthContext';
import { format12HourTime, IST_TIMEZONE } from '../utils/dateTimeUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const { user } = useAuth();
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
  };

  const handleSelectDate = (dateStr: string, targetYear?: number, targetMonth?: number) => {
    setSelectedDateStr(dateStr);
    if (targetYear !== undefined && targetMonth !== undefined && (targetYear !== year || targetMonth !== month)) {
      setCurrentDate(new Date(targetYear, targetMonth, 1));
    }
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

  // Indian Holidays in this month
  const monthlyHolidays = useMemo(() => {
    return reminderNotificationService.getIndianHolidaysForMonth(year, month);
  }, [year, month]);

  // Map of events keyed by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((evt) => {
      if (!map[evt.eventDate]) map[evt.eventDate] = [];
      map[evt.eventDate].push(evt);
    });
    return map;
  }, [events]);

  const holidaysByDate = useMemo(() => {
    const map: Record<string, IndianHoliday> = {};
    INDIAN_HOLIDAYS.forEach((h) => {
      map[h.date] = h;
    });
    return map;
  }, []);

  // Events on selected date
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  const selectedDateHoliday = useMemo(() => {
    return holidaysByDate[selectedDateStr];
  }, [holidaysByDate, selectedDateStr]);

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

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this reminder?')) {
      await reminderNotificationService.deleteEvent(id);
    }
  };

  const handleToggleComplete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await reminderNotificationService.toggleEventComplete(id);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sf-display">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
              Calendar & Reminders
            </h1>
          </div>
          <p className="text-[12px] text-[#86868b] mt-0.5 font-normal">
            Counselor callback schedules, appointments, and Indian public holidays.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="px-3.5 py-1.5 bg-black/[0.05] hover:bg-black/[0.08] text-[#1d1d1f] rounded-full text-[12px] font-medium transition-all active:scale-98"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-full text-[12px] font-medium shadow-xs transition-all active:scale-98"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 7 Cols Calendar + 5 Cols Sidebar Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Apple HIG Inline Calendar Card (7 Cols) */}
        <div className="lg:col-span-7 bg-white/95 backdrop-blur-xl rounded-[24px] border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Apple HIG Month & Navigation Header */}
            <div className="flex items-center justify-between pb-3 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                  {MONTH_NAMES[month]} <span className="text-[#86868b] font-normal">{year}</span>
                </h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#0071e3] hover:bg-[#0071e3]/10 active:scale-95 transition-all cursor-pointer"
                  title="Previous Month"
                  aria-label="Previous Month"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#0071e3] hover:bg-[#0071e3]/10 active:scale-95 transition-all cursor-pointer"
                  title="Next Month"
                  aria-label="Next Month"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Apple HIG Weekday Names Header */}
            <div className="grid grid-cols-7 text-center pb-2.5 border-b border-black/[0.04]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Apple HIG Date Grid Matrix (No chunky badges - Pure Apple Dots) */}
            <div className="grid grid-cols-7 gap-y-1 sm:gap-y-1.5 py-3">
              {allCalendarDays.map((day) => {
                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDateStr;
                const dayHoliday = holidaysByDate[day.dateStr];
                const dayEvents = eventsByDate[day.dateStr] || [];

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => handleSelectDate(day.dateStr, day.targetYear, day.targetMonth)}
                    className="relative flex flex-col items-center justify-center py-1 sm:py-1.5 rounded-[14px] transition-all group hover:bg-black/[0.03] active:scale-95 focus:outline-none cursor-pointer"
                  >
                    {/* Apple Circular Date Indicator */}
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[15px] transition-all ${
                        isSelected
                          ? 'bg-[#0071e3] text-white font-semibold shadow-xs scale-105'
                          : isToday
                          ? 'text-[#0071e3] font-bold bg-[#0071e3]/10'
                          : day.isCurrentMonth
                          ? 'text-[#1d1d1f] font-normal group-hover:text-black'
                          : 'text-[#86868b]/35 font-normal'
                      }`}
                    >
                      {day.dayNum}
                    </div>

                    {/* Apple Dot Indicators (Subtle HIG markers beneath date) */}
                    <div className="h-2 flex items-center justify-center gap-1 mt-0.5">
                      {/* Indian Holiday Dot (Amber) */}
                      {dayHoliday && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#ff9500] shrink-0"
                          title={`Indian Holiday: ${dayHoliday.title}`}
                        />
                      )}

                      {/* Event / Reminder Dots */}
                      {dayEvents.slice(0, dayHoliday ? 2 : 3).map((evt) => (
                        <span
                          key={evt.id}
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            evt.isCompleted
                              ? 'bg-[#8e8e93]/40'
                              : evt.priority === 'HIGH' || evt.priority === 'URGENT'
                              ? 'bg-[#ff3b30]'
                              : evt.eventType === 'CALL'
                              ? 'bg-[#34c759]'
                              : 'bg-[#0071e3]'
                          }`}
                          title={`${evt.title} (${evt.eventTime ? format12HourTime(evt.eventTime) : 'Anytime'})`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Apple HIG Legend Footer */}
          <div className="pt-3 mt-2 border-t border-black/[0.04] flex items-center justify-between text-[11px] text-[#86868b] flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0071e3]" />
                <span className="text-[#515154]">Reminder</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34c759]" />
                <span className="text-[#515154]">Call</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff3b30]" />
                <span className="text-[#515154]">Urgent</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff9500]" />
                <span className="text-[#515154]">Holiday</span>
              </span>
            </div>

            <span className="font-mono text-[10px] text-[#86868b]">
              IST (Asia/Kolkata)
            </span>
          </div>
        </div>

        {/* Right Sidebar: Selected Day Agenda & Indian Holidays (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Date Dossier / Reminders */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[22px] border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.04]">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Daily Agenda
                </h3>
                <p className="text-[15px] font-semibold text-[#1d1d1f] mt-0.5">
                  {selectedDateDisplay}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenModal(selectedDateStr)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#1d1d1f] hover:bg-black text-white rounded-full text-[12px] font-medium transition-all active:scale-95 shadow-2xs"
              >
                <Plus size={11} strokeWidth={2.5} />
                <span>Add</span>
              </button>
            </div>

            {/* Indian Holiday Notice if on this day */}
            {selectedDateHoliday && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[14px]">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-950">
                  <span>🇮🇳</span>
                  <span>{selectedDateHoliday.title}</span>
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-950 rounded-full text-[9px] font-medium">
                    {selectedDateHoliday.type}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 mt-1 leading-relaxed font-normal">
                  {selectedDateHoliday.description}
                </p>
              </div>
            )}

            {/* Reminders List for Selected Day */}
            <div className="space-y-2">
              {selectedDateEvents.length === 0 ? (
                <div className="py-7 text-center text-[#86868b]">
                  <div className="w-10 h-10 rounded-full bg-black/[0.03] flex items-center justify-center mx-auto mb-2 text-[#86868b]">
                    <CalendarCheck size={18} strokeWidth={1.8} />
                  </div>
                  <p className="text-[13px] font-medium text-[#1d1d1f]">No events or reminders</p>
                  <p className="text-[11px] text-[#86868b] mt-0.5">
                    Tap "Add" to schedule a callback or task.
                  </p>
                </div>
              ) : (
                selectedDateEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-[16px] border transition-all flex items-start gap-2.5 group ${
                      evt.isCompleted
                        ? 'bg-black/[0.02] border-black/[0.04] text-[#86868b]'
                        : 'bg-white border-black/[0.05] shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleComplete(evt.id, e)}
                      className="mt-0.5 text-[#86868b] hover:text-[#34c759] transition-colors shrink-0"
                    >
                      {evt.isCompleted ? (
                        <CheckCircle2 size={16} className="text-[#34c759]" strokeWidth={2.2} />
                      ) : (
                        <Circle size={16} strokeWidth={1.8} />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-[13px] font-medium truncate ${evt.isCompleted ? 'line-through text-[#86868b]' : 'text-[#1d1d1f]'}`}>
                          {evt.title}
                        </p>
                        <span className="text-[10px] font-mono text-[#86868b] shrink-0">
                          {evt.eventTime ? format12HourTime(evt.eventTime) : 'All Day'}
                        </span>
                      </div>

                      {evt.description && (
                        <p className="text-[11px] text-[#515154] mt-0.5 leading-relaxed font-normal">
                          {evt.description}
                        </p>
                      )}

                      {evt.candidateName && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#0071e3] font-medium">
                          <User size={11} strokeWidth={2} />
                          <span>Candidate: {evt.candidateName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="px-2 py-0.2 bg-black/[0.04] text-[#515154] rounded-full text-[9px] font-medium uppercase">
                          {evt.eventType}
                        </span>
                        {evt.priority === 'HIGH' || evt.priority === 'URGENT' ? (
                          <span className="px-2 py-0.2 bg-[#ff3b30]/10 text-[#ff3b30] rounded-full text-[9px] font-semibold uppercase">
                            {evt.priority}
                          </span>
                        ) : null}
                        {!evt.isCompleted && (() => {
                          const rem = getRemainingTimeInfo(evt.eventDate, evt.eventTime);
                          if (!rem || rem.isPast) return null;
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 bg-amber-500/10 text-amber-800 rounded-full text-[9px] font-medium border border-amber-500/15">
                              <Clock size={9} />
                              {rem.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(evt.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#86868b] hover:text-[#ff3b30] rounded-full transition-all shrink-0"
                      title="Delete reminder"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Indian Gazetted Holidays this month */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[22px] border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-black/[0.04]">
              <span className="text-base">🇮🇳</span>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#1d1d1f]">
                Indian Holidays ({MONTH_NAMES[month]})
              </h3>
            </div>

            <div className="space-y-2">
              {monthlyHolidays.length === 0 ? (
                <p className="text-[12px] text-[#86868b] py-2 font-normal">
                  No gazetted public holidays in {MONTH_NAMES[month]}.
                </p>
              ) : (
                monthlyHolidays.map((h) => {
                  const [hy, hm, hd] = h.date.split('-').map(Number);
                  const isHSelected = h.date === selectedDateStr;
                  return (
                    <div
                      key={h.date}
                      onClick={() => handleSelectDate(h.date)}
                      className={`p-3 rounded-[16px] border transition-all cursor-pointer ${
                        isHSelected
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-2xs'
                          : 'border-black/[0.04] bg-[#fbfbfd] hover:bg-white hover:border-black/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#1d1d1f] text-[13px]">{h.title}</span>
                        <span className="text-[11px] font-mono text-amber-900 font-semibold px-2 py-0.5 rounded-full bg-amber-500/15">
                          {new Date(hy, hm - 1, hd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#86868b] mt-1 leading-snug font-normal">
                        {h.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Reminder / Event Modal (Apple HIG Glass Sheet UI) */}
      {isModalOpen && (
        <div className="ios-modal-backdrop animate-in fade-in">
          <div className="ios-material-thick rounded-[28px] shadow-2xl border border-white/65 max-w-md w-full !p-0 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="pt-3 pb-1">
              <div className="ios-sheet-grabber" />
            </div>
            <div className="px-5 py-3 border-b border-black/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <BrandReminderIcon size={14} strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                  New Reminder / Event
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[13px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                    Time (IST)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.eventTime}
                    onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                  />
                </div>
              </div>

              {/* Live Dynamic Countdown Preview */}
              {(() => {
                const liveRem = getRemainingTimeInfo(formData.eventDate, formData.eventTime);
                if (!liveRem) return null;
                return (
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-[14px] border text-[11px] transition-all ${
                      liveRem.isPast
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-900'
                        : 'bg-[#0071e3]/[0.07] border-[#0071e3]/20 text-[#0071e3]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <Clock size={12} className="shrink-0" />
                      <span>{liveRem.isPast ? liveRem.text : `⏱ ${liveRem.text}`}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 shrink-0 shadow-2xs">
                      {liveRem.isPast ? 'Passed' : 'IST Countdown'}
                    </span>
                  </div>
                );
              })()}

              {/* Expandable Additional Details Section (Apple HIG Disclosure) */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((prev) => !prev)}
                  className="flex items-center justify-between w-full py-2 px-3 rounded-[12px] bg-black/[0.03] hover:bg-black/[0.06] text-[#0071e3] text-[12px] font-medium transition-all cursor-pointer"
                >
                  <span>{showMoreDetails ? 'Hide Details' : 'More Details'}</span>
                  <ChevronDown
                    size={15}
                    strokeWidth={2.4}
                    className={`transition-transform duration-200 text-[#0071e3] ${
                      showMoreDetails ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showMoreDetails && (
                  <div className="space-y-3.5 pt-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                          Type
                        </label>
                        <select
                          value={formData.eventType}
                          onChange={(e) => setFormData({ ...formData, eventType: e.target.value as EventType })}
                          className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                        >
                          <option value="REMINDER">General Reminder</option>
                          <option value="CALL">Candidate Callback</option>
                          <option value="INTERVIEW">Visa Interview</option>
                          <option value="FOLLOWUP">Doc Follow-up</option>
                          <option value="EVENT">Meeting / Event</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                          Priority
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as EventPriority })}
                          className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High Priority</option>
                          <option value="URGENT">Urgent (Red Alert)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                        Candidate Link (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.candidateName}
                        onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                        className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                        Notify Me Before
                      </label>
                      <select
                        value={formData.remindBeforeMinutes}
                        onChange={(e) => setFormData({ ...formData, remindBeforeMinutes: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                      >
                        <option value={0}>At time of event</option>
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                        <option value={1440}>1 day before</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
                        Notes & Details
                      </label>
                      <textarea
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="p-2.5 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-full text-[12px] font-medium text-[#515154] hover:bg-black/[0.04] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-[12px] font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Reminder</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Apple iOS-Themed Small Confirmation Modal */}
      {successReminder && (
        <div
          className="ios-modal-backdrop animate-in fade-in duration-200 z-[70]"
          onClick={() => setSuccessReminder(null)}
        >
          <div
            className="ios-material-thick rounded-[28px] shadow-2xl border border-white/65 max-w-[340px] w-full p-6 text-center animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setSuccessReminder(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              title="Close"
            >
              <X size={13} strokeWidth={2.5} />
            </button>

            {/* Apple iOS System Icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center mb-3">
              <CheckCircle2 size={24} strokeWidth={2.2} />
            </div>

            {/* Clean Apple iOS Header & Title */}
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">
              Reminder Scheduled
            </h3>
            <p className="text-[13px] text-[#86868b] mt-1 font-normal line-clamp-2 px-1">
              {successReminder.title}
            </p>

            {/* iOS Grouped Inset Card */}
            <div className="mt-4 p-3.5 rounded-[16px] bg-[#f5f5f7] border border-black/[0.03]">
              <div className="text-[13px] font-medium text-[#1d1d1f]">
                {formatEventReadable(successReminder.eventDate, successReminder.eventTime)}
              </div>
              <div className="text-[12px] font-medium text-[#0071e3] mt-1 flex items-center justify-center gap-1.5">
                <Clock size={13} strokeWidth={2.2} />
                <span>{successReminder.remainingText} remaining</span>
              </div>
            </div>

            {/* Apple iOS Primary Action Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setSuccessReminder(null)}
                className="w-full py-2.5 px-4 rounded-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-[14px] font-semibold shadow-xs transition-all active:scale-98"
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
