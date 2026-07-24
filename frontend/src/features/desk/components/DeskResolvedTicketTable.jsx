/**
 * DeskResolvedTicketTable — lista tabular de tickets finalizados
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  formatResolvedDateShort,
  getTicketProtocolLabel,
  getTicketResolvedAt,
  getTicketResponsible,
  getTicketTitle,
  sortTicketEntries,
} from '../../../services/desk/utils';

const PAGE_SIZE = 20;

function buildPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('…');
    result.push(page);
  });
  return result;
}

export default function DeskResolvedTicketTable({
  entries = [],
  searchActive = false,
  onSelectTicket,
  onReload,
  refreshing = false,
}) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('finalizacao');
  const [sortDir, setSortDir] = useState('desc');

  const sortedEntries = useMemo(
    () => sortTicketEntries(entries, sortField, sortDir),
    [entries, sortField, sortDir],
  );

  const total = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [entries.length, sortField, sortDir, searchActive]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const pageEntries = sortedEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageNumbers = buildPageNumbers(page, totalPages);

  const handleSortTitulo = () => {
    if (sortField === 'titulo') {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField('titulo');
    setSortDir('asc');
  };

  return (
    <div className="desk-resolved-table" id="deskResolvedTable">
      <header className="desk-resolved-table__header">
        <h2 className="desk-resolved-table__title">Finalizados</h2>
        <div className="desk-resolved-table__header-actions">
          <span className="desk-resolved-table__range">
            {total === 0 ? '0 tickets' : `${pageStart} - ${pageEnd} de ${total} tickets`}
          </span>
          <div className="desk-resolved-table__pagination">
            <button
              type="button"
              className="desk-resolved-table__page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            {pageNumbers.map((item, index) => (
              typeof item === 'number' ? (
                <button
                  key={`page-${item}`}
                  type="button"
                  className={'desk-resolved-table__page-num' + (item === page ? ' is-active' : '')}
                  onClick={() => setPage(item)}
                  aria-label={`Página ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                >
                  {item}
                </button>
              ) : (
                <span key={`ellipsis-${index}`} className="desk-resolved-table__page-ellipsis">{item}</span>
              )
            ))}
            <button
              type="button"
              className="desk-resolved-table__page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Próxima página"
            >
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className={'crm-icon-btn desk-resolved-table__refresh' + (refreshing ? ' is-refreshing' : '')}
            onClick={() => onReload?.()}
            title="Atualizar tickets"
            aria-label="Atualizar tickets"
            disabled={refreshing}
          >
            <i className="ti ti-refresh" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="desk-resolved-table__body">
        <table className="desk-resolved-table__grid">
          <thead>
            <tr>
              <th className="desk-resolved-table__th-num">Número</th>
              <th className="desk-resolved-table__th-title">
                <button
                  type="button"
                  className={'desk-resolved-table__sort' + (sortField === 'titulo' ? ' is-active' : '')}
                  onClick={handleSortTitulo}
                >
                  Título
                  <i
                    className={'ti ' + (sortField === 'titulo' && sortDir === 'asc' ? 'ti-chevron-up' : 'ti-chevron-down')}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="desk-resolved-table__th-resp">Responsável</th>
              <th className="desk-resolved-table__th-date">Finalização</th>
            </tr>
          </thead>
          <tbody>
            {pageEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="desk-resolved-table__empty">
                  {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket finalizado nesta fila'}
                </td>
              </tr>
            ) : pageEntries.map(({ ticket }) => {
              const protocol = getTicketProtocolLabel(ticket) || String(ticket.id || '');
              const title = getTicketTitle(ticket);
              const responsible = getTicketResponsible(ticket);
              const resolvedAt = formatResolvedDateShort(getTicketResolvedAt(ticket));
              return (
                <tr
                  key={ticket.id}
                  className="desk-resolved-table__row"
                  onClick={() => onSelectTicket?.(ticket.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectTicket?.(ticket.id)}
                  role="button"
                  tabIndex={0}
                >
                  <td className="desk-resolved-table__num">{protocol || '—'}</td>
                  <td className="desk-resolved-table__title-cell">
                    <div className="desk-resolved-table__title-inner">
                      <span className="desk-resolved-table__icon" aria-hidden="true">R</span>
                      <span className="desk-resolved-table__subject" title={title}>{title}</span>
                    </div>
                  </td>
                  <td className="desk-resolved-table__resp">{responsible}</td>
                  <td className="desk-resolved-table__date">{resolvedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
