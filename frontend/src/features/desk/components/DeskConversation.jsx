/**
 * DeskConversation v1.3.0 — sugestão IA via OpenAI + POPs
 * VERSION: v1.3.0 | DATE: 2026-07-03
 */
import React, { useState, useEffect } from 'react';
import { composeMarkupToSafeHtml, composeTextHasFormatting } from '../../../services/desk/composeFormatPreview';
import { sanitizeComposeHtml } from '../../../services/desk/composeRichEditor';

function MessageBubbleText({ text }) {
  const raw = String(text || '');
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return (
      <span
        className="msg-bubble__formatted"
        dangerouslySetInnerHTML={{ __html: sanitizeComposeHtml(raw) }}
      />
    );
  }
  if (!composeTextHasFormatting(raw)) {
    return raw;
  }

  return (
    <span
      className="msg-bubble__formatted"
      dangerouslySetInnerHTML={{ __html: composeMarkupToSafeHtml(raw) }}
    />
  );
}

export default function DeskConversation({
  ticket,
  messages,
  onUseIaReply,
  iaReply = '',
  iaReplyLoading = false,
  iaWaitingMessage = '',
  iaShowBar = false,
  iaHasSuggestion = false,
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const thread = messages || [];

  useEffect(() => {
    setIaVisible(true);
  }, [ticket?.id]);

  const displayText = iaReplyLoading || !iaHasSuggestion
    ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
    : iaReply;

  const canUseReply = iaHasSuggestion && !iaReplyLoading && Boolean(iaReply);

  return (
    <div className="conversation" id="conversation">
      {thread.length === 0 ? (
        <div className="crm-empty-state conversation-empty">
          <p>Nenhuma mensagem pública neste atendimento.</p>
        </div>
      ) : (
        thread.map((msg, i) => {
          const isRight = msg.type === 'agent' || msg.type === 'internal';
          return (
          <div key={i} className={'msg-row' + (isRight ? ' msg-row--agent' : '')}>
            <div className={'msg-avatar msg-avatar--' + (msg.type === 'internal' ? 'agent' : msg.type)}>{msg.initials || '?'}</div>
            <div className="msg-body">
              <div className={'msg-bubble msg-bubble--' + msg.type}>
                <MessageBubbleText text={msg.text} />
              </div>
              <div className="msg-meta">{msg.meta}</div>
            </div>
          </div>
          );
        })
      )}
      {iaVisible && iaShowBar && (
        <div className={'ia-suggestion-bar' + (iaReplyLoading ? ' ia-suggestion-bar--loading' : '')} id="iaSuggestionBar">
          <span className="ia-suggestion-bar__label">IA</span>
          <span className="ia-suggestion-bar__text" id="iaReplyText">{displayText}</span>
          <div className="ia-suggestion-bar__actions">
            <button
              type="button"
              className="ia-suggestion-bar__btn"
              disabled={!canUseReply}
              onClick={() => onUseIaReply(iaReply)}
            >
              Usar resposta
            </button>
            <button type="button" className="ia-suggestion-bar__btn ia-suggestion-bar__btn--dismiss" onClick={() => setIaVisible(false)}>Não usar</button>
          </div>
        </div>
      )}
    </div>
  );
}
