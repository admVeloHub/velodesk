/**
 * usePcNovaDemandaModals — Nova demanda Procon (cadastro manual por CPF)
 */
import React, { useCallback, useState } from 'react';
import PcNovaDemandaModal from '../features/especiais/procon/PcNovaDemandaModal';
import PcNovaDemandaCpfModal from '../features/especiais/procon/PcNovaDemandaCpfModal';

export function usePcNovaDemandaModals({ navigate } = {}) {
  const [novaOpen, setNovaOpen] = useState(false);
  const [cpfOpen, setCpfOpen] = useState(false);

  const openNovaDemandaFlow = useCallback(() => {
    setNovaOpen(true);
  }, []);

  const handleManual = useCallback(() => {
    setNovaOpen(false);
    setCpfOpen(true);
  }, []);

  const handleCpfClose = useCallback(() => {
    setCpfOpen(false);
  }, []);

  const handleCpfSuccess = useCallback((pcId) => {
    setCpfOpen(false);
    if (pcId) {
      navigate?.(`/especiais/procon/ticket/${pcId}`);
    }
  }, [navigate]);

  const modals = (
    <>
      <PcNovaDemandaModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onManual={handleManual}
      />
      <PcNovaDemandaCpfModal
        open={cpfOpen}
        onClose={handleCpfClose}
        onSuccess={handleCpfSuccess}
      />
    </>
  );

  return { openNovaDemandaFlow, modals };
}
