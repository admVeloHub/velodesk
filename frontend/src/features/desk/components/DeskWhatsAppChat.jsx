/**
 * DeskWhatsAppChat v1.4.0 — confirmação de entrega (sent/delivered/read)
 * VERSION: v1.4.0 | DATE: 2026-08-10
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  formatWaTime,
  formatWaDateSeparator,
} from '../../../services/desk/utils';

function renderDeliveryChecks(msg) {
  if (msg.type !== 'agent') return null;

  const status = String(msg.deliveryStatus || 'sent').toLowerCase();
  const errorMessage = String(msg.deliveryErrorMessage || '').trim();

  if (status === 'failed' || status === 'undelivered') {
    return (
      <i
        className="ti ti-alert-circle wa-msg__checks wa-msg__checks--failed"
        aria-hidden="true"
        title={errorMessage || 'Falha na entrega'}
      />
    );
  }

  if (status === 'queued' || status === 'sending') {
    return (
      <i
        className="ti ti-clock wa-msg__checks wa-msg__checks--pending"
        aria-hidden="true"
        title="Enviando…"
      />
    );
  }

  if (status === 'sent') {
    return (
      <i
        className="ti ti-check wa-msg__checks wa-msg__checks--sent"
        aria-hidden="true"
        title="Enviada"
      />
    );
  }

  if (status === 'delivered') {
    return (
      <i
        className="ti ti-checks wa-msg__checks wa-msg__checks--delivered"
        aria-hidden="true"
        title="Entregue"
      />
    );
  }

  return (
    <i
      className="ti ti-checks wa-msg__checks wa-msg__checks--read"
      aria-hidden="true"
      title="Lida"
    />
  );
}

export default function DeskWhatsAppChat({
  ticket,
  client,
  messages,
  composeText,
  onComposeTextChange,
  onUseIaReply,
  onSend,
  iaReply = '',
  iaReplyLoading = false,
  iaWaitingMessage = '',
  iaShowBar = false,
  iaHasSuggestion = false,
  iaError = '',
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const inputRef = useRef(null);
  const lastIaReplyRef = useRef('');
  const chatMessages = messages || [];
  const dateIso = chatMessages[0]?.timestamp || ticket.createdAt;

  useEffect(() => {
    setIaVisible(true);
    lastIaReplyRef.current = '';
  }, [ticket?.id]);

  useEffect(() => {
    if (!iaHasSuggestion || !iaReply || iaReply === lastIaReplyRef.current) return;
    setIaVisible(true);
  }, [iaReply, iaHasSuggestion]);

  const displayText = iaError
    ? iaError
    : iaReplyLoading || !iaHasSuggestion
      ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
      : iaReply;

  const canUseReply = iaHasSuggestion && !iaReplyLoading && Boolean(iaReply) && !iaError;

  const handleUseIaReply = () => {
    if (!canUseReply) return;
    onUseIaReply(iaReply);
    lastIaReplyRef.current = iaReply;
    setIaVisible(false);
  };

  const handleEditIa = () => {
    if (!canUseReply) return;
    onUseIaReply(iaReply);
    lastIaReplyRef.current = iaReply;
    setIaVisible(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!composeText.trim()) return;
    onSend();
  };

  return (
    <div className="wa-chat" id="waChatView">
      <div className="conversation wa-chat__body" id="conversation">
        {dateIso && chatMessages.length > 0 && (
          <div className="wa-chat__date-sep">{formatWaDateSeparator(dateIso)}</div>
        )}

        {chatMessages.length === 0 ? (
          <div className="crm-empty-state conversation-empty">
            <p>Nenhuma mensagem pública neste atendimento.</p>
          </div>
        ) : (
          chatMessages.map((msg, i) => {
            const isOut = msg.type === 'agent' || msg.type === 'internal';
            const bubbleClass = msg.type === 'internal'
              ? ' wa-msg__bubble--internal'
              : (isOut ? ' wa-msg__bubble--out' : ' wa-msg__bubble--in');
            return (
            <div
              key={msg.id || i}
              className={'wa-msg' + (isOut ? ' wa-msg--out' : ' wa-msg--in')}
            >
              <div className={'wa-msg__bubble' + bubbleClass}>
                <span className="wa-msg__text">{msg.text}</span>
                <span className="wa-msg__time">
                  {formatWaTime(msg.timestamp)}
                  {renderDeliveryChecks(msg)}
                </span>
              </div>
            </div>
            );
          })
        )}

        {iaVisible && iaShowBar && (
          <div className={'wa-ia-card' + (iaReplyLoading ? ' wa-ia-card--loading' : '') + (iaError ? ' wa-ia-card--error' : '')} id="iaSuggestionBar">
            <div className="wa-ia-card__head">
              <i className="ti ti-sparkles" aria-hidden="true" />
              <span className="wa-ia-card__label">SUGESTÃO</span>
            </div>
            <p className="wa-ia-card__text" id="iaReplyText">{displayText}</p>
            <div className="wa-ia-card__actions">
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--primary"
                disabled={!canUseReply}
                onClick={handleUseIaReply}
              >
                Usar resposta
              </button>
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--outline"
                disabled={!canUseReply}
                onClick={handleEditIa}
              >
                Editar
              </button>
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--outline"
                onClick={() => setIaVisible(false)}
              >
                Ignorar
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="wa-chat__footer">
        <div className="wa-chat__input-bar">
          <button type="button" className="wa-chat__input-icon" aria-label="Emoji">
            <i className="far fa-smile" />
          </button>
          <input
            ref={inputRef}
            type="text"
            className="wa-chat__input"
            placeholder="Escreva uma mensagem..."
            spellCheck
            lang="pt-BR"
            autoCorrect="on"
            autoCapitalize="sentences"
            value={composeText}
            onChange={(e) => onComposeTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="wa-chat__input-icon" aria-label="Anexar">
            <i className="fas fa-paperclip" />
          </button>
        </div>
        <button type="button" className="wa-chat__send" aria-label="Enviar" onClick={handleSend}>
          <i className="fas fa-paper-plane" />
        </button>
      </footer>
    </div>
  );
}
