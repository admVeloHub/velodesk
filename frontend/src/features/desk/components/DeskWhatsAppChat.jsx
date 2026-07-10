/**
 * DeskWhatsAppChat v1.2.1 — oculta sugestão IA após usar resposta
 * VERSION: v1.2.1 | DATE: 2026-07-07
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  getClientContactFields,
  getInitials,
  formatWaTime,
  formatWaDateSeparator,
} from '../../../services/desk/utils';

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
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const inputRef = useRef(null);
  const lastIaReplyRef = useRef('');
  const contact = getClientContactFields(ticket, client);
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

  const displayText = iaReplyLoading || !iaHasSuggestion
    ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
    : iaReply;

  const canUseReply = iaHasSuggestion && !iaReplyLoading && Boolean(iaReply);

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
      <header className="wa-chat__header">
        <div className="wa-chat__header-main">
          <div className="wa-chat__avatar">{getInitials(contact.name)}</div>
          <div className="wa-chat__header-info">
            <strong className="wa-chat__name">{contact.name}</strong>
            <span className="wa-chat__status">
              online{contact.phone ? ' - ' + contact.phone : ''}
            </span>
          </div>
        </div>
        <div className="wa-chat__header-actions">
          <button type="button" className="wa-chat__header-btn" aria-label="Ligar">
            <i className="fas fa-phone" />
          </button>
          <button type="button" className="wa-chat__header-btn" aria-label="Menu">
            <i className="fas fa-ellipsis-v" />
          </button>
        </div>
      </header>

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
              key={i}
              className={'wa-msg' + (isOut ? ' wa-msg--out' : ' wa-msg--in')}
            >
              <div className={'wa-msg__bubble' + bubbleClass}>
                <span className="wa-msg__text">{msg.text}</span>
                <span className="wa-msg__time">
                  {formatWaTime(msg.timestamp)}
                  {msg.type === 'agent' && (
                    <i className="ti ti-checks wa-msg__checks" aria-hidden="true" />
                  )}
                </span>
              </div>
            </div>
            );
          })
        )}

        {iaVisible && iaShowBar && (
          <div className={'wa-ia-card' + (iaReplyLoading ? ' wa-ia-card--loading' : '')} id="iaSuggestionBar">
            <div className="wa-ia-card__head">
              <i className="ti ti-sparkles" aria-hidden="true" />
              <span className="wa-ia-card__label">SUGESTÃO IA</span>
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
