import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Megaphone,
  UploadCloud,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/leads', label: 'Leads Pipeline', icon: Users },
    { to: '/import', label: 'Import Leads', icon: UploadCloud },
    { to: '/customers', label: 'Customers', icon: UserCheck },
    { to: '/campaigns', label: 'Campaigns & Ads', icon: Megaphone },
  ];

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Overview';
    if (path.startsWith('/leads')) return 'Lead Pipeline';
    if (path.startsWith('/import')) return 'Import Leads';
    if (path.startsWith('/customers')) return 'Customer Directory';
    if (path.startsWith('/campaigns')) return 'Marketing Campaigns';
    return 'Sales Hub';
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.login || 'User';

  const userInitial = displayName?.[0]?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 antialiased">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img src={brandLogo} alt="SSA Brand Logo" className="w-8 h-8 rounded-md object-cover shadow-2xs" />
          <div>
            <h1 className="font-semibold text-sm text-slate-900">SSA Sales Hub</h1>
            <p className="text-[10px] text-slate-500">Mattress CRM</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-30 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-sm md:shadow-none h-screen`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={brandLogo} alt="SSA Brand Logo" className="w-9 h-9 rounded-md object-cover shadow-2xs" />
              <div>
                <h2 className="font-semibold text-sm text-slate-900">SSA Sales Hub</h2>
                <p className="text-xs text-slate-500">Mattress CRM</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon size={16} className="shrink-0 text-slate-500" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {displayName}
                </p>
                {user?.email && (
                  <p className="text-[11px] text-slate-500 truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-semibold text-slate-900">
                {getPageTitle()}
              </h1>
              <p className="text-xs text-slate-500">
                Mattress Lead Management & Campaign Attribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/import')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium shadow-2xs transition-colors"
            >
              <UploadCloud size={14} />
              <span>Import Leads</span>
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/30 z-20 md:hidden"
        />
      )}
    </div>
  );
}
