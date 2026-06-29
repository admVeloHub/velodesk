/**
 * Chat / Mensagens WhatsApp
 * VERSION: v2.2.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { whatsappApi } from '../../api/client';

export default function ChatView() {
  const [connected, setConnected] = useState(false);
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    whatsappApi.status()
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected || !active?.id) return;
    whatsappApi.messages(active.id)
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [connected, active?.id]);

  useEffect(() => {
    if (!connected) return;
    whatsappApi.conversations()
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setThreads(data);
          setActive(data[0]);
        }
      })
      .catch(() => {});
  }, [connected]);

  const handleSend = async () => {
    if (!message.trim() || !active?.id) return;
    setSending(true);
    try {
      await whatsappApi.send(active.id, message.trim());
      setMessage('');
      const data = await whatsappApi.messages(active.id);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      /* placeholder UI mantém estado local */
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="chat" className="page active">
      <div className="page-header"><h2>Mensagens</h2></div>
      <div id="whatsappNotConnected" style={{ display: connected ? 'none' : 'flex', padding: 24, flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <h3>Conecte seu WhatsApp</h3>
        <p>Para começar a usar o chat, vincule sua conta do WhatsApp Business.</p>
        <button type="button" className="btn-primary">Vincular WhatsApp</button>
      </div>
      <div id="whatsappConnected" className="chat-container" style={{ display: connected ? 'flex' : 'none', minHeight: 480 }}>
        <aside className="chat-threads" style={{ width: 280, borderRight: '1px solid var(--border-color, #e2e8f0)' }}>
          {threads.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--text-muted, #64748b)' }}>Nenhuma conversa disponível.</p>
          ) : threads.map((t) => (
            <button key={t.id} type="button" className={'chat-thread' + (active?.id === t.id ? ' active' : '')} onClick={() => setActive(t)}>
              <strong>{t.name}</strong>
              <span>{t.preview}</span>
              {t.unread > 0 && <span className="chat-unread">{t.unread}</span>}
            </button>
          ))}
        </aside>
        <section className="chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header className="chat-panel__header"><h3>{active?.name || 'Conversa'}</h3><span>{active?.channel || ''}</span></header>
          <div className="chat-messages" style={{ flex: 1, padding: 16 }}>
            {messages.length ? messages.map((m, i) => (
              <div key={i} className="chat-msg chat-msg--in">{m.text || m.body || m.message}</div>
            )) : (
              <p style={{ color: 'var(--text-muted, #64748b)' }}>Nenhuma mensagem nesta conversa.</p>
            )}
          </div>
          <footer className="chat-compose" style={{ display: 'flex', gap: 8, padding: 16 }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite uma mensagem…" style={{ flex: 1 }} disabled={!active?.id} />
            <button type="button" className="btn-primary" onClick={handleSend} disabled={sending || !active?.id}>Enviar</button>
          </footer>
        </section>
      </div>
    </div>
  );
}
