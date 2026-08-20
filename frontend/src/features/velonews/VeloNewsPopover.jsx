/**
 * VeloNewsPopover v1.1.0 — sininho com recados de ticket + VeloNews
 * VERSION: v1.1.0 | DATE: 2026-08-20 | AUTHOR: VeloHub Development Team
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatVeloNewsTime, isNewsAcknowledged } from './veloNewsHelpers';
import { useVeloNews } from './VeloNewsProvider';
import { useNotifications } from '../../context/NotificationContext';

function isInsideNode(parent, target) {
  return parent instanceof Node && target instanceof Node && parent.contains(target);
}

export default function VeloNewsPopover() {
  const navigate = useNavigate();
  const {
    popoverOpen,
    closePopover,
    veloNews,
    acknowledgedNewsIds,
    loading,
    error,
    refreshFeed,
    handleOpenNewsItem,
    openHistoryModal,
    bellAnchorRef,
  } = useVeloNews();
  const { notifications, markPersistedRead, hydratePersisted } = useNotifications();

  const [railStyle, setRailStyle] = useState(null);
  const deskNotifications = notifications.filter((item) => item.persistId);

  useEffect(() => {
    if (!popoverOpen) {
      setRailStyle(null);
      return undefined;
    }
    hydratePersisted();

    const updatePosition = () => {
      const el = bellAnchorRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setRailStyle({
        position: 'fixed',
        top: Math.max(12, Math.min(rect.top, window.innerHeight - 520)),
        left: rect.right + 10,
        right: 'auto',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [popoverOpen, bellAnchorRef, hydratePersisted]);

  useEffect(() => {
    if (!popoverOpen) return undefined;

    const handlePointer = (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (bellAnchorRef?.current && isInsideNode(bellAnchorRef.current, target)) return;
      if (target instanceof Element && target.closest?.('.velonews-popover')) return;
      closePopover();
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') closePopover();
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [popoverOpen, closePopover, bellAnchorRef]);

  const handleOpenDeskNotification = useCallback(async (item) => {
    if (item.persistId) {
      await markPersistedRead(item.persistId);
    }
    const ticketId = item.ticketId ? String(item.ticketId) : '';
    closePopover();
    if (!ticketId) return;
    if (item.especialOrgao) {
      navigate(`/especiais/${item.especialOrgao}/ticket/${encodeURIComponent(ticketId)}`);
      return;
    }
    navigate(`/tickets?desk=v2&ticket=${encodeURIComponent(ticketId)}`);
  }, [closePopover, markPersistedRead, navigate]);

  if (!popoverOpen) return null;

  const hasDesk = deskNotifications.length > 0;
  const hasNews = veloNews.length > 0;
  const showNewsEmpty = !loading && !error && !hasNews;
  const showGlobalEmpty = !hasDesk && showNewsEmpty;

  return (
    <div
      className="velonews-popover velonews-popover--from-rail"
      style={railStyle || undefined}
      role="dialog"
      aria-label="Notificações"
    >
      <div className="velonews-popover__header">
        <div>
          <h3 className="velonews-popover__title">Notificações</h3>
          <p className="velonews-popover__subtitle">Tickets, alertas e avisos do time</p>
        </div>
        <button type="button" className="velonews-popover__close" onClick={closePopover} aria-label="Fechar">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </div>

      <div className="velonews-popover__body">
        {hasDesk ? (
          <section className="velonews-popover__section" aria-label="Recados de ticket">
            <h4 className="velonews-popover__section-title">Tickets</h4>
            <ul className="velonews-popover__list">
              {deskNotifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={'velonews-popover__item' + (item.lida ? '' : ' is-unread')}
                    onClick={() => handleOpenDeskNotification(item)}
                  >
                    <div className="velonews-popover__item-head">
                      <strong>{item.message}</strong>
                    </div>
                    {item.protocolo ? (
                      <p className="velonews-popover__excerpt">{item.protocolo}</p>
                    ) : null}
                    <time>{formatVeloNewsTime(item.createdAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="velonews-popover__section" aria-label="VeloNews">
          {hasDesk ? <h4 className="velonews-popover__section-title">VeloNews</h4> : null}

          {loading ? (
            <div className="velonews-popover__empty">
              <i className="ti ti-loader-2 velonews-popover__empty-icon" aria-hidden="true" />
              <p>Carregando notícias…</p>
            </div>
          ) : error ? (
            <div className="velonews-popover__empty">
              <i className="ti ti-alert-circle velonews-popover__empty-icon" aria-hidden="true" />
              <p>{error}</p>
              <button type="button" className="ws360-btn ws360-btn--primary" onClick={refreshFeed}>
                Tentar novamente
              </button>
            </div>
          ) : showGlobalEmpty ? (
            <div className="velonews-popover__empty">
              <i className="ti ti-bell-off velonews-popover__empty-icon" aria-hidden="true" />
              <p>Nenhuma notificação no momento.</p>
            </div>
          ) : showNewsEmpty ? (
            <div className="velonews-popover__empty velonews-popover__empty--compact">
              <p>Nenhuma notícia publicada no momento.</p>
            </div>
          ) : (
            <ul className="velonews-popover__list">
              {veloNews.map((item) => {
                const isAcknowledged = isNewsAcknowledged(item._id, acknowledgedNewsIds);
                const isCritical = item.is_critical === 'Y';
                const isSolved = item.solved === true;
                const isUnread = !isAcknowledged;
                const frameClass = isSolved
                  ? ' solved-news-frame'
                  : (isCritical && !isAcknowledged && !isSolved ? ' critical-news-frame' : '');

                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      className={'velonews-popover__item' + frameClass + (isUnread ? ' is-unread' : '')}
                      onClick={() => handleOpenNewsItem(item)}
                    >
                      <div className="velonews-popover__item-head">
                        <strong>{item.title}</strong>
                        {isSolved ? <span className="solved-badge">Resolvido</span> : null}
                        {isCritical && !isSolved && !isAcknowledged ? (
                          <span className="velonews-popover__badge-critical">Crítica</span>
                        ) : null}
                      </div>
                      <p className="velonews-popover__excerpt">
                        {(item.content || '').replace(/<[^>]+>/g, '').slice(0, 140)}
                        {(item.content || '').length > 140 ? '…' : ''}
                      </p>
                      <time>{formatVeloNewsTime(item.createdAt)}</time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {!loading && !error && veloNews.length > 0 ? (
        <div className="velonews-popover__footer">
          <button type="button" className="velonews-popover__see-all" onClick={openHistoryModal}>
            Ver tudo
          </button>
        </div>
      ) : null}
    </div>
  );
}
