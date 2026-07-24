/**
 * DeskMyTicketsTable v1.2.0 — Meus Tickets: seção Novos retrátil; demais status em lista contínua
 * VERSION: v1.2.0 | DATE: 2026-07-22
 */
import React, { useMemo, useState } from 'react';
import {
  formatTicketSlaRemaining,
  getSlaClass,
  getTicketProtocolLabel,
  getTicketTitle,
  groupMyTicketsByStatus,
  normalizeTicketForDeskV2,
  sortTicketEntries,
} from '../../../services/desk/utils';
import { SLA_SHORT_LABELS } from '../../../services/desk/constants';

const MY_TICKETS_SECTIONS_WITHOUT_HEADER = new Set(['em-andamento', 'pendente', 'resolvidos']);

function renderTicketRows(sectionEntries, onSelectTicket) {
  return sectionEntries.map(({ ticket }) => {
    normalizeTicketForDeskV2(ticket);
    const protocol = getTicketProtocolLabel(ticket) || String(ticket.id || '');
    const title = getTicketTitle(ticket);
    const slaClass = getSlaClass(ticket);
    const slaLabel = formatTicketSlaRemaining(ticket);
    const slaStatus = SLA_SHORT_LABELS[slaClass] || 'No prazo';

    return (
      <tr
        key={ticket.id}
        className={'desk-my-tickets-table__row' + (slaClass === 'critical' ? ' is-sla-critical' : slaClass === 'warning' ? ' is-sla-warning' : '')}
        onClick={() => onSelectTicket?.(ticket.id)}
        onKeyDown={(e) => e.key === 'Enter' && onSelectTicket?.(ticket.id)}
        role="button"
        tabIndex={0}
      >
        <td className="desk-my-tickets-table__num">{protocol || '—'}</td>
        <td className="desk-my-tickets-table__title-cell">
          <span className="desk-my-tickets-table__subject" title={title}>{title}</span>
        </td>
        <td className="desk-my-tickets-table__sla">
          <span className={'desk-my-tickets-table__sla-badge desk-my-tickets-table__sla-badge--' + slaClass}>
            {slaStatus}
          </span>
          <span className="desk-my-tickets-table__sla-time">{slaLabel}</span>
        </td>
      </tr>
    );
  });
}

function TicketGrid({ id, children }) {
  return (
    <table className="desk-my-tickets-table__grid" id={id}>
      <thead>
        <tr>
          <th className="desk-my-tickets-table__th-num">Número</th>
          <th className="desk-my-tickets-table__th-title">Título</th>
          <th className="desk-my-tickets-table__th-sla">SLA</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export default function DeskMyTicketsTable({
  entries = [],
  searchActive = false,
  onSelectTicket,
  onReload,
  refreshing = false,
}) {
  const { headerSections, flatEntries } = useMemo(() => {
    const grouped = groupMyTicketsByStatus(entries);
    const withoutHeader = grouped.filter((section) => MY_TICKETS_SECTIONS_WITHOUT_HEADER.has(section.id));
    const withHeader = grouped.filter((section) => !MY_TICKETS_SECTIONS_WITHOUT_HEADER.has(section.id));
    const mergedFlat = sortTicketEntries(
      withoutHeader.flatMap((section) => section.entries),
      'sla',
      'asc',
    );

    return { headerSections: withHeader, flatEntries: mergedFlat };
  }, [entries]);

  const total = entries.length;
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <div className="desk-my-tickets-table" id="deskMyTicketsTable">
      <header className="desk-my-tickets-table__header">
        <div className="desk-my-tickets-table__heading">
          <h2 className="desk-my-tickets-table__title">Meus Tickets</h2>
          <span className="desk-my-tickets-table__subtitle">
            {total === 0 ? 'Nenhum ticket atribuído a você' : `${total} ticket${total === 1 ? '' : 's'} · ordenados por SLA`}
          </span>
        </div>
        <div className="desk-my-tickets-table__header-actions">
          <button
            type="button"
            className={'crm-icon-btn desk-my-tickets-table__refresh' + (refreshing ? ' is-refreshing' : '')}
            onClick={() => onReload?.()}
            title="Atualizar tickets"
            aria-label="Atualizar tickets"
            disabled={refreshing}
          >
            <i className="ti ti-refresh" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="desk-my-tickets-table__body">
        {headerSections.length === 0 && flatEntries.length === 0 ? (
          <p className="desk-my-tickets-table__empty">
            {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket atribuído a você nesta visão'}
          </p>
        ) : null}

        {headerSections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);

          return (
            <section
              key={section.id}
              className={'desk-my-tickets-table__section' + (isCollapsed ? ' is-collapsed' : '')}
            >
              <button
                type="button"
                className="desk-my-tickets-table__section-header"
                aria-expanded={!isCollapsed}
                aria-controls={`deskMyTicketsSection-${section.id}`}
                onClick={() => toggleSection(section.id)}
              >
                <i
                  className={'ti ti-chevron-down desk-my-tickets-table__section-chevron' + (isCollapsed ? ' is-collapsed' : '')}
                  aria-hidden="true"
                />
                <span
                  className="desk-my-tickets-table__section-dot"
                  style={{ background: section.dot }}
                  aria-hidden="true"
                />
                <span className="desk-my-tickets-table__section-title">{section.label}</span>
                <span className="desk-my-tickets-table__section-count">{section.entries.length}</span>
              </button>

              {!isCollapsed ? (
                <TicketGrid id={`deskMyTicketsSection-${section.id}`}>
                  {renderTicketRows(section.entries, onSelectTicket)}
                </TicketGrid>
              ) : null}
            </section>
          );
        })}

        {flatEntries.length > 0 ? (
          <section className="desk-my-tickets-table__section desk-my-tickets-table__section--flat">
            <TicketGrid id="deskMyTicketsSection-flat">
              {renderTicketRows(flatEntries, onSelectTicket)}
            </TicketGrid>
          </section>
        ) : null}
      </div>
    </div>
  );
}
