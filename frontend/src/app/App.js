/**

 * App raiz — providers + rotas

 * VERSION: v2.5.0 | DATE: 2026-07-06 | AUTHOR: VeloHub Development Team

 */

import React, { useEffect } from 'react';

import { useRoutes } from 'react-router-dom';

import CockpitBridge from '../components/CockpitBridge';

import { AuthProvider } from '../context/AuthContext';

import { NotificationProvider } from '../context/NotificationContext';

import { ThemeProvider } from '../context/ThemeContext';

import { TicketsProvider } from '../context/TicketsContext';

import { ProfileProvider } from '../context/ProfileContext';
import { TabulationProvider } from '../context/TabulationContext';
import { WorkflowConfigProvider } from '../context/WorkflowConfigContext';

import ProtectedRoute from '../routes/ProtectedRoute';

import DefaultLandingRedirect from '../routes/DefaultLandingRedirect';

import DeskLoginPage from '../features/auth/DeskLoginPage';

import AppShell from '../layout/AppShell';

import WorkspacePage from '../pages/WorkspacePage';

import DashboardPage from '../pages/DashboardPage';

import TicketsPage from '../pages/TicketsPage';

import ChatPage from '../pages/ChatPage';

import ConfigPage from '../pages/ConfigPage';

import ReportsPage from '../pages/ReportsPage';

import ClientPortalPage from '../pages/ClientPortalPage';
import WorkflowPage from '../pages/WorkflowPage';

import { initCockpitGlobals } from '../config/cockpitConfig';

import { isLocalDevBypass } from '../config/devAuth';

import { loadKanbanFromApi, setApiMode } from '../services/ticketsCache';



function AppRoutes() {

  return useRoutes([

    { path: '/login', element: React.createElement(DeskLoginPage) },

    {

      element: React.createElement(ProtectedRoute),

      children: [

        {

          element: React.createElement(AppShell),

          children: [

            { index: true, element: React.createElement(DefaultLandingRedirect) },

            { path: 'workspace', element: React.createElement(WorkspacePage) },

            { path: 'workflow', element: React.createElement(WorkflowPage) },

            { path: 'dashboard', element: React.createElement(DashboardPage) },

            { path: 'reports', element: React.createElement(ReportsPage) },

            { path: 'tickets', element: React.createElement(TicketsPage) },

            { path: 'chat', element: React.createElement(ChatPage) },

            { path: 'config', element: React.createElement(ConfigPage) },

            { path: 'client-portal', element: React.createElement(ClientPortalPage) },

          ],

        },

      ],

    },

    { path: '*', element: React.createElement(DefaultLandingRedirect) },

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

          React.createElement(ProfileProvider, null,
            React.createElement(TabulationProvider, null,
              React.createElement(WorkflowConfigProvider, null, children)
            )
          )

        )

      )

    )

  );

}



export default function App() {

  useEffect(() => {

    initCockpitGlobals();

    setApiMode(true);

    if (!isLocalDevBypass()) {

      loadKanbanFromApi().catch(() => {});

    }
  }, []);



  return React.createElement(

    AppProviders,

    null,

    React.createElement(CockpitBridge),

    React.createElement(AppRoutes)

  );

}

