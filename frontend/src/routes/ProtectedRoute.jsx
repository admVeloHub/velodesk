/**
 * ProtectedRoute v1.2.0 — rotas autenticadas via gate VeloHub
 * VERSION: v1.2.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadKanbanFromApi } from '../services/ticketsCache';

export default function ProtectedRoute() {
  const { isAuthenticated, authStatus } = useAuth();

  useEffect(() => {
    if (isAuthenticated) loadKanbanFromApi();
  }, [isAuthenticated]);

  if (authStatus !== 'authorized' || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
