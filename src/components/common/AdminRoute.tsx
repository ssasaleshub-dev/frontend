import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin } from '../../utils/rbac';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  const isAdmin = checkIsAdmin(user);

  if (!isAdmin) {
    // Non-admin staff attempting to access admin-only route are redirected to Overview
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
