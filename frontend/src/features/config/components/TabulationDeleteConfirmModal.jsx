/**
 * TabulationDeleteConfirmModal v1.0.1 — confirmação de exclusão irreversível
 * VERSION: v1.0.1 | DATE: 2026-06-30
 */
import React, { useEffect } from 'react';

export default function TabulationDeleteConfirmModal({
  produto,
  motivosCount,
  detalhesCount,
  deleting,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onCancel]);

  if (!produto) return null;

  return (
    <div className="config-modal" role="presentation">
      <button
        type="button"
        className="config-modal__backdrop"
        aria-label="Fechar"
        onClick={deleting ? undefined : onCancel}
      />
      <div
        className="config-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tabulationDeleteTitle"
      >
        <header className="config-modal__header">
          <h4 id="tabulationDeleteTitle">Excluir produto?</h4>
        </header>
        <div className="config-modal__body">
          <p>
            Ao excluir o produto <strong>{produto.produto}</strong>, todos os motivos
            {' '}({motivosCount}) e detalhes ({detalhesCount}) subsequentes na árvore de tabulação
            serão eliminados.
          </p>
          <p className="config-modal__warning">Esta operação não é reversível.</p>
        </div>
        <footer className="config-modal__footer">
          <button type="button" className="config-action-btn config-action-btn--edit" onClick={onCancel} disabled={deleting}>
            Cancelar
          </button>
          <button type="button" className="config-action-btn config-action-btn--delete" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Excluindo…' : 'Confirmar exclusão'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function countDetalhes(motivos) {
  return (motivos || []).reduce((sum, m) => sum + (m.detalhes || []).length, 0);
}

export { countDetalhes };
