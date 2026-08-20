/**
 * useRaNovaReclamacaoModals — fluxo compartilhado Nova reclamação (manual por CPF | Hugme)
 */
import React, { useCallback, useState } from 'react';
import RaHugmeImportModal from '../features/especiais/reclame-aqui/RaHugmeImportModal';
import RaNovaReclamacaoModal from '../features/especiais/reclame-aqui/RaNovaReclamacaoModal';
import RaNovaReclamacaoCpfModal from '../features/especiais/reclame-aqui/RaNovaReclamacaoCpfModal';

export function useRaNovaReclamacaoModals({ navigate, onImported } = {}) {
  const [novaOpen, setNovaOpen] = useState(false);
  const [cpfOpen, setCpfOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const openNovaFlow = useCallback(() => {
    setNovaOpen(true);
  }, []);

  const handleManual = useCallback(() => {
    setNovaOpen(false);
    setCpfOpen(true);
  }, []);

  const handleCpfClose = useCallback(() => {
    setCpfOpen(false);
  }, []);

  // Ticket é criado com ID/assunto/produto/motivo/prazo em branco — o agente completa
  // direto no DADOS do ticket (campos editáveis), sem passar pelo formulário de registro.
  const handleCpfSuccess = useCallback((raId) => {
    setCpfOpen(false);
    if (raId) {
      navigate?.(`/especiais/reclame-aqui/ticket/${raId}`);
    }
  }, [navigate]);

  const handleImport = useCallback(() => {
    setNovaOpen(false);
    setImportOpen(true);
  }, []);

  const handleImportComplete = useCallback((result) => {
    onImported?.(result);
  }, [onImported]);

  const modals = (
    <>
      <RaNovaReclamacaoModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onManual={handleManual}
        onImport={handleImport}
      />
      <RaNovaReclamacaoCpfModal
        open={cpfOpen}
        onClose={handleCpfClose}
        onSuccess={handleCpfSuccess}
      />
      <RaHugmeImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={handleImportComplete}
      />
    </>
  );

  return { openNovaFlow, modals };
}
