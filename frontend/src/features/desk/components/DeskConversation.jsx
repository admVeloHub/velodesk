/**
 * DeskConversation v1.1.0 — thread registro com balões client/agent/internal
 * VERSION: v1.1.0 | DATE: 2026-07-02
 */
import React, { useState } from 'react';
import { buildIaReply } from '../../../services/desk/utils';

export default function DeskConversation({ ticket, messages, composeText, onUseIaReply }) {
  const [iaVisible, setIaVisible] = useState(true);
  const iaReply = buildIaReply(ticket);
  const thread = messages || [];

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
              <div className={'msg-bubble msg-bubble--' + msg.type}>{msg.text}</div>
              <div className="msg-meta">{msg.meta}</div>
            </div>
          </div>
          );
        })
      )}
      {iaVisible && (
        <div className="ia-suggestion-bar" id="iaSuggestionBar">
          <span className="ia-suggestion-bar__label">IA</span>
          <span className="ia-suggestion-bar__text" id="iaReplyText">{iaReply}</span>
          <div className="ia-suggestion-bar__actions">
            <button type="button" className="ia-suggestion-bar__btn" onClick={() => onUseIaReply(iaReply)}>Usar resposta</button>
            <button type="button" className="ia-suggestion-bar__btn ia-suggestion-bar__btn--dismiss" onClick={() => setIaVisible(false)}>Não usar</button>
          </div>
        </div>
      )}
    </div>
  );
}
