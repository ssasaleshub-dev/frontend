import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppPageLoader from './components/common/AppPageLoader';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminRoute from './components/common/AdminRoute';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Campaigns from './pages/Campaigns';
import ImportLeads from './pages/ImportLeads';
import Customers from './pages/Customers';
import Chat from './pages/Chat';
import Users from './pages/Users';
import CandidateDetail from './pages/CandidateDetail';
import CalendarPage from './pages/CalendarPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceApprovePage from './pages/AttendanceApprovePage';
import StaffProfile from './pages/StaffProfile';
import BiometricApprovalsPage from './pages/BiometricApprovalsPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import Integrations from './pages/Integrations';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';
import TermsOfService from './pages/TermsOfService';
import pushNotificationService from './services/pushNotificationService';
import { useAuth } from './context/AuthContext';
import { isAdmin as checkIsAdmin } from './utils/rbac';

/** The attendance roster is for admins; staff have their attendance on the Profile page. */
function AttendanceRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AppPageLoader message="Loading..." />;
  return checkIsAdmin(user) ? <AttendancePage /> : <Navigate to="/profile" replace />;
}

function PushNotificationListener() {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Initialize Capacitor Push Notifications on mobile devices
    pushNotificationService.initialize();

    const handleNavigate = (event: any) => {
      const path = event.detail?.path;
      const state = event.detail?.state;
      if (path) {
        navigate(path, state ? { state } : undefined);
      }
    };

    window.addEventListener('ssa_navigate_to', handleNavigate);
    return () => {
      window.removeEventListener('ssa_navigate_to', handleNavigate);
    };
  }, [navigate]);

  return null;
}

function MobileKeyboardManager() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTextInput = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'select') return true;
      if (tag === 'input') {
        const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
        return !['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'range', 'color', 'hidden'].includes(type);
      }
      return el.isContentEditable;
    };

    const isMobileViewport = () => window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    let baseHeight = window.visualViewport?.height || window.innerHeight;
    let blurTimer: number | null = null;
    let scrollTimer: number | null = null;

    const setKeyboardOpen = (open: boolean) => {
      document.body.classList.toggle('keyboard-open', open);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isMobileViewport() || !isTextInput(e.target)) return;
      if (blurTimer) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }
      setKeyboardOpen(true);

      const targetEl = e.target;
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        try {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {}
      }, 200);
    };

    const onFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!isTextInput(document.activeElement)) {
          setKeyboardOpen(false);
        }
      }, 120);
    };

    const onViewportResize = () => {
      if (!isMobileViewport()) {
        setKeyboardOpen(false);
        return;
      }
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      if (currentHeight > baseHeight) {
        baseHeight = currentHeight;
      }
      const keyboardVisible = baseHeight - currentHeight > 140;
      if (!keyboardVisible && !isTextInput(document.activeElement)) {
        setKeyboardOpen(false);
      } else if (keyboardVisible) {
        setKeyboardOpen(true);
      }
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.addEventListener('resize', onViewportResize);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      window.removeEventListener('resize', onViewportResize);
      if (blurTimer) window.clearTimeout(blurTimer);
      if (scrollTimer) window.clearTimeout(scrollTimer);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <BrowserRouter>
          <PushNotificationListener />
          <MobileKeyboardManager />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/data-deletion-instructions" element={<DataDeletion />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="leads/:id" element={<CandidateDetail />} />
              <Route path="candidates/:id" element={<CandidateDetail />} />
              <Route
                path="import"
                element={
                  <AdminRoute>
                    <ImportLeads />
                  </AdminRoute>
                }
              />
              <Route path="customers" element={<Customers />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="attendance" element={<AttendanceRoute />} />
              <Route path="attendance/verify/:id" element={<AttendanceApprovePage />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route path="chat" element={<Chat />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="integrations/callback" element={<Integrations />} />
              <Route path="integrations/google/callback" element={<Integrations />} />
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <Users />
                  </AdminRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <AdminRoute>
                    <ReportsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="biometrics"
                element={
                  <AdminRoute>
                    <BiometricApprovalsPage />
                  </AdminRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AlertProvider>
    </AuthProvider>
  );
}
