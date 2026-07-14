/**
 * GruposResponsabilidadeModal v1.1.0 — modal wrapper do painel de grupos
 * VERSION: v1.1.0 | DATE: 2026-07-14
 */
import React, { useEffect } from 'react';
import GruposResponsabilidadePanel from '../grupos/GruposResponsabilidadePanel';

export default function GruposResponsabilidadeModal({ onClose, onChanged }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="config-modal" role="presentation">
      <button
        type="button"
        className="config-modal__backdrop"
        aria-label="Fechar"
        onClick={() => onClose?.()}
      />
      <div
        className="config-modal__dialog config-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grupos-modal-title"
      >
        <header className="config-modal__header">
          <h4 id="grupos-modal-title">Grupos de responsabilidade</h4>
          <button type="button" className="config-modal__close" onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="config-modal__body">
          <GruposResponsabilidadePanel onChanged={onChanged} showStats />
        </div>
      </div>
    </div>
  );
}
