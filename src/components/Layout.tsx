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
  Bell,
  Fingerprint,
  BarChart3,
  FileBarChart2,
  Blocks,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import AppleNotificationBanner from './AppleNotificationBanner';
import { ButtonSpinner } from './common/SmallLoader';
import notificationWebSocket from '../services/websocket/notificationWebSocket';
import teamChatWebSocket from '../services/websocket/teamChatWebSocket';
import PullToRefresh from './common/PullToRefresh';
import notificationBannerService from '../services/banner/notificationBannerService';
import playIPhoneNotificationSound from '../utils/appleSound';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { isAdmin as checkIsAdmin, getRoleBadgeInfo, getDisplayName } from '../utils/rbac';
import fileService from '../services/api/fileService';
import attendanceService, { StaffAttendanceRecord } from '../services/api/attendanceService';
import { formatIndianTime } from '../utils/dateTimeUtils';
import { Capacitor } from '@capacitor/core';
import brandLogo from '../assets/brand-logo.jpg';

export default function Layout() {
  const { user, logout, updateUserAvatar } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Monitor chat conversation modal state to hide bottom navigation
  useEffect(() => {
    const checkChatOpen = () => {
      setIsChatOpen(document.body.classList.contains('chat-conversation-open'));
    };
    const observer = new MutationObserver(checkChatOpen);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    checkChatOpen();
    return () => observer.disconnect();
  }, []);

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

  // Connect to Real-Time WebSocket Microservices (Team Chat on 8085, Notifications on 8086)
  useEffect(() => {
    if (user) {
      notificationWebSocket.connect(user);
      teamChatWebSocket.connect(user);
    }
  }, [user]);

  // Global Real-Time Chat message listener for cross-page alerts & desktop notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribe = teamChatWebSocket.onMessage((incomingMsg) => {
      // Don't notify the user about their own messages!
      const currentId = user.id ? Number(user.id) : undefined;
      const currentLogin = user.login ? user.login.toLowerCase() : '';
      const msgUserId = incomingMsg.userId ? Number(incomingMsg.userId) : undefined;
      const msgUserLogin = incomingMsg.userLogin ? incomingMsg.userLogin.toLowerCase() : '';

      if (
        (currentId && msgUserId && currentId === msgUserId) ||
        (currentLogin && msgUserLogin && currentLogin === msgUserLogin)
      ) {
        return;
      }

      // Check if user is currently on the chat page and if tab is visible
      const isOnChatPage = location.pathname.startsWith('/chat');
      const isDocumentHidden = typeof document !== 'undefined' && document.hidden;

      const senderName = incomingMsg.userName || incomingMsg.userLogin || 'Colleague';
      const messagePreview = incomingMsg.content || (incomingMsg.mediaUrl ? '📎 Sent an attachment' : 'Sent a message');

      // 1. Play Apple notification tone whenever another person sends a message
      playIPhoneNotificationSound();

      // 2. Show in-app Apple Notification Banner ONLY on Desktop Web, NEVER on Android app!
      if (!isOnChatPage && !Capacitor.isNativePlatform()) {
        notificationBannerService.show({
          title: `New Message from ${senderName}`,
          description: messagePreview,
          type: 'CHAT',
          timestamp: 'now',
          url: '/chat',
        });
      }

      // 3. Show native Chrome / Windows desktop notification if permission is granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const isWindowFocused = typeof document !== 'undefined' && document.hasFocus();
        // Show desktop alert if window is not focused, or tab is hidden, or user is browsing another page
        if (!isWindowFocused || isDocumentHidden || !isOnChatPage) {
          try {
            const notif = new Notification(senderName, {
              body: messagePreview,
              icon: '/favicon.png',
              badge: '/favicon.png',
              tag: `chat-${incomingMsg.id || Date.now()}`,
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
              navigate('/chat');
            };
          } catch (e) {
            console.warn('[Layout] Browser Notification error:', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [user, location.pathname, navigate]);

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
      showAlert({ title: 'Avatar', message: `Failed to upload avatar: ${err?.message || 'Server error'}` });
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

    const fetchAttendance = async (force = false) => {
      try {
        const res = await attendanceService.getTodayAttendance(currentUserId, force);
        setTodayAttendance(res);
      } catch {
        // fallback
      }
    };

    fetchAttendance(false);
    const handleUpdate = () => fetchAttendance(true);
    window.addEventListener('ssa_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ssa_attendance_updated', handleUpdate);
  }, [user?.login || user?.id]);

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
      id: 'campaigns',
      label: 'Campaigns',
      icon: BarChart3,
      to: '/campaigns',
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
      id: 'chat',
      label: 'Team Chat',
      icon: MessageSquare,
      to: '/chat',
      exact: false,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      to: '/notifications',
      exact: false,
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: User,
      to: '/profile',
      exact: false,
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Blocks,
      to: '/integrations',
      exact: false,
    },
    ...(isAdmin
      ? [
        {
          id: 'reports',
          label: 'Executive Reports',
          icon: FileBarChart2,
          to: '/reports',
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
        {
          id: 'biometrics',
          label: 'Biometric Approvals',
          icon: Fingerprint,
          to: '/biometrics',
          exact: false,
        },
      ]
      : []),
  ];

  const HomeNavIcon: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({ size = 20, className }) => (
    <img src="/icons/home.png" alt="Home" className={className || ''} style={{ width: size, height: size, objectFit: 'contain' }} />
  );

  const ProfileNavIcon: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({ size = 20, className }) => (
    <img src="/icons/profile.png" alt="Profile" className={className || ''} style={{ width: size, height: size, objectFit: 'contain' }} />
  );

  // Bottom nav items — core tabs for mobile thumb-zone (Notification bell is in top header)
  const bottomNavItems = [
    { id: 'dashboards', label: 'Home', icon: HomeNavIcon as any, to: '/', exact: true },
    { id: 'leads', label: 'Leads', icon: Users, to: '/leads', exact: false },
    { id: 'campaigns', label: 'Campaigns', icon: BarChart3, to: '/campaigns', exact: false },
    { id: 'chat', label: 'Chat', icon: MessageSquare, to: '/chat', exact: false },
    { id: 'calendar', label: 'Calendar', icon: Calendar, to: '/calendar', exact: false },
    { id: 'profile', label: 'Profile', icon: ProfileNavIcon as any, to: '/profile', exact: false },
  ];

  const getPageInfo = () => {
    if (currentPath === '/') return { title: 'Executive Overview' };
    if (currentPath.startsWith('/leads')) return { title: 'Candidates & Leads Directory' };
    if (currentPath.startsWith('/campaigns')) return { title: 'Campaigns & Ads' };
    if (currentPath.startsWith('/customers')) return { title: 'Contacts' };
    if (currentPath.startsWith('/calendar')) return { title: 'Calendar & Reminders' };
    if (currentPath.startsWith('/attendance')) return { title: 'Staff Attendance & Roster' };
    if (currentPath.startsWith('/profile')) return { title: 'Staff Profile' };
    if (currentPath.startsWith('/import')) return { title: 'Data Ingestion', subtitle: 'Import Meta ads export spreadsheets & raw lead data' };
    if (currentPath.startsWith('/chat')) return { title: 'Team Chat' };
    if (currentPath.startsWith('/notifications')) return { title: 'Notifications' };
    if (currentPath.startsWith('/users')) return { title: 'Team & Permissions', subtitle: 'Manage counselor assignments, roles, and access permissions' };
    if (currentPath.startsWith('/reports')) return { title: 'Executive Reports & Analytics' };
    if (currentPath.startsWith('/biometrics')) return { title: 'Biometric Approvals' };
    if (currentPath.startsWith('/integrations')) return { title: 'Integrations Hub', subtitle: 'Google Workspace, Inbound Webhooks & Connectors' };
    return { title: 'SSA SalesHub CRM', subtitle: 'Work & Study Visa Consultancy' };
  };

  const pageInfo = getPageInfo();

  return (
    <div
      className={`min-h-screen ${currentPath.startsWith('/notifications') || currentPath.startsWith('/chat') || currentPath.startsWith('/leads') || currentPath.startsWith('/reports')
          ? 'bg-[#f4f5f7]'
          : 'bg-[#f2f2f7]'
        } flex flex-col md:flex-row font-sans text-slate-900 antialiased selection:bg-[#007aff] selection:text-white`}
    >
      {/* Apple HIG Real-Time In-App Notification Banner Popup */}
      <AppleNotificationBanner />

      {/* Mobile Top Bar - Solid Opaque White (Zero Bleed-through) */}
      {!currentPath.startsWith('/leads') && !currentPath.startsWith('/notifications') && !currentPath.startsWith('/chat') && (
        <div className="md:hidden bg-white text-slate-900 px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-black/[0.08] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <img src={brandLogo} alt="SSA Logo" className="w-8 h-8 rounded-xl object-cover shadow-xs border border-black/[0.06]" />
            <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">SSA SalesHub CRM</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
          </div>
        </div>
      )}

      {/* Apple macOS Frosted Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-30 inset-y-0 left-0 bg-[#0d1627]/95 backdrop-blur-2xl text-white flex flex-col justify-between border-r border-white/5 transition-all duration-200 ease-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } ${sidebarCollapsed ? 'w-18' : 'w-60'} h-screen shrink-0`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className={`p-4 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-left focus:outline-none group min-w-0"
              title="SSA SalesHub CRM - Home"
            >
              <img
                src={brandLogo}
                alt="SSA Logo"
                className="w-9 h-9 rounded-xl object-cover shadow-xs border border-white/20 shrink-0 group-hover:scale-102 transition-transform"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h2 className="font-bold text-sm tracking-tight text-white truncate leading-tight">
                    SSA SalesHub CRM
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${sidebarCollapsed ? 'justify-center px-2' : ''
                    } ${isActive
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
                    <ButtonSpinner size="xs" color="white" />
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
                title="View My Profile"
              >
                <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-blue-300 transition-colors">
                  {displayName}
                </p>
                {isAdmin && (
                  <p className="text-[11px] text-slate-400 truncate">
                    {badgeInfo.displayText}
                  </p>
                )}
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
      <div className={`flex-1 flex flex-col min-w-0 ${currentPath.startsWith('/leads') ? 'bg-[#f4f5f7]' : ''}`}>
        {/* Desktop Header - Solid Clean White (Hidden on Mobile) */}
        <header className="hidden md:flex bg-white px-4 sm:px-6 py-3 items-center justify-between sticky top-0 z-30 border-b border-black/[0.08] shadow-2xs">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle && (
              <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                {pageInfo.subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Attendance Status Pill (Staff / Counselors Only when on active shift) */}
            {!isAdmin && todayAttendance?.checkInTime && !todayAttendance?.checkOutTime && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-all cursor-pointer"
                title="Shift active - Click to view attendance"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800">On Duty</span>
                {todayAttendance?.checkInTime && (
                  <span className="text-[11px] text-slate-500 pl-1 border-l border-slate-200">
                    {formatIndianTime(todayAttendance.checkInTime)}
                  </span>
                )}
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
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none ${currentPath.startsWith('/calendar')
                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                  : 'text-[#48484a] hover:text-[#1d1d1f] hover:bg-black/[0.05] active:bg-black/[0.08]'
                  }`}
                title="Calendar & Indian Holidays"
                aria-label="Calendar"
              >
                <Calendar size={17} strokeWidth={2} />
              </button>

              <div className="hidden md:block">
                <NotificationBell />
              </div>
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
                    {isAdmin && (
                      <span className="text-[11px] text-[#64748b] font-normal leading-tight mt-0.5">
                        {badgeInfo.displayText}
                      </span>
                    )}
                  </div>
                </button>

                {/* User Dropdown Menu (Apple HIG Popover Surface - Zero Bleed-through) */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white !p-0 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.16)] border border-black/[0.08] z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-150">
                    {/* Profile info top */}
                    <div className="px-4 py-3 border-b border-black/[0.05]">
                      <p className="text-xs font-semibold text-[#1c1c1e] truncate">{displayName}</p>
                      {isAdmin && (
                        <p className="text-[11px] text-[#8e8e93] mt-0.5">{badgeInfo.displayText}</p>
                      )}
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      <button
                        type="button"
                        onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#1c1c1e] hover:bg-[#f2f2f7] flex items-center gap-2.5 transition-colors"
                      >
                        <User size={14} className="text-[#8e8e93]" />
                        My Profile
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => { navigate('/attendance'); setUserMenuOpen(false); }}
                            className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#1c1c1e] hover:bg-[#f2f2f7] flex items-center gap-2.5 transition-colors"
                          >
                            <Clock size={14} className="text-[#8e8e93]" />
                            Staff Attendance
                          </button>
                          <button
                            type="button"
                            onClick={() => { navigate('/users'); setUserMenuOpen(false); }}
                            className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#1c1c1e] hover:bg-[#f2f2f7] flex items-center gap-2.5 transition-colors"
                          >
                            <UserCog size={14} className="text-[#8e8e93]" />
                            User Management
                          </button>
                        </>
                      )}
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
        <main
          className={`flex-1 ${currentPath.startsWith('/notifications')
            ? 'p-0 bg-[#f4f5f7] max-w-full pb-20 md:pb-0'
            : currentPath.startsWith('/chat')
              ? 'p-0 max-w-full pb-0 md:pb-0 bg-[#f4f5f7]'
              : currentPath === '/leads'
                ? 'p-0 md:p-5 lg:p-6 max-w-[1440px] pb-20 md:pb-0 bg-[#f4f5f7]'
                : currentPath.startsWith('/leads/')
                  ? 'p-0 bg-[#f4f5f7] max-w-full pb-20 md:pb-0'
                  : currentPath.startsWith('/profile')
                    ? 'p-0 max-w-[1440px] pb-20 md:pb-0'
                    : 'p-3.5 sm:p-5 lg:p-6 max-w-[1440px] pb-20 md:pb-0'
            } w-full mx-auto`}
        >
          <PullToRefresh>
            <Outlet />
          </PullToRefresh>
        </main>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-20 md:hidden"
        />
      )}

      {/* ── Mobile Bottom Navigation Bar (Docked Edge-to-Edge) ── */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-black/[0.08] shadow-[0_-2px_10px_rgba(0,0,0,0.03)] ${isChatOpen ? '!hidden pointer-events-none' : ''}`}>
        <div
          className="flex items-center justify-around px-0.5 pt-1.5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? currentPath === item.to
              : currentPath.startsWith(item.to);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 flex-1 min-w-0 transition-colors duration-150 ${isActive ? 'text-[#007aff]' : 'text-[#8e8e93] hover:text-slate-700'
                  }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} className="shrink-0" />
                <span className={`text-[10px] font-semibold leading-tight tracking-tight truncate max-w-full text-center ${isActive ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

