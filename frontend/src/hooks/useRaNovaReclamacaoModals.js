/**
 * useRaNovaReclamacaoModals — fluxo compartilhado Nova reclamação (manual | Hugme)
 */
import React, { useCallback, useState } from 'react';
import RaHugmeImportModal from '../features/especiais/reclame-aqui/RaHugmeImportModal';
import RaNovaReclamacaoModal from '../features/especiais/reclame-aqui/RaNovaReclamacaoModal';

export function useRaNovaReclamacaoModals({ navigate, onImported } = {}) {
  const [novaOpen, setNovaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const openNovaFlow = useCallback(() => {
    setNovaOpen(true);
  }, []);

  const handleManual = useCallback(() => {
    setNovaOpen(false);
    navigate?.('/especiais/reclame-aqui/nova');
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
      <RaHugmeImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={handleImportComplete}
      />
    </>
  );

  return { openNovaFlow, modals };
}
