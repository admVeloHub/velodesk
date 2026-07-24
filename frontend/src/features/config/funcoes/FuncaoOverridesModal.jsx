/**
 * FuncaoOverridesModal v1.1.0 — overrides por módulo em acordeão
 */
import React, { useEffect, useRef } from 'react';
import FuncaoOverridesEditor from './FuncaoOverridesEditor';

export default function FuncaoOverridesModal({
  funcao,
  catalog,
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  if (!funcao || !draft) return null;

  const titleId = 'funcao-overrides-modal-title';

  return (
    <div className="config-modal fp-modal" role="presentation">
      <button
        type="button"
        className="config-modal__backdrop fp-modal__backdrop"
        aria-label="Fechar"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="config-modal__dialog config-modal__dialog--wide fp-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="config-modal__header fp-modal__header">
          <h4 id={titleId}>Overrides — {funcao.nome || funcao.slug}</h4>
          <button type="button" className="config-modal__close" onClick={onCancel} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="config-modal__body fp-modal__body">
          <FuncaoOverridesEditor catalog={catalog} draft={draft} setDraft={setDraft} />
        </div>

        <footer className="config-modal__footer fp-modal__footer">
          <button type="button" className="config-action-btn" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="config-action-btn config-action-btn--create"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar overrides'}
          </button>
        </footer>
      </div>
    </div>
  );
}
