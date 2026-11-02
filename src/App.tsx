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
import ImportLeads from './pages/ImportLeads';
import Customers from './pages/Customers';
import Chat from './pages/Chat';
import Users from './pages/Users';
import CandidateDetail from './pages/CandidateDetail';
import CalendarPage from './pages/CalendarPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';
import pushNotificationService from './services/pushNotificationService';

function PushNotificationListener() {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Initialize Capacitor Push Notifications on mobile devices
    pushNotificationService.initialize();

    const handleNavigate = (event: any) => {
      const path = event.detail?.path;
      if (path) {
        navigate(path);
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
            <Route path="/data-deletion" element={<DataDeletion />} />
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
              <Route path="chat" element={<Chat />} />
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <Users />
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
