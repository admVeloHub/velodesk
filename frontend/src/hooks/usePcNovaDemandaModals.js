/**
 * usePcNovaDemandaModals — Nova demanda Procon (cadastro manual)
 */
import React, { useCallback, useState } from 'react';
import PcNovaDemandaModal from '../features/especiais/procon/PcNovaDemandaModal';

export function usePcNovaDemandaModals({ navigate } = {}) {
  const [novaOpen, setNovaOpen] = useState(false);

  const openNovaDemandaFlow = useCallback(() => {
    setNovaOpen(true);
  }, []);

  const handleManual = useCallback(() => {
    setNovaOpen(false);
    navigate?.('/especiais/procon/nova');
  }, [navigate]);

  const modals = (
    <PcNovaDemandaModal
      open={novaOpen}
      onClose={() => setNovaOpen(false)}
      onManual={handleManual}
    />
  );

  return { openNovaDemandaFlow, modals };
}
