/**
 * ComposeRefinarModal v1.0.2 — cancelamento durante refinamento (abort + fechar)
 * VERSION: v1.0.2 | DATE: 2026-07-02
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';

const MODAL_Z = 11000;

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.draftText — snapshot do compose ao abrir
 * @param {string} [props.nomeOperador]
 * @param {(text: string) => void} props.onApply
 */
export default function ComposeRefinarModal({
  open,
  onClose,
  draftText,
  nomeOperador = '',
  onApply,
}) {
  const { showNotification } = useNotifications();
  const [result, setResult] = useState('');
  const [phase, setPhase] = useState(null);
  const abortRef = useRef(null);
  const fetchedForRef = useRef('');

  const handleClose = useCallback((options = {}) => {
    const { userCanceled = false } = options;
    abortRef.current?.abort();
    abortRef.current = null;
    setResult('');
    setPhase(null);
    fetchedForRef.current = '';
    onClose();
    if (userCanceled) {
      showNotification('Refinamento cancelado.', 'info');
    }
  }, [onClose, showNotification]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose({ userCanceled: phase === 'loading' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, phase, handleClose]);

  useEffect(() => {
    if (!open) return undefined;

    const texto = String(draftText || '').trim();
    const fetchKey = `${texto}::${nomeOperador}`;
    if (!texto || fetchedForRef.current === fetchKey) return undefined;

    fetchedForRef.current = fetchKey;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('loading');
    setResult('');

    api.post('/compose/refinar-rascunho', {
      rascunho: texto,
      nomeOperador,
    }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const data = response.data || {};
        if (!data.success) {
          showNotification(data.error || 'Não foi possível refinar o rascunho.', 'error');
          handleClose();
          return;
        }
        setResult(typeof data.response === 'string' ? data.response : '');
        setPhase('result');
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError') {
          return;
        }
        const status = err?.response?.status;
        const msg = status === 503
          ? 'Assistente IA indisponível: Gemini não configurado no servidor.'
          : (err?.response?.data?.error || 'Falha na comunicação com o servidor.');
        showNotification(msg, 'error');
        handleClose();
      });

    return () => {
      controller.abort();
    };
  }, [open, draftText, nomeOperador, showNotification, handleClose]);

  const handleApply = useCallback(() => {
    if (!result.trim()) return;
    onApply(result);
    showNotification('Texto substituído no compose.', 'success');
    handleClose();
  }, [result, onApply, handleClose, showNotification]);

  if (!open) return null;

  return createPortal(
    <div
      className="compose-refinar-modal-backdrop"
      style={{ zIndex: MODAL_Z }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose({ userCanceled: phase === 'loading' });
        }
      }}
    >
      <div
        className="compose-refinar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-refinar-title"
        aria-busy={phase === 'loading'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="compose-refinar-modal__header">
          <h3 id="compose-refinar-title" className="compose-refinar-modal__title">
            <i className="fas fa-robot" aria-hidden="true" /> Assistente IA — Refinar rascunho
          </h3>
          <button
            type="button"
            className="compose-refinar-modal__close"
            aria-label="Fechar"
            onClick={() => handleClose({ userCanceled: phase === 'loading' })}
          >
            ×
          </button>
        </header>

        {phase === 'loading' ? (
          <div className="compose-refinar-modal__loading">
            <i className="ti ti-loader compose-refinar-modal__spin" aria-hidden="true" />
            <p>Refinando seu rascunho com Gemini…</p>
            <p className="compose-refinar-modal__loading-hint">Isso pode levar alguns segundos.</p>
            <button
              type="button"
              className="btn-secondary compose-refinar-modal__cancel"
              onClick={() => handleClose({ userCanceled: true })}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="ai-review-wrap compose-refinar-modal__body">
            <div className="ai-review-panel">
              <div className="ai-review-status">
                <i className="fas fa-magic" aria-hidden="true" />
                <span>Texto sugerido para substituir o compose</span>
              </div>
              <pre className="ai-revised-text compose-refinar-modal__text">{result}</pre>
              <div className="ai-review-actions">
                <button
                  type="button"
                  className="btn-primary ai-review-apply"
                  onClick={handleApply}
                >
                  Substituir texto
                </button>
                <button
                  type="button"
                  className="btn-secondary ai-review-discard"
                  onClick={handleClose}
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
