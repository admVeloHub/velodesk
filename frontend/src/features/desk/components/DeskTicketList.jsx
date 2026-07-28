/**
 * DeskTicketList v2.2.1 — busca por protocolo/CPF abaixo do título
 * VERSION: v2.2.1 | DATE: 2026-07-28
 */
import React, { useEffect, useState } from 'react';
import { DESK_SEARCH_MODE_CPF, DESK_SEARCH_MODE_TICKET } from '../../../services/desk/constants';
import {
  formatTicketListTime,
  getSlaClass,
  getTicketQueueEntryAt,
  getTicketTitle,
  isTicketInWorkflow,
  normalizeTicketForDeskV2,
} from '../../../services/desk/utils';

export default function DeskTicketList({
  activeTicketId,
  activeSort,
  entries,
  searchActive,
  searchQuery = '',
  searchMode,
  collapsed,
  entrySortOldestFirst,
  onSelectTicket,
  onSortChange,
  onToggleEntrySort,
  onSearchChange,
  onSearchModeToggle,
  onSearchSubmit,
  onCollapse,
  onExpand,
  onReload,
  refreshing = false,
  showSkeleton = false,
}) {
  const isTicketMode = searchMode === DESK_SEARCH_MODE_TICKET;
  const [query, setQuery] = useState(searchQuery);
  const skeletonItems = [1, 2, 3, 4, 5, 6];

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const handleQueryChange = (value) => {
    setQuery(value);
    onSearchChange?.(value);
  };

  return (
    <aside className={'ticket-list-panel' + (collapsed ? ' is-collapsed' : '')} id="crmTicketListPanel">
      <div className="ticket-list-panel__inner">
        <header className="ticket-list-header">
          <div className="ticket-list-header__row">
            <div className="ticket-list-header__title-wrap">
              <h2 className="ticket-list-header__title" id="ticketListTitle">
                Fila de atendimento
              </h2>
            </div>
            <div className="ticket-list-header__actions">
              <button
                type="button"
                className="crm-panel-retract"
                id="btnCollapseTickets"
                onClick={onCollapse}
                title="Recolher lista"
                aria-expanded={!collapsed}
              >
                <i className="ti ti-chevron-left" />
              </button>
              <button
                type="button"
                className={'crm-icon-btn' + (refreshing ? ' is-refreshing' : '')}
                id="refreshTicketsBtn"
                data-testid="btnRefresh"
                onClick={() => onReload?.()}
                title="Atualizar tickets"
                aria-label="Atualizar tickets"
                disabled={refreshing}
              >
                <i className="ti ti-refresh" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="queue-search queue-search--ticket-list"
            role="search"
          >
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="text"
              id="crmQueueSearch"
              name="crmQueueSearch"
              autoComplete="off"
              spellCheck={false}
              inputMode={isTicketMode ? 'text' : 'numeric'}
              placeholder={isTicketMode ? 'Buscar por protocolo…' : 'Buscar por CPF…'}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchSubmit?.();
                }
              }}
            />
            <button
              type="button"
              className="queue-search__mode"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onSearchModeToggle?.();
              }}
              title={isTicketMode ? 'Buscar por protocolo do ticket' : 'Buscar por CPF do cliente'}
              aria-pressed={isTicketMode}
            >
              {isTicketMode ? 'Ticket' : 'CPF'}
            </button>
          </div>

          <div className="ticket-list-tabs-bar">
            <div className="ticket-list-tabs" role="tablist" aria-label="Ordenar tickets">
              {['data', 'sla'].map((sort) => (
                <button
                  key={sort}
                  type="button"
                  role="tab"
                  aria-selected={activeSort === sort}
                  className={'ticket-list-tab' + (activeSort === sort ? ' is-active' : '')}
                  onClick={() => onSortChange(sort)}
                >
                  {sort === 'data' ? 'Data' : 'SLA'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={'ticket-list-entry-sort' + (entrySortOldestFirst ? ' is-active' : '')}
              onClick={onToggleEntrySort}
              title={entrySortOldestFirst ? 'Entrada: mais antigos primeiro' : 'Ordenar por entrada na caixa (mais antigos primeiro)'}
              aria-label="Ordenar por entrada na caixa"
              aria-pressed={entrySortOldestFirst}
            >
              <i className="ti ti-sort-ascending" aria-hidden="true" />
            </button>
          </div>

          {searchActive ? (
            <p className="ticket-list-header__search-hint">Busca · {entries.length} ticket(s)</p>
          ) : null}
        </header>

        <ul className="ticket-cards" id="ticketCards">
          {showSkeleton ? (
            skeletonItems.map((key) => (
              <li key={`sk-${key}`} className="crm-ticket-card crm-ticket-card--skeleton" aria-hidden="true">
                <div className="crm-ticket-card__content">
                  <div className="crm-ticket-card__row-top">
                    <span className="desk-skeleton desk-skeleton--text desk-skeleton--name" />
                    <span className="desk-skeleton desk-skeleton--text desk-skeleton--time" />
                  </div>
                  <div className="crm-ticket-card__row-bottom">
                    <span className="desk-skeleton desk-skeleton--text desk-skeleton--subject" />
                  </div>
                </div>
              </li>
            ))
          ) : entries.length === 0 ? (
            <li className="crm-empty-state" style={{ padding: 16 }}>
              {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket nesta fila'}
            </li>
          ) : entries.map(({ ticket: t }) => {
            normalizeTicketForDeskV2(t);
            const inWorkflow = isTicketInWorkflow(t);
            const isActive = String(t.id) === String(activeTicketId);
            const entryAt = getTicketQueueEntryAt(t);
            const slaCritical = getSlaClass(t) === 'critical';

            return (
              <li
                key={t.id}
                className={'crm-ticket-card' + (isActive ? ' is-active' : '')}
                data-ticket-id={t.id}
                aria-selected={isActive}
                onClick={() => onSelectTicket(t.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectTicket(t.id)}
              >
                {slaCritical ? (
                  <span
                    className="crm-ticket-card__dot crm-ticket-card__dot--sla-critical"
                    title="SLA crítico — fora do prazo"
                    aria-label="SLA crítico — fora do prazo"
                  />
                ) : null}
                <div className="crm-ticket-card__content">
                  <div className="crm-ticket-card__row-top">
                    <span className="crm-ticket-card__name">
                      {t.clientName || t.solicitante || 'Cliente'}
                    </span>
                    <time className="crm-ticket-card__time" dateTime={entryAt}>
                      {formatTicketListTime(entryAt)}
                    </time>
                  </div>
                  <div className="crm-ticket-card__row-bottom">
                    <span className="crm-ticket-card__subject" title={getTicketTitle(t)}>
                      {getTicketTitle(t)}
                    </span>
                    {inWorkflow ? (
                      <span className="crm-tag crm-tag--workflow">Workflow</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {collapsed && (
        <button
          type="button"
          className="crm-panel-expand-tab crm-panel-expand-tab--tickets"
          id="btnExpandTickets"
          onClick={onExpand}
          title="Expandir lista"
        >
          <i className="ti ti-chevron-right" /><span>LISTA</span>
        </button>
      )}
    </aside>
  );
}
