/** App v1.2.0 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import WorkspacePage from './features/workspace/WorkspacePage';
import DashboardPage from './features/dashboard/DashboardPage';
import TicketsPage from './features/tickets/TicketsPage';
import ChatPage from './features/chat/ChatPage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import ReportsPage from './features/reports/ReportsPage';
import ClientPortalPage from './features/client-portal/ClientPortalPage';
import ConfigPage from './features/config/ConfigPage';
import VelohubModulePlaceholderPage from './features/hub/VelohubModulePlaceholderPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Navigate to="/workspace" replace />} />
                <Route path="/home" element={<VelohubModulePlaceholderPage module="home" />} />
                <Route path="/conhecimento" element={<VelohubModulePlaceholderPage module="conhecimento" />} />
                <Route path="/apoio" element={<VelohubModulePlaceholderPage module="apoio" />} />
                <Route path="/velobot" element={<VelohubModulePlaceholderPage module="velobot" />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/analytics-ia" element={<AnalyticsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/client-portal" element={<ClientPortalPage />} />
                <Route path="/config" element={<ConfigPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/workspace" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
