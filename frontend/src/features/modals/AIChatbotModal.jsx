/**
 * Assistente IA — popover global (sidebar + desk)
 * VERSION: v2.0.0 | DATE: 2026-06-19
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AIChatbotModal({ open, onClose }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu assistente IA. Como posso ajudá-lo hoje?' },
  ]);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { role: 'user', text: input },
      { role: 'assistant', text: 'Entendi. Estou analisando sua solicitação no contexto do cockpit.' },
    ]);
    setInput('');
  };

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="ai-assistant-popover-backdrop"
        aria-label="Fechar assistente IA"
        onClick={onClose}
      />
      <div
        id="aiChatbotModal"
        className="ai-assistant-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Assistente IA"
        ref={popoverRef}
      >
        <header className="ai-assistant-popover__header">
          <div className="ai-assistant-popover__title">
            <i className="ti ti-robot" aria-hidden="true" />
            <span>Assistente IA</span>
          </div>
          <button type="button" className="ai-assistant-popover__close" onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" />
          </button>
        </header>
        <div className="ai-assistant-popover__body">
          <div className="ai-chat-container">
            <div className="ai-chat-messages" id="aiChatMessages">
              {messages.map((m, i) => (
                <div key={i} className={'ai-message ai-' + m.role}>
                  <div className="ai-content"><p>{m.text}</p></div>
                </div>
              ))}
            </div>
            <div className="ai-chat-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua pergunta…"
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button type="button" className="btn-primary" onClick={send} aria-label="Enviar">
                <i className="ti ti-send" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
