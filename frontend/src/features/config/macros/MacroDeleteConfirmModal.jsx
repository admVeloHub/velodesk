/**
 * MacroDeleteConfirmModal v1.0.0 — confirmação de exclusão irreversível de macro
 * VERSION: v1.0.0 | DATE: 2026-09-03
 */
import React, { useEffect } from 'react';

export default function MacroDeleteConfirmModal({ macro, deleting, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, onCancel]);

  if (!macro) return null;

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
        aria-labelledby="macroDeleteTitle"
      >
        <header className="config-modal__header">
          <h4 id="macroDeleteTitle">Excluir macro?</h4>
        </header>
        <div className="config-modal__body">
          <p>
            A macro <strong>{macro.nome}</strong> deixará de aparecer no menu de Macros do compose
            para todos os agentes.
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
