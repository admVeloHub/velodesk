/**
 * DeskTicketList v2.0.0 — lista branca no padrão mockup
 */
import React, { useMemo } from 'react';
import {
  formatTicketListTime,
  getTicketQueueEntryAt,
  getTicketTitle,
  isTicketInWorkflow,
  normalizeTicketForDeskV2,
} from '../../../services/desk/utils';

export default function DeskTicketList({
  queueStatuses,
  activeTicketId,
  activeSort,
  entries,
  searchActive,
  collapsed,
  entrySortOldestFirst,
  onSelectTicket,
  onSortChange,
  onToggleEntrySort,
  onCollapse,
  onExpand,
  onReload,
  refreshing = false,
}) {
  const queueDotById = useMemo(() => {
    const map = new Map();
    queueStatuses.forEach((queue) => map.set(queue.id, queue.dot));
    return map;
  }, [queueStatuses]);

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
          {entries.length === 0 ? (
            <li className="crm-empty-state" style={{ padding: 16 }}>
              {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket nesta fila'}
            </li>
          ) : entries.map(({ ticket: t, queueId }) => {
            normalizeTicketForDeskV2(t);
            const inWorkflow = isTicketInWorkflow(t);
            const isActive = String(t.id) === String(activeTicketId);
            const queueDot = queueDotById.get(queueId) || '#9ca3af';
            const entryAt = getTicketQueueEntryAt(t);

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
                <span
                  className="crm-ticket-card__dot"
                  style={{ background: queueDot }}
                  aria-hidden="true"
                />
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
