import React from 'react';

export default function WorkflowConfigHeader({
  title,
  titleEditable = false,
  onTitleChange,
  active,
  onToggleActive,
  onHistory,
  onDuplicate,
  onSave,
}) {
  return (
    <header className="wf-config-header">
      <div className="wf-config-header__main">
        <span className="wf-config-header__eyebrow">Workflows</span>
        <div className="wf-config-header__title-row">
          {titleEditable ? (
            <input
              type="text"
              className="wf-config-header__title-input"
              value={title}
              onChange={(event) => onTitleChange?.(event.target.value)}
              aria-label="Nome do workflow"
              placeholder="Nome do workflow"
            />
          ) : (
            <h2>{title}</h2>
          )}
          {active ? (
            <span className="wf-config-header__badge">Ativo</span>
          ) : (
            <span className="wf-config-header__badge wf-config-header__badge--inactive">Inativo</span>
          )}
        </div>
      </div>

      <div className="wf-config-header__actions">
        <button type="button" className="wf-config-btn wf-config-btn--ghost" onClick={onHistory}>
          <i className="ti ti-history" aria-hidden="true" />
          Histórico
        </button>
        <button type="button" className="wf-config-btn wf-config-btn--ghost" onClick={onDuplicate}>
          <i className="ti ti-copy" aria-hidden="true" />
          Duplicar
        </button>
        <button type="button" className="wf-config-btn wf-config-btn--primary" onClick={onSave}>
          <i className="ti ti-device-floppy" aria-hidden="true" />
          Salvar
        </button>
        <label className="wf-config-toggle" aria-label="Ativar ou desativar workflow">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onToggleActive(e.target.checked)}
          />
          <span className="wf-config-toggle__track" aria-hidden="true">
            <span className="wf-config-toggle__thumb" />
          </span>
        </label>
      </div>
    </header>
  );
}
