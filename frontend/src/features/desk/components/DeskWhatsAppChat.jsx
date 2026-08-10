/**
 * DeskWhatsAppChat v1.6.0 — mensagem inicial dedicada + compose só na sessão 24h
 * VERSION: v1.6.0 | DATE: 2026-08-10
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
  onSendInitial,
  waUiState,
  initialSendBusy = false,
  sendBusy = false,
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

  const composeEnabled = waUiState?.composeEnabled !== false;
  const needsInitial = Boolean(waUiState?.needsInitial);
  const awaitingClient = Boolean(waUiState?.awaitingClient);

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
    if (!composeEnabled || !composeText.trim() || sendBusy) return;
    onSend();
  };

  const clientLabel = String(
    client?.name
    || ticket?.clientName
    || ticket?.lateralForm?.clienteNome
    || 'cliente',
  ).trim();

  return (
    <div className="wa-chat" id="waChatView">
      <div className="conversation wa-chat__body" id="conversation">
        {needsInitial && (
          <div className="wa-chat__initial-card" role="region" aria-label="Iniciar conversa WhatsApp">
            <div className="wa-chat__initial-card-icon" aria-hidden="true">
              <i className="ti ti-brand-whatsapp" />
            </div>
            <h3 className="wa-chat__initial-card-title">Iniciar conversa WhatsApp</h3>
            <p className="wa-chat__initial-card-text">
              Para falar com <strong>{clientLabel}</strong> pela primeira vez, envie a mensagem inicial
              aprovada pela Meta (template Velotax com nome e protocolo do chamado).
            </p>
            <button
              type="button"
              className="wa-chat__initial-card-btn"
              onClick={onSendInitial}
              disabled={initialSendBusy || sendBusy}
            >
              {initialSendBusy ? 'Enviando…' : 'Enviar Mensagem Inicial'}
            </button>
          </div>
        )}

        {awaitingClient && !needsInitial && (
          <div className="wa-chat__awaiting-banner" role="status">
            Mensagem inicial enviada. Aguardando resposta de <strong>{clientLabel}</strong> para liberar o texto livre (janela 24h).
          </div>
        )}

        {dateIso && chatMessages.length > 0 && (
          <div className="wa-chat__date-sep">{formatWaDateSeparator(dateIso)}</div>
        )}

        {chatMessages.length === 0 && !needsInitial ? (
          <div className="crm-empty-state conversation-empty">
            <p>Nenhuma mensagem WhatsApp neste atendimento.</p>
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

        {composeEnabled && iaVisible && iaShowBar && (
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

      <footer className={'wa-chat__footer' + (composeEnabled ? '' : ' wa-chat__footer--locked')}>
        {!composeEnabled && (
          <p className="wa-chat__session-hint" role="status">
            {needsInitial
              ? 'Use o botão acima para enviar a mensagem inicial. O campo de texto será liberado após a resposta do cliente.'
              : 'Aguardando resposta do cliente para continuar a conversa.'}
          </p>
        )}
        <div className="wa-chat__input-bar">
          <button type="button" className="wa-chat__input-icon" aria-label="Emoji" disabled={!composeEnabled}>
            <i className="far fa-smile" />
          </button>
          <input
            ref={inputRef}
            type="text"
            className="wa-chat__input"
            placeholder={composeEnabled ? 'Escreva uma mensagem...' : 'Disponível após resposta do cliente'}
            spellCheck
            lang="pt-BR"
            autoCorrect="on"
            autoCapitalize="sentences"
            value={composeText}
            disabled={!composeEnabled || sendBusy}
            onChange={(e) => onComposeTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="wa-chat__input-icon" aria-label="Anexar" disabled={!composeEnabled}>
            <i className="fas fa-paperclip" />
          </button>
        </div>
        <button
          type="button"
          className="wa-chat__send"
          aria-label="Enviar mensagem"
          disabled={!composeEnabled || sendBusy || !composeText.trim()}
          onClick={handleSend}
        >
          <i className="fas fa-paper-plane" aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
