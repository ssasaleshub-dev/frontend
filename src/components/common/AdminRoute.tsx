import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin } from '../../utils/rbac';
import AppPageLoader from './AppPageLoader';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppPageLoader message="Loading..." />;
  }

  const isAdmin = checkIsAdmin(user);

  if (!isAdmin) {
    // Non-admin staff attempting to access admin-only route are redirected to Overview
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
