import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppPageLoader from './AppPageLoader';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <AppPageLoader message="Loading..." />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
