import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Megaphone,
  UploadCloud,
  MessageSquare,
  LogOut,
  Menu,
  X,
  UserCog,
  Plus,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isAdmin as checkIsAdmin, getRoleBadgeInfo, getDisplayName } from '../utils/rbac';
import brandLogo from '../assets/brand-logo.jpg';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = checkIsAdmin(user);
  const badgeInfo = getRoleBadgeInfo(user);
  const displayName = getDisplayName(user);
  const userInitial = (displayName?.[0] || 'S').toUpperCase();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/leads', label: 'Candidate Leads', icon: Users, exact: false },
    { to: '/customers', label: 'Candidate Directory', icon: UserCheck, exact: false },
    ...(isAdmin ? [{ to: '/import', label: 'Ingest Excel', icon: UploadCloud, exact: false }] : []),
    { to: '/campaigns', label: 'Campaign Telemetry', icon: Megaphone, exact: false },
    { to: '/chat', label: 'Counselor Chat', icon: MessageSquare, exact: false },
    ...(isAdmin ? [{ to: '/users', label: 'Team & Roles', icon: UserCog, exact: false }] : []),
  ];

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/') return { title: 'Executive Overview', subtitle: 'Real-time candidate metrics & counselor pipelines' };
    if (path.startsWith('/leads')) return { title: 'Candidate Leads Pipeline', subtitle: 'Filter, triage, and contact international visa candidates' };
    if (path.startsWith('/customers')) return { title: 'Candidate Directory', subtitle: 'Verified profiles and historical lead records' };
    if (path.startsWith('/import')) return { title: 'Data Ingestion', subtitle: 'Import Meta ads export spreadsheets & raw lead data' };
    if (path.startsWith('/campaigns')) return { title: 'Marketing Campaigns', subtitle: 'Meta Instagram & Facebook ad sets and telemetry' };
    if (path.startsWith('/chat')) return { title: 'Counselor Channel', subtitle: 'Internal messaging and lead distribution' };
    if (path.startsWith('/users')) return { title: 'Team & Permissions', subtitle: 'Manage counselor assignments, roles, and access desks' };
    return { title: 'SSA CRM', subtitle: 'Work & Study Visa Consultancy' };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex flex-col md:flex-row font-sans text-[#1c1c1e] antialiased selection:bg-[#007aff] selection:text-white">
      {/* Mobile Top Header */}
      <div className="md:hidden ios-glass border-b border-black/[0.06] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img src={brandLogo} alt="SSA Logo" className="w-8 h-8 rounded-xl object-cover shadow-xs border border-black/[0.08]" />
          <h1 className="font-bold text-sm tracking-tight text-[#1c1c1e] leading-tight">SSA CRM</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-[#3c3c43] hover:text-[#000000] rounded-xl hover:bg-black/[0.05] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Desktop Left Sidebar (iOS / iPadOS HIG Frosted Glass Navigation) */}
      <aside
        className={`fixed md:sticky top-0 z-30 inset-y-0 left-0 w-64 ios-glass-sidebar border-r border-black/[0.06] flex flex-col justify-between transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-sm md:shadow-none h-screen`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand & Workspace Indicator */}
          <div className="p-4 border-b border-black/[0.05]">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt="SSA Logo"
                className="w-10 h-10 rounded-2xl object-cover shadow-xs border border-black/[0.08] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-sm tracking-tight text-[#1c1c1e] truncate">
                  SSA CRM
                </h2>
                <p className="text-[11px] text-[#8e8e93] font-medium truncate">Overseas Visa Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 flex-1 space-y-6">
            <div>
              <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
                Core Operations
              </p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                          isActive
                            ? 'bg-[#007aff] text-white shadow-[0_2px_8px_rgba(0,122,255,0.32)] font-semibold'
                            : 'text-[#3c3c43] hover:text-[#1c1c1e] hover:bg-black/[0.04] font-medium'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5">
                            <Icon
                              size={16}
                              className={`shrink-0 transition-colors ${
                                isActive ? 'text-white' : 'text-[#8e8e93] group-hover:text-[#1c1c1e]'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {item.to === '/leads' && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isActive ? 'bg-white/25 text-white' : 'bg-[#007aff]/10 text-[#007aff]'
                              }`}
                            >
                              Live
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Quick Status Pill */}
            <div className="p-3 rounded-2xl bg-white/70 border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3c3c43]">
                <Compass size={13} className="text-[#007aff]" />
                <span>Active Desk Scope</span>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] ${badgeInfo.badgeClass}`}>
                  {badgeInfo.displayText}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Counselor Card */}
        <div className="p-3 border-t border-black/[0.05] bg-black/[0.015]">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/80 border border-black/[0.05] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#007aff]/10 text-[#007aff] font-bold text-xs flex items-center justify-center shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1c1c1e] truncate leading-tight">
                  {displayName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-[#8e8e93] font-medium truncate">
                    {badgeInfo.displayText}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-[#8e8e93] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full transition-colors shrink-0 ml-1"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* iOS-Style Translucent Glass Top Navbar */}
        <header className="ios-glass border-b border-black/[0.06] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-[#1c1c1e] leading-tight">
              {pageInfo.title}
            </h1>
            <p className="text-[11px] text-[#8e8e93] truncate hidden sm:block">
              {pageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={() => navigate('/import')}
                className="hidden sm:inline-flex ios-btn-secondary text-xs"
                title="Excel / Spreadsheet Ingestion"
              >
                <UploadCloud size={13} />
                <span>Ingest Excel</span>
              </button>
            )}

            <button
              onClick={() => navigate('/leads?action=create')}
              className="ios-btn-primary text-xs"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Candidate</span>
            </button>

            {/* Header User Badge & Logout Section */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-black/[0.08]">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#1c1c1e] leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[#8e8e93] font-mono">
                  @{user?.login || 'staff'}
                </span>
              </div>

              {/* Styled Role Badge with Emoji */}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${badgeInfo.badgeClass}`}
                title={badgeInfo.deskTitle}
              >
                {badgeInfo.displayText}
              </span>

              {/* Logout Button in Header */}
              <button
                onClick={handleLogout}
                title="Log Out (Clears token and redirects to login)"
                className="p-1.5 text-[#8e8e93] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full transition-colors ml-1"
                aria-label="Logout"
              >
                <LogOut size={15} />
              </button>
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
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 md:hidden"
        />
      )}
    </div>
  );
}
