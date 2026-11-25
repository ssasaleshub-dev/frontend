import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import ProtectedRoute from './components/common/ProtectedRoute';
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
  if (loading) return null;
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

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <BrowserRouter>
          <PushNotificationListener />
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
