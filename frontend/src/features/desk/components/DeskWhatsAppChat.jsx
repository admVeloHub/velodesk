/**
 * DeskWhatsAppChat v1.0.0 — conversa estilo WhatsApp no ticket
 */
import React, { useState, useRef } from 'react';
import {
  buildIaReply,
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
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const inputRef = useRef(null);
  const contact = getClientContactFields(ticket, client);
  const iaReply = buildIaReply(ticket);
  const chatMessages = messages.filter((m) => m.type !== 'system');
  const dateIso = ticket.createdAt || chatMessages[0]?.timestamp;

  const handleEditIa = () => {
    onUseIaReply(iaReply);
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
        {dateIso && (
          <div className="wa-chat__date-sep">{formatWaDateSeparator(dateIso)}</div>
        )}

        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={'wa-msg' + (msg.type === 'agent' ? ' wa-msg--out' : ' wa-msg--in')}
          >
            <div
              className={
                'wa-msg__bubble' +
                (msg.type === 'agent' ? ' wa-msg__bubble--out' : ' wa-msg__bubble--in')
              }
            >
              <span className="wa-msg__text">{msg.text}</span>
              <span className="wa-msg__time">
                {formatWaTime(msg.timestamp)}
                {msg.type === 'agent' && (
                  <i className="ti ti-checks wa-msg__checks" aria-hidden="true" />
                )}
              </span>
            </div>
          </div>
        ))}

        {iaVisible && (
          <div className="wa-ia-card" id="iaSuggestionBar">
            <div className="wa-ia-card__head">
              <i className="ti ti-sparkles" aria-hidden="true" />
              <span className="wa-ia-card__label">SUGESTÃO IA</span>
            </div>
            <p className="wa-ia-card__text" id="iaReplyText">{iaReply}</p>
            <div className="wa-ia-card__actions">
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--primary"
                onClick={() => onUseIaReply(iaReply)}
              >
                Usar resposta
              </button>
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--outline"
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
