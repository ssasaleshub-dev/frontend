import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
    </AuthProvider>
  );
}
