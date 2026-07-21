/**
 * ProtectedRoute v1.3.0 — rotas autenticadas; boxes via TicketsContext
 * VERSION: v1.3.0 | DATE: 2026-07-21 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus !== 'authorized' || !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
