/**
 * VeloNewsPopover v1.0.2 — popover do sininho
 * VERSION: v1.0.2 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { formatVeloNewsTime, isNewsAcknowledged } from './veloNewsHelpers';
import { useVeloNews } from './VeloNewsProvider';

function isInsideNode(parent, target) {
  return parent instanceof Node && target instanceof Node && parent.contains(target);
}

export default function VeloNewsPopover() {
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

  const [railStyle, setRailStyle] = useState(null);

  useEffect(() => {
    if (!popoverOpen) {
      setRailStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const el = bellAnchorRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setRailStyle({
        position: 'fixed',
        top: Math.max(12, Math.min(rect.top, window.innerHeight - 460)),
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
  }, [popoverOpen, bellAnchorRef]);

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

  if (!popoverOpen) return null;

  return (
    <div
      className="velonews-popover velonews-popover--from-rail"
      style={railStyle || undefined}
      role="dialog"
      aria-label="Noticiário VeloNews"
    >
      <div className="velonews-popover__header">
        <div>
          <h3 className="velonews-popover__title">VeloNews</h3>
          <p className="velonews-popover__subtitle">Atualizações e avisos para o time de atendimento</p>
        </div>
        <button type="button" className="velonews-popover__close" onClick={closePopover} aria-label="Fechar">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </div>

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
      ) : veloNews.length === 0 ? (
        <div className="velonews-popover__empty">
          <i className="ti ti-bell-off velonews-popover__empty-icon" aria-hidden="true" />
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
