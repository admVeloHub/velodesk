import React, { useCallback, useEffect, useState } from 'react';
import { PRODUTOS_APPROVE_ACTIONS } from '../../../services/cadastral/solicitacoesProdutosData';

export default function WorkflowApprovalProdutosApprovePanel({
  open,
  busy,
  onConfirm,
  onClose,
}) {
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const toggleAction = useCallback((actionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (busy || selected.size === 0) return;
    onConfirm?.([...selected]);
  }, [busy, onConfirm, selected]);

  if (!open) return null;

  return (
    <div
      className="wf-approval-produtos-approve-panel"
      role="dialog"
      aria-label="Selecione as ações"
    >
      <header className="wf-approval-produtos-approve-panel__head">
        <h4>Selecione as ações:</h4>
        <button
          type="button"
          className="wf-approval-produtos-approve-panel__close"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </header>

      <div className="wf-approval-produtos-approve-panel__body">
        <div className="wf-approval-produtos-approve-grid" role="group" aria-label="Ações de aprovação">
          {PRODUTOS_APPROVE_ACTIONS.map((action) => {
            const isChecked = selected.has(action.id);
            return (
              <label
                key={action.id}
                className={`wf-approval-produtos-approve-option${isChecked ? ' is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="wf-approval-produtos-approve-option__input"
                  checked={isChecked}
                  disabled={busy}
                  onChange={() => toggleAction(action.id)}
                />
                <span className="wf-approval-produtos-approve-option__label">{action.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <footer className="wf-approval-produtos-approve-panel__foot">
        <button
          type="button"
          className="wf-approval-produtos-approve-panel__confirm"
          disabled={busy || selected.size === 0}
          onClick={handleConfirm}
        >
          Confirmar
        </button>
      </footer>
    </div>
  );
}
