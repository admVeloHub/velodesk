/**
 * VeloNewsHistoryModal v1.0.0 — histórico completo (paridade VeloHub)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAllVeloNews } from '../../api/veloNewsApi';
import { formatResponseText } from '../../utils/velonews/textFormatter';
import { processContentHtml } from '../../utils/velonews/processContentHtml';
import { isNewsAcknowledged } from './veloNewsHelpers';
import { useVeloNews } from './VeloNewsProvider';

const ITEMS_PER_PAGE = 10;

export default function VeloNewsHistoryModal() {
  const { historyOpen, closeHistoryModal, acknowledgedNewsIds } = useVeloNews();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    if (!historyOpen) return undefined;
    let cancelled = false;

    (async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const list = await fetchAllVeloNews();
        if (!cancelled) setHistoryItems(list);
      } catch (e) {
        if (!cancelled) {
          setHistoryError(e?.message || 'Não foi possível carregar o histórico.');
          setHistoryItems([]);
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [historyOpen]);

  useEffect(() => {
    if (historyOpen) {
      setSearchTerm('');
      setFilterType('all');
      setCurrentPage(1);
    }
  }, [historyOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const filteredNews = useMemo(() => historyItems.filter((item) => {
    const title = (item.title || '').toLowerCase();
    const content = (item.content || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || title.includes(q) || content.includes(q);

    let matchesFilter = true;
    switch (filterType) {
      case 'critical':
        matchesFilter = item.is_critical === 'Y';
        break;
      case 'solved':
        matchesFilter = item.solved === true;
        break;
      case 'recent': {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        matchesFilter = new Date(item.createdAt) >= oneWeekAgo;
        break;
      }
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  }), [historyItems, searchTerm, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentNews = filteredNews.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (!historyOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeHistoryModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [historyOpen, closeHistoryModal]);

  if (!historyOpen) return null;

  return createPortal(
    <>
      <button type="button" className="velonews-history-modal__backdrop" aria-label="Fechar" onClick={closeHistoryModal} />
      <div className="velonews-history-modal" role="dialog" aria-modal="true" aria-labelledby="velonewsHistoryTitle">
        <header className="velonews-history-modal__header">
          <h2 id="velonewsHistoryTitle">Histórico de Notícias</h2>
          <button type="button" className="velonews-history-modal__close" onClick={closeHistoryModal} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="velonews-history-modal__filters">
          <div className="velonews-history-modal__search">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por título ou conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="velonews-history-modal__filter-tabs">
            {[
              ['all', 'Todas'],
              ['critical', 'Críticas'],
              ['solved', 'Resolvidas'],
              ['recent', 'Recentes'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={filterType === id ? 'is-active' : ''}
                onClick={() => setFilterType(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="velonews-history-modal__list">
          {historyLoading ? (
            <div className="velonews-history-modal__state">
              <i className="ti ti-loader-2" aria-hidden="true" />
              <p>Carregando histórico…</p>
            </div>
          ) : historyError ? (
            <div className="velonews-history-modal__state velonews-history-modal__state--error">
              <p>{historyError}</p>
            </div>
          ) : currentNews.length === 0 ? (
            <div className="velonews-history-modal__state">
              <p>
                {searchTerm || filterType !== 'all'
                  ? 'Nenhuma notícia encontrada com os filtros aplicados'
                  : 'Nenhuma notícia disponível'}
              </p>
            </div>
          ) : (
            currentNews.map((item) => {
              const isSolved = item.solved === true;
              const isAcknowledged = isNewsAcknowledged(item._id, acknowledgedNewsIds);
              const shouldRemoveHighlight = isAcknowledged || isSolved;
              const html = processContentHtml(
                formatResponseText(item.content || '', 'velonews'),
                item?.media?.images || []
              );

              return (
                <article
                  key={item._id}
                  className={
                    'velonews-history-modal__item'
                    + (item.is_critical === 'Y' && !shouldRemoveHighlight ? ' is-critical' : '')
                    + (isSolved ? ' solved-news-frame' : '')
                  }
                >
                  <div className="velonews-history-modal__item-head">
                    <h3>{item.title}</h3>
                    <div>
                      {isSolved ? <span className="solved-badge">Resolvido</span> : null}
                      {item.is_critical === 'Y' && !isSolved && !shouldRemoveHighlight ? (
                        <span className="velonews-popover__badge-critical">Crítica</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={'velonews-history-modal__item-body' + (isSolved ? ' solved-news-content' : '')}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  <time>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString('pt-BR')
                      : ''}
                  </time>
                </article>
              );
            })
          )}
        </div>

        {!historyLoading && !historyError && totalPages > 1 ? (
          <footer className="velonews-history-modal__pagination">
            <span>
              Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredNews.length)} de {filteredNews.length}
            </span>
            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>{currentPage} de {totalPages}</span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </>,
    document.body
  );
}
