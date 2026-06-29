/**
 * DeskTicketList v1.0.1 — lista de tickets da fila
 * VERSION: v1.0.1 | DATE: 2026-06-24
 */
import React from 'react';
import { SLA_LABELS } from '../../../services/desk/constants';
import {
  buildTags,
  formatTicketDate,
  getSlaClass,
  getTicketTitle,
  normalizeTicketForDeskV2,
  statusMeta,
} from '../../../services/desk/utils';

export default function DeskTicketList({
  queueStatuses,
  activeQueue,
  activeTicketId,
  activeSort,
  entries,
  searchActive,
  collapsed,
  onSelectTicket,
  onSortChange,
  onCollapse,
  onExpand,
  onReload,
  refreshing = false,
}) {
  const queueName = queueStatuses.find((s) => s.id === activeQueue)?.name || '';
  const listTitle = searchActive ? `Busca · ${entries.length}` : `${queueName} · ${entries.length}`;

  return (
    <aside className={'ticket-list-panel' + (collapsed ? ' is-collapsed' : '')} id="crmTicketListPanel">
      <div className="ticket-list-panel__inner">
        <div className="ticket-list-header">
          <div className="ticket-list-header__row">
            <h2 className="ticket-list-header__title" id="ticketListTitle">
              {listTitle}
            </h2>
            <div className="ticket-list-header__actions">
              <button type="button" className="crm-panel-retract" id="btnCollapseTickets" onClick={onCollapse} title="Recolher lista" aria-expanded={!collapsed}>
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
          <div className="sort-chips">
            {['data', 'sla'].map((sort) => (
              <button
                key={sort}
                type="button"
                className={'sort-chip' + (activeSort === sort ? ' is-active' : '')}
                data-sort={sort}
                onClick={() => onSortChange(sort)}
              >
                {sort === 'data' ? 'Data' : 'SLA'}
              </button>
            ))}
          </div>
        </div>
        <ul className="ticket-cards" id="ticketCards">
          {entries.length === 0 ? (
            <li className="crm-empty-state" style={{ padding: 16, fontSize: 14 }}>
              {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket nesta fila'}
            </li>
          ) : entries.map(({ ticket: t, queueId }) => {
            normalizeTicketForDeskV2(t);
            const meta = statusMeta(queueId);
            const sla = getSlaClass(t);
            const tags = buildTags(t);
            const isActive = String(t.id) === String(activeTicketId);
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
                <div className="crm-ticket-card__top">
                  <span className="crm-ticket-card__name">{t.clientName || t.solicitante || 'Cliente'}</span>
                  <span className={'status-badge status-badge--' + meta.cls}>{meta.label}</span>
                </div>
                <div className="crm-ticket-card__subject">{getTicketTitle(t)}</div>
                <div className="crm-ticket-card__meta">
                  <span>{formatTicketDate(t.updatedAt || t.createdAt)}</span>
                </div>
                {tags.length > 0 && (
                  <div className="crm-ticket-card__tags">
                    {tags.map((tag) => (
                      <span key={tag} className="crm-tag">{tag}</span>
                    ))}
                  </div>
                )}
                <span className={'crm-ticket-card__sla crm-ticket-card__sla--' + sla} title={SLA_LABELS[sla]} aria-label={SLA_LABELS[sla]} />
              </li>
            );
          })}
        </ul>
      </div>
      {collapsed && (
        <button type="button" className="crm-panel-expand-tab crm-panel-expand-tab--tickets" id="btnExpandTickets" onClick={onExpand} title="Expandir lista">
          <i className="ti ti-chevron-right" /><span>LISTA</span>
        </button>
      )}
    </aside>
  );
}
