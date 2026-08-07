/**
 * useCgNovaDemandaModals — Nova demanda ConsumidorGov (cadastro manual por CPF)
 */
import React, { useCallback, useState } from 'react';
import CgNovaDemandaModal from '../features/especiais/consumidor-gov/CgNovaDemandaModal';
import CgNovaDemandaCpfModal from '../features/especiais/consumidor-gov/CgNovaDemandaCpfModal';

export function useCgNovaDemandaModals({ navigate } = {}) {
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

  const handleCpfSuccess = useCallback((cgId) => {
    setCpfOpen(false);
    if (cgId) {
      navigate?.(`/especiais/consumidor-gov/ticket/${cgId}`);
    }
  }, [navigate]);

  const modals = (
    <>
      <CgNovaDemandaModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onManual={handleManual}
      />
      <CgNovaDemandaCpfModal
        open={cpfOpen}
        onClose={handleCpfClose}
        onSuccess={handleCpfSuccess}
      />
    </>
  );

  return { openNovaDemandaFlow, modals };
}
