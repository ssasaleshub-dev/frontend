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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Calendar & Reminders
            </h1>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">
              <span>🇮🇳</span> Indian Calendar (IST)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track counselor callback reminders, visa appointments, and Indian public holidays.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0066cc] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 8 Cols Calendar + 4 Cols Sidebar Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar Grid (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          {/* Calendar Month Navigation Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900">
                {MONTH_NAMES[month]} {year}
              </h2>
              <span className="text-[11px] font-medium text-slate-500">
                IST (UTC+5:30)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-semibold text-slate-500 py-2">
            {WEEKDAYS.map((day, idx) => (
              <div key={day} className={idx === 0 ? 'text-rose-600' : ''}>
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        isToday
                          ? 'bg-[#0066cc] text-white'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700'
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
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-opacity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Day Content Badges */}
                  <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                    {/* Indian Holiday Badge */}
                    {dayHoliday && (
                      <div
                        title={`Indian Holiday: ${dayHoliday.title} (${dayHoliday.description})`}
                        className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded text-[9px] font-bold truncate flex items-center gap-0.5"
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
        <div className="lg:col-span-4 space-y-5">
          {/* Selected Date Dossier / Reminders */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daily Agenda
                </h3>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
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
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>

            {/* Indian Holiday Notice if on this day */}
            {selectedDateHoliday && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <span>🇮🇳</span>
                  <span>{selectedDateHoliday.title}</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 text-amber-950 rounded text-[9px] font-semibold">
                    {selectedDateHoliday.type}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  {selectedDateHoliday.description}
                </p>
              </div>
            )}

            {/* Reminders List for Selected Day */}
            <div className="space-y-2">
              {selectedDateEvents.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <CalendarCheck size={28} className="mx-auto mb-1.5 opacity-40 text-slate-400" />
                  <p className="text-xs font-medium text-slate-600">No events or reminders</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click "Add" to schedule a callback, interview or task.
                  </p>
                </div>
              ) : (
                selectedDateEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-lg border transition-all flex items-start gap-2.5 group ${
                      evt.isCompleted
                        ? 'bg-slate-50 border-slate-200 text-slate-400'
                        : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleComplete(evt.id, e)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                    >
                      {evt.isCompleted ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${evt.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {evt.title}
                        </p>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {evt.eventTime || 'All Day'}
                        </span>
                      </div>

                      {evt.description && (
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {evt.description}
                        </p>
                      )}

                      {evt.candidateName && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-blue-700 font-medium">
                          <User size={11} />
                          <span>Candidate: {evt.candidateName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-medium uppercase">
                          {evt.eventType}
                        </span>
                        {evt.priority === 'HIGH' || evt.priority === 'URGENT' ? (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-bold uppercase">
                            {evt.priority}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(evt.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity shrink-0"
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <span className="text-base">🇮🇳</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Indian Holidays ({MONTH_NAMES[month]})
              </h3>
            </div>

            <div className="space-y-2">
              {monthlyHolidays.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No gazetted public holidays in {MONTH_NAMES[month]}.
                </p>
              ) : (
                monthlyHolidays.map((h) => (
                  <div
                    key={h.date}
                    onClick={() => setSelectedDateStr(h.date)}
                    className="p-2.5 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{h.title}</span>
                      <span className="text-[10px] font-mono text-amber-800 font-bold">
                        {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {h.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Reminder / Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Create Reminder / Event
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call Praveen regarding IELTS certificate"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Time (IST)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.eventTime}
                    onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Type
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value as EventType })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="REMINDER">General Reminder</option>
                    <option value="CALL">Candidate Callback</option>
                    <option value="INTERVIEW">Visa Interview</option>
                    <option value="FOLLOWUP">Doc Follow-up</option>
                    <option value="EVENT">Meeting / Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as EventPriority })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent (Red Alert)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Candidate Link (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Praveen Selvaraj / Lead #101"
                  value={formData.candidateName}
                  onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notify Me Before
                </label>
                <select
                  value={formData.remindBeforeMinutes}
                  onChange={(e) => setFormData({ ...formData, remindBeforeMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>At time of event</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional notes for this reminder..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#0066cc] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
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
