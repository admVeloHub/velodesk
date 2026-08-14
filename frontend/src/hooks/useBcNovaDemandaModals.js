/**
 * useBcNovaDemandaModals — Nova demanda Bacen (cadastro manual por CPF)
 */
import React, { useCallback, useState } from 'react';
import BcNovaDemandaModal from '../features/especiais/bacen/BcNovaDemandaModal';
import BcNovaDemandaCpfModal from '../features/especiais/bacen/BcNovaDemandaCpfModal';

export function useBcNovaDemandaModals({ navigate } = {}) {
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

  const handleCpfSuccess = useCallback((bcId) => {
    setCpfOpen(false);
    if (bcId) {
      navigate?.(`/especiais/bacen/ticket/${bcId}`);
    }
  }, [navigate]);

  const modals = (
    <>
      <BcNovaDemandaModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onManual={handleManual}
      />
      <BcNovaDemandaCpfModal
        open={cpfOpen}
        onClose={handleCpfClose}
        onSuccess={handleCpfSuccess}
      />
    </>
  );

  return { openNovaDemandaFlow, modals };
}
