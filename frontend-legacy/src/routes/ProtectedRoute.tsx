import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ProfileProvider } from '../contexts/ProfileContext';
import { VelodeskModuleProvider } from '../contexts/VelodeskModuleContext';
import AppLayout from '../layout/AppLayout';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <ProfileProvider>
      <VelodeskModuleProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </VelodeskModuleProvider>
    </ProfileProvider>
  );
}
