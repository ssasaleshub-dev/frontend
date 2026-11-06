import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UploadCloud,
  MessageSquare,
  LogOut,
  Menu,
  X,
  UserCog,
  Camera,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  CheckCircle2,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { isAdmin as checkIsAdmin, getRoleBadgeInfo, getDisplayName } from '../utils/rbac';
import fileService from '../services/api/fileService';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import brandLogo from '../assets/brand-logo.jpg';

export default function Layout() {
  const { user, logout, updateUserAvatar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [userMenuOpen]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await fileService.uploadFile(file, 'avatars');
      if (res?.url) {
        await updateUserAvatar(res.url);
      }
    } catch (err: any) {
      alert(`Failed to upload avatar: ${err?.message || 'Server error'}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const isAdmin = checkIsAdmin(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const displayName = getDisplayName(user);
  const userInitial = (displayName?.[0] || 'S').toUpperCase();

  const [todayAttendance, setTodayAttendance] = useState<StaffAttendanceRecord | null>(null);

  useEffect(() => {
    const currentUserId = user?.login || (user?.id ? String(user.id) : '');
    if (!currentUserId) return;

    const fetchAttendance = async () => {
      try {
        const res = await attendanceService.getTodayAttendance(currentUserId);
        setTodayAttendance(res);
      } catch {
        // fallback
      }
    };

    fetchAttendance();
    window.addEventListener('ssa_attendance_updated', fetchAttendance);
    return () => window.removeEventListener('ssa_attendance_updated', fetchAttendance);
  }, [user]);

  const currentPath = location.pathname;

  // Real navigation items matching actual application routes
  const navItems = [
    {
      id: 'dashboards',
      label: 'Dashboards',
      icon: LayoutDashboard,
      to: '/',
      exact: true,
    },
    {
      id: 'leads',
      label: 'Candidate Leads',
      icon: Users,
      to: '/leads',
      exact: false,
    },
    {
      id: 'customers',
      label: 'Contacts',
      icon: UserCheck,
      to: '/customers',
      exact: false,
    },
    {
      id: 'calendar',
      label: 'Calendar & Reminders',
      icon: Calendar,
      to: '/calendar',
      exact: false,
    },
    {
      id: 'attendance',
      label: 'Staff Attendance',
      icon: Clock,
      to: '/attendance',
      exact: false,
    },
    {
      id: 'chat',
      label: 'Team Chat',
      icon: MessageSquare,
      to: '/chat',
      exact: false,
    },
    {
      id: 'profile',
      label: 'My Profile Desk',
      icon: User,
      to: '/profile',
      exact: false,
    },
    ...(isAdmin
      ? [
          {
            id: 'import',
            label: 'Data Ingestion',
            icon: UploadCloud,
            to: '/import',
            exact: false,
          },
          {
            id: 'users',
            label: 'User Management',
            icon: UserCog,
            to: '/users',
            exact: false,
          },
        ]
      : []),
  ];

  const getPageInfo = () => {
    if (currentPath === '/') return { title: 'Executive Overview', subtitle: 'Real-time candidate metrics & counselor pipelines' };
    if (currentPath.startsWith('/leads')) return { title: 'Candidate Leads Pipeline', subtitle: 'Filter, triage, and contact international visa candidates' };
    if (currentPath.startsWith('/customers')) return { title: 'Contacts', subtitle: 'Verified contacts and customer records' };
    if (currentPath.startsWith('/calendar')) return { title: 'Calendar & Reminders', subtitle: 'Indian public holidays, counselor callbacks & appointment schedule' };
    if (currentPath.startsWith('/attendance')) return { title: 'Staff Attendance & Roster', subtitle: 'Daily check-in, check-out punches, duration tracking, and corporate register' };
    if (currentPath.startsWith('/profile')) return { title: 'Staff Profile & Shift Desk', subtitle: 'Counselor credentials, shift records, and personal attendance history' };
    if (currentPath.startsWith('/import')) return { title: 'Data Ingestion', subtitle: 'Import Meta ads export spreadsheets & raw lead data' };
    if (currentPath.startsWith('/chat')) return { title: 'Team Chat', subtitle: 'Internal messaging and staff communication' };
    if (currentPath.startsWith('/users')) return { title: 'Team & Permissions', subtitle: 'Manage counselor assignments, roles, and access desks' };
    return { title: 'SSA CRM', subtitle: 'Work & Study Visa Consultancy' };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex flex-col md:flex-row font-sans text-slate-900 antialiased selection:bg-[#007aff] selection:text-white">
      {/* Mobile Top Bar */}
      <div className="md:hidden ios-glass text-slate-900 px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <img src={brandLogo} alt="SSA Logo" className="w-8 h-8 rounded-xl object-cover shadow-xs border border-black/[0.06]" />
          <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">SSA CRM</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-black/[0.05] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Apple macOS Frosted Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-30 inset-y-0 left-0 bg-[#0d1627]/95 backdrop-blur-2xl text-white flex flex-col justify-between border-r border-white/5 transition-all duration-200 ease-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'w-18' : 'w-60'} h-screen shrink-0`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className={`p-4 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-left focus:outline-none group min-w-0"
              title="SSA CRM - Home"
            >
              <img
                src={brandLogo}
                alt="SSA Logo"
                className="w-9 h-9 rounded-xl object-cover shadow-xs border border-white/20 shrink-0 group-hover:scale-102 transition-transform"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h2 className="font-bold text-sm tracking-tight text-white truncate leading-tight">
                    SSA CRM
                  </h2>
                </div>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? currentPath === item.to
                : currentPath.startsWith(item.to);

              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    sidebarCollapsed ? 'justify-center px-2' : ''
                  } ${
                    isActive
                      ? 'bg-[#007aff] text-white shadow-[0_2px_8px_rgba(0,122,255,0.35)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Counselor & Control Section */}
        <div className="p-3 border-t border-white/10 flex flex-col gap-2 shrink-0">
          {/* Counselor Profile Details */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2.5`}>
            <div className="relative shrink-0">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title={`Logged in as ${displayName} (${badgeInfo.displayText}) - Click to update photo`}
                className="relative group w-8 h-8 rounded-full overflow-hidden bg-white/10 text-white font-medium text-xs flex items-center justify-center border border-white/15 focus:outline-none"
              >
                {uploadingAvatar ? (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-white">
                    <Loader2 size={13} className="animate-spin" />
                  </div>
                ) : user?.imageUrl ? (
                  <img src={user.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/15 text-white font-semibold text-xs flex items-center justify-center">
                    {userInitial}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Camera size={11} />
                </div>
              </button>
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="min-w-0 flex-1 text-left focus:outline-none group"
                title="View Staff Profile & Shift Desk"
              >
                <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-blue-300 transition-colors">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {badgeInfo.displayText}
                </p>
              </button>
            )}

            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors shrink-0"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Apple macOS Translucent Header */}
        <header className="ios-glass px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
              {pageInfo.title}
            </h1>
            <p className="text-[11px] text-slate-500 truncate hidden sm:block">
              {pageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Attendance Punch Pill */}
            {todayAttendance?.checkInTime && !todayAttendance?.checkOutTime ? (
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] text-emerald-950 text-xs font-medium shadow-xs transition-all active:scale-95 group"
                title="Shift active - Click to view attendance"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                <span className="font-semibold text-emerald-900 tracking-tight">On Duty</span>
                {todayAttendance?.checkInTime && (
                  <span className="text-[11px] text-emerald-700/80 font-mono pl-1 border-l border-emerald-600/20">
                    {new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
            ) : todayAttendance?.checkOutTime ? (
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200/80 bg-slate-100/70 hover:bg-slate-200/60 text-slate-700 text-xs font-medium shadow-xs transition-all active:scale-95"
                title="Today's shift completed"
              >
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Shift Completed</span>
                {todayAttendance.totalHoursFormatted && (
                  <span className="text-[11px] text-slate-500 font-mono pl-1 border-l border-slate-300">
                    {todayAttendance.totalHoursFormatted}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white/80 hover:bg-white text-slate-700 text-xs font-medium shadow-xs transition-all active:scale-95 backdrop-blur-md"
                title="Punch in for today's shift"
              >
                <Clock size={13} className="text-slate-500" />
                <span>Punch In</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => navigate('/import')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white text-slate-800 text-xs font-semibold shadow-xs transition-all active:scale-95 backdrop-blur-md"
                title="Excel / Spreadsheet Ingestion"
              >
                <UploadCloud size={13} className="text-[#007aff]" />
                <span>Ingest Excel</span>
              </button>
            )}

            {/* Header Utility Icons: Calendar & Notification Bell */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none ${
                  currentPath.startsWith('/calendar')
                    ? 'bg-[#0071e3]/10 text-[#0071e3]'
                    : 'text-[#48484a] hover:text-[#1d1d1f] hover:bg-black/[0.05] active:bg-black/[0.08]'
                }`}
                title="Calendar & Indian Holidays"
                aria-label="Calendar"
              >
                <Calendar size={17} strokeWidth={2} />
              </button>

              <NotificationBell />
            </div>

            {/* Header User Section - Click avatar for dropdown, logout inside */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200" ref={userMenuRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 text-left focus:outline-none group"
                  title="Profile & Account"
                >
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 group-hover:ring-2 group-hover:ring-[#007aff]/30 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#eaecf0] text-[#344054] font-semibold text-xs flex items-center justify-center shrink-0 uppercase group-hover:ring-2 group-hover:ring-[#007aff]/30 transition-all">
                      {userInitial}
                    </div>
                  )}
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-[#1e293b] leading-tight group-hover:text-[#007aff] transition-colors">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-[#64748b] font-normal leading-tight mt-0.5">
                      {badgeInfo.displayText}
                    </span>
                  </div>
                </button>

                {/* User Dropdown Menu (Apple HIG Glass Menu) */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 ios-material-thick !p-0 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.22)] border border-white/60 z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-150">
                    {/* Profile info top */}
                    <div className="px-4 py-3 border-b border-black/[0.05]">
                      <p className="text-xs font-semibold text-[#1c1c1e] truncate">{displayName}</p>
                      <p className="text-[11px] text-[#8e8e93] mt-0.5">{badgeInfo.displayText}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      <button
                        type="button"
                        onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#1c1c1e] hover:bg-[#f2f2f7] flex items-center gap-2.5 transition-colors"
                      >
                        <User size={14} className="text-[#8e8e93]" />
                        View Profile
                      </button>
                    </div>

                    {/* Logout - red destructive at bottom */}
                    <div className="py-1.5 border-t border-black/[0.05]">
                      <button
                        type="button"
                        onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#ff3b30] hover:bg-[#ff3b30]/[0.06] flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut size={14} />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-20 md:hidden"
        />
      )}
    </div>
  );
}

