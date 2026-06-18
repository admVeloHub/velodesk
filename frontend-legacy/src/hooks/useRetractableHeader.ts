/** useRetractableHeader v1.1.0 — recolher/revelar header principal (manual) */
import { useCallback, useState } from 'react';

export function useRetractableHeader(initialVisible = true) {
  const [isPrimaryVisible, setIsPrimaryVisible] = useState(initialVisible);

  const togglePrimary = useCallback(() => {
    setIsPrimaryVisible((current) => !current);
  }, []);

  const revealPrimary = useCallback(() => {
    setIsPrimaryVisible(true);
  }, []);

  const hidePrimary = useCallback(() => {
    setIsPrimaryVisible(false);
  }, []);

  return { isPrimaryVisible, togglePrimary, revealPrimary, hidePrimary };
}
