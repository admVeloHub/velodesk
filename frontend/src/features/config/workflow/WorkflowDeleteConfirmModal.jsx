/**
 * WorkflowDeleteConfirmModal v1.0.0 — confirmação de exclusão de workflow
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import React, { useEffect } from 'react';

export default function WorkflowDeleteConfirmModal({
  workflow,
  deleting,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onCancel]);

  if (!workflow) return null;

  const stepsCount = (workflow.steps || []).length;

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
        aria-labelledby="workflowDeleteTitle"
      >
        <header className="config-modal__header">
          <h4 id="workflowDeleteTitle">Excluir workflow?</h4>
        </header>
        <div className="config-modal__body">
          <p>
            Ao excluir o workflow <strong>{workflow.title}</strong>, todas as
            {' '}{stepsCount} etapa(s) configuradas serão removidas.
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
