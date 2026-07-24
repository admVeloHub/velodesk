/**
 * WorkflowComunicacaoModal v1.2.0 — ao abrir, hidrata thread via GET detalhe
 * VERSION: v1.2.0 | DATE: 2026-07-24
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  loadComunicacaoWorkflowForTicket,
  readTicketComunicacaoWorkflow,
} from '../../../services/workflow/workflowDecisionHandlers';

function formatMsgTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function scrollThreadToEnd(listRef) {
  requestAnimationFrame(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  });
}

export default function WorkflowComunicacaoModal({
  open,
  busy = false,
  ticket,
  origem = 'workflow',
  title,
  subtitle,
  onClose,
  onSubmit,
}) {
  const [message, setMessage] = useState('');
  const [thread, setThread] = useState([]);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const ticketId = ticket?.id || ticket?._id;

  useEffect(() => {
    if (!open || !ticketId) return undefined;

    let cancelled = false;
    setMessage('');
    setSending(false);
    setThread(readTicketComunicacaoWorkflow(ticket));
    setLoadingThread(true);

    void loadComunicacaoWorkflowForTicket(ticketId)
      .then((result) => {
        if (cancelled) return;
        setThread(result.thread || []);
        scrollThreadToEnd(listRef);
      })
      .catch(() => {
        /* mantém o que já houver no ticket local */
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingThread(false);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }
      });

    return () => { cancelled = true; };
  }, [open, ticketId]);

  useEffect(() => {
    if (!open || sending || loadingThread) return;
    const next = readTicketComunicacaoWorkflow(ticket);
    if (!next.length) return;
    setThread((prev) => (next.length >= prev.length ? next : prev));
  }, [open, sending, loadingThread, ticket]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy && !sending) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, sending, onClose]);

  useEffect(() => {
    if (open) scrollThreadToEnd(listRef);
  }, [open, thread.length]);

  if (!open) return null;

  const locked = busy || sending;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || locked) return;

    const optimistic = {
      mensagem: trimmed,
      data: new Date().toISOString(),
      autor: origem === 'responsavel' ? 'Responsavel: você' : 'WF: você',
      _optimistic: true,
    };
    setThread((prev) => [...prev, optimistic]);
    setMessage('');
    setSending(true);
    scrollThreadToEnd(listRef);

    try {
      const updated = await onSubmit?.(trimmed, origem);
      if (updated) {
        setThread(readTicketComunicacaoWorkflow(updated));
      } else if (ticketId) {
        const refreshed = await loadComunicacaoWorkflowForTicket(ticketId);
        setThread(refreshed.thread || []);
      } else {
        setThread((prev) => prev.map((item) => (
          item._optimistic ? { ...item, _optimistic: false } : item
        )));
      }
    } catch {
      setThread((prev) => prev.filter((item) => !item._optimistic));
      setMessage(trimmed);
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const heading = title
    || (origem === 'responsavel' ? 'Responder solicitação' : 'Pedir informação');

  const modal = (
    <div className="wf-comunicacao-modal__backdrop" role="presentation" onClick={() => !locked && onClose?.()}>
      <div
        className="wf-comunicacao-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-comunicacao-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wf-comunicacao-modal__head">
          <div>
            <h2 id="wf-comunicacao-title">{heading}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="wf-comunicacao-modal__close"
            aria-label="Fechar"
            disabled={locked}
            onClick={onClose}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="wf-comunicacao-modal__thread" ref={listRef}>
          {loadingThread && thread.length === 0 ? (
            <p className="wf-comunicacao-modal__empty">Carregando mensagens…</p>
          ) : thread.length === 0 ? (
            <p className="wf-comunicacao-modal__empty">Nenhuma mensagem ainda. Envie a primeira solicitação.</p>
          ) : (
            thread.map((item, index) => {
              const isWf = String(item.autor || '').startsWith('WF:');
              return (
                <article
                  key={`${item.data || index}-${index}-${item._optimistic ? 'opt' : 'ok'}`}
                  className={
                    'wf-comunicacao-modal__msg'
                    + (isWf ? ' is-wf' : ' is-resp')
                    + (item._optimistic ? ' is-pending' : '')
                  }
                >
                  <header>
                    <strong>{item.autor || '—'}</strong>
                    <time>{formatMsgTime(item.data)}</time>
                  </header>
                  <p>{item.mensagem}</p>
                </article>
              );
            })
          )}
        </div>

        <form className="wf-comunicacao-modal__form" onSubmit={handleSubmit}>
          <label htmlFor="wf-comunicacao-input">Mensagem</label>
          <textarea
            id="wf-comunicacao-input"
            ref={textareaRef}
            rows={3}
            value={message}
            disabled={locked}
            placeholder={origem === 'responsavel'
              ? 'Escreva a resposta para o time do workflow…'
              : 'O que você precisa saber do responsável?'}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />
          <div className="wf-comunicacao-modal__actions">
            <button type="button" className="wf-comunicacao-modal__btn wf-comunicacao-modal__btn--ghost" disabled={locked} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="wf-comunicacao-modal__btn wf-comunicacao-modal__btn--primary" disabled={locked || !message.trim()}>
              <i className="ti ti-send" aria-hidden="true" />
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
