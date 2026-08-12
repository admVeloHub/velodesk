/**
 * NotificationPanel v1.0.0 — painel do sininho (workflow CTA + telefonia)
 * VERSION: v1.0.0 | DATE: 2026-08-12
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationPanel() {
  const navigate = useNavigate();
  const {
    notifications,
    panelOpen,
    togglePanel,
    markPersistedRead,
    hydratePersisted,
  } = useNotifications();

  const handleOpen = useCallback(async (item) => {
    if (item.persistId) {
      await markPersistedRead(item.persistId);
    }
    const ticketId = item.ticketId ? String(item.ticketId) : '';
    if (ticketId) {
      togglePanel();
      navigate(`/tickets?desk=v2&ticket=${encodeURIComponent(ticketId)}`);
      return;
    }
    togglePanel();
  }, [markPersistedRead, navigate, togglePanel]);

  if (!panelOpen) return null;

  return (
    <div className="desk-notif-panel" role="dialog" aria-label="Notificações">
      <div className="desk-notif-panel__backdrop" onClick={togglePanel} aria-hidden="true" />
      <div className="desk-notif-panel__card">
        <header className="desk-notif-panel__head">
          <h3>Notificações</h3>
          <button type="button" className="desk-notif-panel__refresh" onClick={() => hydratePersisted()} title="Atualizar">
            <i className="ti ti-refresh" aria-hidden="true" />
          </button>
          <button type="button" className="desk-notif-panel__close" onClick={togglePanel} aria-label="Fechar">
            ×
          </button>
        </header>
        <ul className="desk-notif-panel__list">
          {notifications.length === 0 ? (
            <li className="desk-notif-panel__empty">Nenhuma notificação</li>
          ) : (
            notifications.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={'desk-notif-panel__item' + (item.lida ? ' is-read' : '')}
                  onClick={() => handleOpen(item)}
                >
                  <span className="desk-notif-panel__msg">{item.message}</span>
                  {item.protocolo ? (
                    <span className="desk-notif-panel__meta">{item.protocolo}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
