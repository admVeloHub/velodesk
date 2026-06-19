/**
 * App raiz — providers + rotas
 * VERSION: v2.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import CockpitBridge from '../components/CockpitBridge';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ThemeProvider } from '../context/ThemeContext';
import { TicketsProvider } from '../context/TicketsContext';
import { ProfileProvider } from '../context/ProfileContext';
import ProtectedRoute from '../routes/ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import AppShell from '../layout/AppShell';
import WorkspacePage from '../pages/WorkspacePage';
import DashboardPage from '../pages/DashboardPage';
import TicketsPage from '../pages/TicketsPage';
import ChatPage from '../pages/ChatPage';
import ConfigPage from '../pages/ConfigPage';
import AnalyticsIaPage from '../pages/AnalyticsIaPage';
import ReportsPage from '../pages/ReportsPage';
import ClientPortalPage from '../pages/ClientPortalPage';
import { bootstrapCockpitData } from '../services/seedDemo';
import { initCockpitGlobals } from '../config/cockpitConfig';
import { isLocalDevBypass } from '../config/devAuth';
import { migrateAllTicketsForDeskV2 } from '../services/desk/utils';
import { loadKanbanFromApi, setApiMode } from '../services/ticketsCache';

let localDevBootstrapped = false;

function ensureLocalDevData() {
  if (localDevBootstrapped || !isLocalDevBypass()) return;
  localDevBootstrapped = true;
  setApiMode(false);
  bootstrapCockpitData();
  migrateAllTicketsForDeskV2();
}

function AppRoutes() {
  return useRoutes([
    { path: '/login', element: React.createElement(LoginPage) },
    {
      element: React.createElement(ProtectedRoute),
      children: [
        {
          element: React.createElement(AppShell),
          children: [
            { index: true, element: React.createElement(Navigate, { to: '/tickets?desk=v2', replace: true }) },
            { path: 'workspace', element: React.createElement(WorkspacePage) },
            { path: 'dashboard', element: React.createElement(DashboardPage) },
            { path: 'reports', element: React.createElement(ReportsPage) },
            { path: 'tickets', element: React.createElement(TicketsPage) },
            { path: 'chat', element: React.createElement(ChatPage) },
            { path: 'config', element: React.createElement(ConfigPage) },
            { path: 'analytics-ia', element: React.createElement(AnalyticsIaPage) },
            { path: 'client-portal', element: React.createElement(ClientPortalPage) },
          ],
        },
      ],
    },
    { path: '*', element: React.createElement(Navigate, { to: '/tickets?desk=v2', replace: true }) },
  ]);
}

function AppProviders({ children }) {
  return React.createElement(
    AuthProvider,
    null,
    React.createElement(
      NotificationProvider,
      null,
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(
          TicketsProvider,
          null,
          React.createElement(ProfileProvider, null, children)
        )
      )
    )
  );
}

export default function App() {
  ensureLocalDevData();

  useEffect(() => {
    initCockpitGlobals();
    if (isLocalDevBypass()) return;
    loadKanbanFromApi()
      .then((cols) => {
        if (!cols.length && import.meta.env.DEV) {
          bootstrapCockpitData();
          migrateAllTicketsForDeskV2();
        }
      })
      .catch(() => {
        if (import.meta.env.DEV) {
          bootstrapCockpitData();
          migrateAllTicketsForDeskV2();
        }
      });
  }, []);

  return React.createElement(
    AppProviders,
    null,
    React.createElement(CockpitBridge),
    React.createElement(AppRoutes)
  );
}
