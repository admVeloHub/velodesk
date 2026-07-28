/**
 * DeskAiRevisionModal v1.1.0 — revisão de sugestão IA com input do operador (portal)
 * VERSION: v1.1.0 | DATE: 2026-07-28
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DeskAiRevisionModal({
  open,
  auditScore,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setInput('');

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const result = await onSubmit(trimmed);
    if (result?.success) {
      setInput('');
      onClose();
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar revisão da IA"
        onClick={() => !submitting && onClose()}
      />
      <div
        className="queue-box-modal desk-ai-revision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deskAiRevisionTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-sparkles" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="deskAiRevisionTitle">
                Solicitar revisão da IA
              </h2>
              {typeof auditScore === 'number' && (
                <p className="queue-box-modal__subtitle desk-ai-revision-modal__score">
                  Conformidade atual: <strong>{auditScore}%</strong>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="queue-box-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            <i className="ti ti-x" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="queue-box-modal__body">
            <p className="desk-ai-revision-modal__hint">
              Descreva o que deve ser ajustado na resposta sugerida. Seu feedback será usado no treinamento do agente.
            </p>
            <textarea
              ref={inputRef}
              className="desk-ai-revision-modal__input"
              rows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: O cliente perguntou sobre prazo de 5 dias, não 3."
              disabled={submitting}
            />
          </div>
          <footer className="queue-box-modal__footer desk-ai-revision-modal__actions">
            <button
              type="button"
              className="btn-secondary queue-box-modal__btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary queue-box-modal__btn"
              disabled={submitting || !input.trim()}
            >
              {submitting ? 'Revisando…' : 'Solicitar revisão'}
            </button>
          </footer>
        </form>
      </div>
    </>,
    document.body
  );
}
