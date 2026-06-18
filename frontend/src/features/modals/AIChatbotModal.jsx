/**
 * Modal Assistente IA
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';

export default function AIChatbotModal({ open, onClose }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu assistente IA. Como posso ajudá-lo hoje?' }
  ]);

  if (!open) return null;

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: input }, { role: 'assistant', text: 'Entendi. Estou analisando sua solicitação no contexto do cockpit.' }]);
    setInput('');
  };

  return (
    <div id="aiChatbotModal" className="modal" style={{ display: 'flex' }}>
      <div className="modal-content ai-chatbot-modal">
        <div className="modal-header">
          <h3><i className="fas fa-robot" /> Assistente IA</h3>
          <button type="button" className="close-btn" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          <div className="ai-chat-container">
            <div className="ai-chat-messages" id="aiChatMessages">
              {messages.map((m, i) => (
                <div key={i} className={'ai-message ai-' + m.role}>
                  <div className="ai-content"><p>{m.text}</p></div>
                </div>
              ))}
            </div>
            <div className="ai-chat-input">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua pergunta…" onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button type="button" className="btn-primary" onClick={send}><i className="fas fa-paper-plane" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
