import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
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
  Bell,
  X,
  Filter,
} from 'lucide-react';
import reminderNotificationService, {
  CalendarEvent,
  IndianHoliday,
  INDIAN_HOLIDAYS,
  EventType,
  EventPriority,
} from '../services/reminderNotificationService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'REMINDER' | 'CALL' | 'HOLIDAY'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    eventTime: '10:00',
    eventType: 'REMINDER' as EventType,
    priority: 'MEDIUM' as EventPriority,
    candidateName: '',
    remindBeforeMinutes: 15,
  });

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

  // Calendar Math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

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

  // Open modal for a specific date
  const handleOpenModal = (dateStr?: string) => {
    const d = dateStr || selectedDateStr;
    setFormData({
      title: '',
      description: '',
      eventDate: d,
      eventTime: '11:00',
      eventType: 'REMINDER',
      priority: 'MEDIUM',
      candidateName: '',
      remindBeforeMinutes: 15,
    });
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await reminderNotificationService.saveEvent({
      userId: 'current',
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
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[10px] font-semibold rounded-full uppercase tracking-wider flex items-center gap-1">
              <span>🇮🇳</span> Indian Calendar (IST)
            </span>
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

      {/* Main Grid: 8 Cols Calendar + 4 Cols Sidebar Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar Grid (8 Cols) */}
        <div className="lg:col-span-8 bg-white/90 backdrop-blur-xl rounded-[22px] border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          {/* Calendar Month Navigation Header */}
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between bg-[#fbfbfd]">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-semibold text-[#1d1d1f] tracking-tight">
                {MONTH_NAMES[month]} {year}
              </h2>
              <span className="text-[11px] font-normal text-[#86868b]">
                IST (UTC+5:30)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-black/[0.04] rounded-full p-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 flex items-center justify-center text-[#1d1d1f] hover:bg-white rounded-full transition-all shadow-2xs"
                title="Previous Month"
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 flex items-center justify-center text-[#1d1d1f] hover:bg-white rounded-full transition-all shadow-2xs"
                title="Next Month"
              >
                <ChevronRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 border-b border-black/[0.04] bg-[#fbfbfd]/70 text-center text-[11px] font-medium text-[#86868b] py-2">
            {WEEKDAYS.map((day, idx) => (
              <div key={day} className={idx === 0 ? 'text-[#ff3b30]' : ''}>
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-100 bg-slate-50/30">
            {/* Blank leading days from previous month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[96px] bg-slate-50/60 p-1.5 opacity-40 select-none" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDateStr;
              const dayHoliday = holidaysByDate[dateStr];
              const dayEvents = eventsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`min-h-[96px] p-1.5 transition-colors cursor-pointer group flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-500'
                      : isToday
                      ? 'bg-amber-50/30'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all ${
                        isToday
                          ? 'bg-[#0071e3] text-white shadow-2xs'
                          : isSelected
                          ? 'bg-[#1d1d1f] text-white shadow-2xs'
                          : 'text-[#1d1d1f]'
                      }`}
                    >
                      {dayNum}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(dateStr);
                      }}
                      title="Add reminder for this day"
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center hover:bg-black/[0.06] rounded-full text-[#86868b] hover:text-[#1d1d1f] transition-all"
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Day Content Badges */}
                  <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                    {/* Indian Holiday Badge */}
                    {dayHoliday && (
                      <div
                        title={`Indian Holiday: ${dayHoliday.title} (${dayHoliday.description})`}
                        className="px-1.5 py-0.5 bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded-[6px] text-[9px] font-medium truncate flex items-center gap-1"
                      >
                        <span className="shrink-0">🇮🇳</span>
                        <span className="truncate">{dayHoliday.title}</span>
                      </div>
                    )}

                    {/* Events & Reminders */}
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id}
                        title={`${evt.title} (${evt.eventTime || 'Anytime'})`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1 ${
                          evt.isCompleted
                            ? 'bg-slate-100 text-slate-400 line-through'
                            : evt.eventType === 'CALL'
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : evt.priority === 'HIGH' || evt.priority === 'URGENT'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {evt.eventType === 'CALL' ? (
                          <Phone size={9} className="shrink-0" />
                        ) : (
                          <Clock size={9} className="shrink-0" />
                        )}
                        <span className="truncate">{evt.title}</span>
                      </div>
                    ))}

                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-slate-400 font-medium pl-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Selected Day Agenda & Indian Holidays (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Date Dossier / Reminders */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[22px] border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.04]">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Daily Agenda
                </h3>
                <p className="text-[15px] font-semibold text-[#1d1d1f] mt-0.5">
                  {new Date(selectedDateStr).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
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
                          {evt.eventTime || 'All Day'}
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

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="px-2 py-0.2 bg-black/[0.04] text-[#515154] rounded-full text-[9px] font-medium uppercase">
                          {evt.eventType}
                        </span>
                        {evt.priority === 'HIGH' || evt.priority === 'URGENT' ? (
                          <span className="px-2 py-0.2 bg-[#ff3b30]/10 text-[#ff3b30] rounded-full text-[9px] font-semibold uppercase">
                            {evt.priority}
                          </span>
                        ) : null}
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
                monthlyHolidays.map((h) => (
                  <div
                    key={h.date}
                    onClick={() => setSelectedDateStr(h.date)}
                    className="p-2.5 rounded-[14px] border border-black/[0.03] hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1d1d1f] text-[12px]">{h.title}</span>
                      <span className="text-[10px] font-mono text-amber-900 font-semibold">
                        {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86868b] mt-0.5 leading-snug font-normal">
                      {h.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Reminder / Event Modal (Apple iOS Sheet Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[26px] shadow-[0_25px_60px_rgba(0,0,0,0.18)] border border-black/[0.06] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Bell size={14} strokeWidth={2.2} />
                </div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
                  New Reminder / Event
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors"
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
                  placeholder="e.g. Call candidate regarding IELTS score"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
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
                  placeholder="e.g. Praveen Selvaraj / Lead #101"
                  value={formData.candidateName}
                  onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
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
                  placeholder="Additional notes for this reminder..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#f5f5f7] border border-black/[0.04] rounded-[12px] text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[12px] font-medium text-[#515154] hover:bg-black/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-[12px] font-medium shadow-xs transition-all active:scale-95"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
