/**
 * CgNovaDemandaModal — cadastro manual de demanda ConsumidorGov
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CgNovaDemandaModal({ open, onClose, onManual }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="queue-box-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcNovaModalTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-plus" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="pcNovaModalTitle">
                Nova demanda
              </h2>
              <p className="queue-box-modal__subtitle">
                Cadastre manualmente uma demanda registrada no Consumidor.Gov.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="queue-box-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="queue-box-modal__body ra-nova-modal__body">
          <button
            type="button"
            className="ra-nova-modal__option ra-nova-modal__option--primary"
            onClick={onManual}
          >
            <span className="ra-nova-modal__option-icon" aria-hidden="true">
              <i className="ti ti-forms" />
            </span>
            <span className="ra-nova-modal__option-text">
              <strong>Cadastro manual</strong>
              <small>Informe o CPF do consumidor para abrir a demanda</small>
            </span>
            <i className="ti ti-chevron-right ra-nova-modal__option-arrow" aria-hidden="true" />
          </button>
        </div>

        <footer className="queue-box-modal__footer">
          <button type="button" className="btn-secondary queue-box-modal__btn" onClick={onClose}>
            Cancelar
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
