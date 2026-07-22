/**
 * ProtectedRoute v1.2.0 — rotas autenticadas via gate VeloHub
 * VERSION: v1.2.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadBoxesFromApi } from '../services/ticketsCache';

export default function ProtectedRoute() {
  const { isAuthenticated, authStatus } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) loadBoxesFromApi();
  }, [isAuthenticated]);

  if (authStatus !== 'authorized' || !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
