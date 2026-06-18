/** VelohubRouteSync v1.0.0 — sincroniza Desk ativo com a rota atual */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useVelodeskModule } from '../contexts/VelodeskModuleContext';
import { isVelohubHubPath } from '../features/hub/velohubModules';

export default function VelohubRouteSync() {
  const location = useLocation();
  const { activateDesk, deactivateDesk } = useVelodeskModule();

  useEffect(() => {
    if (isVelohubHubPath(location.pathname)) {
      deactivateDesk();
      return;
    }
    activateDesk();
  }, [location.pathname, activateDesk, deactivateDesk]);

  return null;
}
