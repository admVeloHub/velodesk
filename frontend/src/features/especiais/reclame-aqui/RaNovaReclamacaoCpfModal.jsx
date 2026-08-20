/**
 * RaNovaReclamacaoCpfModal — etapa CPF do cadastro manual de reclamação RA
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import RegisterClientModal from '../../desk/components/RegisterClientModal';
import { useRaNovaReclamacaoCpf } from '../../../hooks/useRaNovaReclamacaoCpf';

export default function RaNovaReclamacaoCpfModal({ open, onClose, onSuccess }) {
  const {
    cpfRef,
    cpfInput,
    loading,
    registerOpen,
    pendingCpf,
    handleAdvance,
    handleRegisterSaved,
    handleRegisterClose,
    handleCpfChange,
    handleKeyDown,
  } = useRaNovaReclamacaoCpf({ onSuccess, onClose });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !registerOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, registerOpen]);

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
        className="queue-box-modal ra-nova-cpf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="raNovaCpfModalTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-id" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="raNovaCpfModalTitle">
                Cadastro manual
              </h2>
              <p className="queue-box-modal__subtitle">
                Informe o CPF do consumidor para abrir a reclamação.
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

        <div className="queue-box-modal__body" onKeyDown={handleKeyDown}>
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="raNovaCpfInput">
              CPF do consumidor
            </label>
            <input
              ref={cpfRef}
              id="raNovaCpfInput"
              type="text"
              className="queue-box-modal__input ra-nova-cpf__input"
              value={cpfInput}
              onChange={(event) => handleCpfChange(event.target.value)}
              placeholder="000.000.000-00"
              autoComplete="off"
              inputMode="numeric"
              maxLength={14}
              disabled={loading}
            />
          </div>
        </div>

        <footer className="queue-box-modal__footer">
          <button
            type="button"
            className="btn-secondary queue-box-modal__btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary queue-box-modal__btn ra-nova-cpf__submit"
            onClick={handleAdvance}
            disabled={loading}
          >
            {loading ? 'Criando reclamação…' : 'Avançar'}
          </button>
        </footer>
      </div>

      <RegisterClientModal
        open={registerOpen}
        cpf={pendingCpf}
        onClose={handleRegisterClose}
        onSaved={handleRegisterSaved}
      />
    </>,
    document.body,
  );
}
