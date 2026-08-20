/**
 * DeskMyTicketsTable v1.5.9 — ícone de workflow imediatamente após o título
 * VERSION: v1.5.9 | DATE: 2026-08-20
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  filterEntriesByDeskSearch,
  formatTicketSlaRemaining,
  getDeskSearchInferredLabel,
  getSlaClass,
  getTicketProtocolLabel,
  getTicketTitle,
  groupMyTicketsByStatus,
  normalizeTicketForDeskV2,
} from '../../../services/desk/utils';
import { getClient360WorkflowIconMeta } from '../../../services/workflow/workflowTeamQueues';
import { SLA_SHORT_LABELS } from '../../../services/desk/constants';

function renderTicketRows(sectionEntries, onSelectTicket) {
  return sectionEntries.map(({ ticket }) => {
    normalizeTicketForDeskV2(ticket);
    const protocol = getTicketProtocolLabel(ticket) || String(ticket.id || '');
    const title = getTicketTitle(ticket);
    const slaClass = getSlaClass(ticket);
    const slaLabel = formatTicketSlaRemaining(ticket);
    const slaStatus = SLA_SHORT_LABELS[slaClass] || 'No prazo';
    const workflowIcon = getClient360WorkflowIconMeta(ticket);

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
          <span className="desk-my-tickets-table__title-inner">
            <span className="desk-my-tickets-table__subject" title={title}>{title}</span>
            {workflowIcon ? (
              <span
                className={`client360-workflow-icon client360-workflow-icon--${workflowIcon.modifier}`}
                title={workflowIcon.title}
                aria-label={workflowIcon.title}
              >
                <i className={`ti ${workflowIcon.icon}`} aria-hidden="true" />
              </span>
            ) : null}
          </span>
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
  searchActive: externalSearchActive = false,
  expandedSectionId = null,
  onSelectTicket,
  onReload,
  refreshing = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const localSearchActive = Boolean(searchQuery.trim());
  const searchActive = localSearchActive || externalSearchActive;
  const detectedLabel = getDeskSearchInferredLabel(searchQuery);

  const filteredEntries = useMemo(
    () => filterEntriesByDeskSearch(entries, searchQuery),
    [entries, searchQuery],
  );

  const sections = useMemo(
    () => groupMyTicketsByStatus(filteredEntries),
    [filteredEntries],
  );

  const total = filteredEntries.length;
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const didScrollExpandedRef = useRef(false);

  useEffect(() => {
    if (!expandedSectionId) {
      didScrollExpandedRef.current = false;
      return;
    }
    setCollapsedSections((prev) => {
      if (!prev.has(expandedSectionId)) return prev;
      const next = new Set(prev);
      next.delete(expandedSectionId);
      return next;
    });
  }, [expandedSectionId]);

  useEffect(() => {
    if (!expandedSectionId || didScrollExpandedRef.current) return;
    const section = sections.find((item) => item.id === expandedSectionId);
    if (!section?.entries?.length) return;
    didScrollExpandedRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById(`deskMyTicketsSection-${expandedSectionId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [expandedSectionId, sections]);

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
          <div className="desk-my-tickets-table__title-row">
            <h2 className="desk-my-tickets-table__title">Meus Tickets</h2>
            <div
              className="queue-search queue-search--my-tickets-table"
              role="search"
            >
              <i className="ti ti-search" aria-hidden="true" />
              <input
                type="text"
                id="deskMyTicketsSearch"
                name="deskMyTicketsSearch"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                placeholder="Buscar por CPF ou protocolo…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar ticket por CPF ou protocolo"
              />
              <span
                className="queue-search__mode queue-search__mode--detected"
                title={`Busca detectada: ${detectedLabel}`}
                aria-live="polite"
              >
                {detectedLabel}
              </span>
            </div>
          </div>
          <span className="desk-my-tickets-table__subtitle">
            {total === 0
              ? (searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket atribuído a você')
              : `${total} ticket${total === 1 ? '' : 's'} · ordenados por SLA`}
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
        {sections.length === 0 ? (
          <p className="desk-my-tickets-table__empty">
            {searchActive ? 'Nenhum ticket encontrado na busca' : 'Nenhum ticket atribuído a você nesta visão'}
          </p>
        ) : null}

        {sections.map((section) => {
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

      </div>
    </div>
  );
}
