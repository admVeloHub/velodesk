/**
 * DeskConversation v1.3.2 — exibe erro de sugestão IA na barra
 * VERSION: v1.3.2 | DATE: 2026-07-10
 */
import React, { useState, useEffect, useRef } from 'react';
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
  iaError = '',
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const lastIaReplyRef = useRef('');
  const thread = messages || [];

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

  return (
    <div className="conversation" id="conversation">
      {thread.length === 0 ? (
        <div className="crm-empty-state conversation-empty">
          <p>Nenhuma mensagem pública neste atendimento.</p>
        </div>
      ) : (
        thread.map((msg, i) => {
          if (msg.type === 'system') {
            const isWorkflowInfo = /Pedido de informação/i.test(String(msg.text || ''));
            return (
              <div key={i} className="msg-row msg-row--system">
                <div className="msg-body msg-body--system">
                  <div className={'msg-bubble msg-bubble--system' + (isWorkflowInfo ? ' msg-bubble--workflow-info' : '')}>
                    <MessageBubbleText text={msg.text} />
                  </div>
                  {msg.meta ? <div className="msg-meta">{msg.meta}</div> : null}
                </div>
              </div>
            );
          }
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
        <div className={'ia-suggestion-bar' + (iaReplyLoading ? ' ia-suggestion-bar--loading' : '') + (iaError ? ' ia-suggestion-bar--error' : '')} id="iaSuggestionBar">
          <span className="ia-suggestion-bar__label">IA</span>
          <span className="ia-suggestion-bar__text" id="iaReplyText">{displayText}</span>
          <div className="ia-suggestion-bar__actions">
            {!iaError ? (
            <>
            <button
              type="button"
              className="ia-suggestion-bar__btn"
              disabled={!canUseReply}
              onClick={handleUseIaReply}
            >
              Usar resposta
            </button>
            <button type="button" className="ia-suggestion-bar__btn ia-suggestion-bar__btn--dismiss" onClick={() => setIaVisible(false)}>Não usar</button>
            </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
