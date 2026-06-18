/** useRetractableSidebar v1.0.0 — recolher/revelar sidebar lateral (manual) */
import { useCallback, useState } from 'react';

export function useRetractableSidebar(initialVisible = true) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(initialVisible);

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((current) => !current);
  }, []);

  const revealSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const hideSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  return { isSidebarVisible, toggleSidebar, revealSidebar, hideSidebar };
}
