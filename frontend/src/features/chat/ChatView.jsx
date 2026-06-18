/**
 * Chat / Mensagens WhatsApp
 * VERSION: v2.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { whatsappApi } from '../../api/client';

const DEFAULT_THREADS = [
  { id: '1', name: 'Maria Oliveira', preview: 'Internet lenta após 22h', channel: 'WhatsApp', unread: 2 },
  { id: '2', name: 'João Pereira', preview: 'Bloqueio por inadimplência', channel: 'Portal', unread: 0 },
];

export default function ChatView() {
  const [connected, setConnected] = useState(false);
  const [threads, setThreads] = useState(DEFAULT_THREADS);
  const [active, setActive] = useState(DEFAULT_THREADS[0]);
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
          {threads.map((t) => (
            <button key={t.id} type="button" className={'chat-thread' + (active.id === t.id ? ' active' : '')} onClick={() => setActive(t)}>
              <strong>{t.name}</strong>
              <span>{t.preview}</span>
              {t.unread > 0 && <span className="chat-unread">{t.unread}</span>}
            </button>
          ))}
        </aside>
        <section className="chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header className="chat-panel__header"><h3>{active.name}</h3><span>{active.channel}</span></header>
          <div className="chat-messages" style={{ flex: 1, padding: 16 }}>
            {messages.length ? messages.map((m, i) => (
              <div key={i} className="chat-msg chat-msg--in">{m.text || m.body || m.message}</div>
            )) : (
              <div className="chat-msg chat-msg--in">Olá, preciso de ajuda com meu plano.</div>
            )}
          </div>
          <footer className="chat-compose" style={{ display: 'flex', gap: 8, padding: 16 }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite uma mensagem…" style={{ flex: 1 }} />
            <button type="button" className="btn-primary" onClick={handleSend} disabled={sending}>Enviar</button>
          </footer>
        </section>
      </div>
    </div>
  );
}
