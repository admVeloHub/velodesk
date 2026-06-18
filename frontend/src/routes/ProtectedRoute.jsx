/**
 * ProtectedRoute v1.0.0 — rotas autenticadas
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadKanbanFromApi } from '../services/ticketsCache';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) loadKanbanFromApi();
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
