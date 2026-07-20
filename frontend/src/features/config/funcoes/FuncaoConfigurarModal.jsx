/**
 * FuncaoConfigurarModal v1.0.0 — configurar funções VeloHub pendentes
 */
import React, { useEffect, useRef, useState } from 'react';
import FuncaoOverridesEditor from './FuncaoOverridesEditor';
import { buildDraftFromVelohub } from './funcaoPermissoesLabels';

export default function FuncaoConfigurarModal({
  pendentes,
  catalog,
  draft,
  setDraft,
  selectedVelohub,
  onSelectVelohub,
  saving,
  onSave,
  onCancel,
  velohubAvailable,
}) {
  const dialogRef = useRef(null);
  const [accordionOpen, setAccordionOpen] = useState(true);

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

  const handleSelect = (item) => {
    onSelectVelohub(item);
    setDraft(buildDraftFromVelohub(item, catalog));
  };

  const titleId = 'funcao-configurar-modal-title';

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
          <h4 id={titleId}>Configurar função</h4>
          <button type="button" className="config-modal__close" onClick={onCancel} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="config-modal__body fp-modal__body">
          {!velohubAvailable ? (
            <p className="fp-config-modal__empty">
              Sync VeloHub indisponível. Verifique a conexão com o VeloHubCentral.
            </p>
          ) : pendentes.length === 0 ? (
            <p className="fp-config-modal__empty">
              Todas as funções do VeloHub já estão configuradas.
            </p>
          ) : (
            <>
              <div className="fp-accordion">
                <button
                  type="button"
                  className={'fp-accordion__header' + (accordionOpen ? ' is-open' : '')}
                  onClick={() => setAccordionOpen((v) => !v)}
                  aria-expanded={accordionOpen}
                >
                  <span className="fp-accordion__title">Sync VeloHub</span>
                  <span className="fp-accordion__count">{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</span>
                  <i className={'ti ti-chevron-' + (accordionOpen ? 'up' : 'down')} aria-hidden="true" />
                </button>
                {accordionOpen ? (
                  <ul className="fp-accordion__panel fp-velohub-list">
                    {pendentes.map((v) => {
                      const isSelected = selectedVelohub?.funcaoSlug === v.funcaoSlug;
                      return (
                        <li key={v.funcaoSlug}>
                          <button
                            type="button"
                            className={'fp-config-modal__pendente' + (isSelected ? ' is-selected' : '')}
                            onClick={() => handleSelect(v)}
                            aria-pressed={isSelected}
                          >
                            <span className="fp-config-modal__pendente-nome">{v.funcao}</span>
                            {v.descricao ? (
                              <span className="fp-config-modal__pendente-desc">{v.descricao}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              {selectedVelohub && draft ? (
                <div className="fp-config-modal__editor">
                  <h5 className="fp-config-modal__editor-title">
                    Configurar — {selectedVelohub.funcao}
                  </h5>
                  <FuncaoOverridesEditor catalog={catalog} draft={draft} setDraft={setDraft} />
                </div>
              ) : (
                <p className="fp-config-modal__hint">
                  Selecione uma função acima para definir nível e acessos.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="config-modal__footer fp-modal__footer">
          <button type="button" className="config-action-btn" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="config-action-btn config-action-btn--create"
            onClick={onSave}
            disabled={saving || !selectedVelohub || !draft}
          >
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </footer>
      </div>
    </div>
  );
}
