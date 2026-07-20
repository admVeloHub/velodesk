/**
 * RaTicketList — lista de reclamações RA (layout CRM)
 */
import React from 'react';
import { RA_GROUPS, getStatusLabel, formatSlaRestante } from '../../../services/especiais/reclameAquiData';
import {
  formatRaListDate,
  getRaSlaClass,
  getRaSlaLabel,
} from './raTicketFormatters';

export default function RaTicketList({
  activeGroup,
  activeRaId,
  activeSort,
  items,
  searchActive,
  collapsed,
  onSelectItem,
  onSortChange,
  onCollapse,
  onExpand,
  onReload,
}) {
  const groupName = RA_GROUPS.find((g) => g.id === activeGroup)?.label || '';
  const listTitle = searchActive ? `Busca · ${items.length}` : `${groupName} · ${items.length}`;

  return (
    <aside
      className={`ra-crm-list${collapsed ? ' is-collapsed' : ''}`}
      id="raCrmTicketListPanel"
    >
      <div className="ra-crm-list__inner">
        <div className="ra-crm-list-header">
          <div className="ra-crm-list-header__row">
            <h2 className="ra-crm-list-header__title">{listTitle}</h2>
            <div className="ra-crm-list-header__actions">
              <button
                type="button"
                className="ra-crm-panel-retract ra-crm-panel-retract--list"
                onClick={onCollapse}
                title="Recolher lista"
                aria-expanded={!collapsed}
              >
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ra-crm-icon-btn"
                onClick={() => onReload?.()}
                title="Atualizar lista"
                aria-label="Atualizar lista"
              >
                <i className="ti ti-refresh" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="ra-crm-sort-chips">
            {['data', 'sla'].map((sort) => (
              <button
                key={sort}
                type="button"
                className={`ra-crm-sort-chip${activeSort === sort ? ' is-active' : ''}`}
                onClick={() => onSortChange(sort)}
              >
                {sort === 'data' ? 'Data' : 'SLA'}
              </button>
            ))}
          </div>
        </div>

        <ul className="ra-crm-ticket-cards">
          {items.length === 0 ? (
            <li className="ra-crm-empty-state">Nenhuma reclamação nesta fila</li>
          ) : (
            items.map((item) => {
              const isActive = String(item.id) === String(activeRaId);
              const slaClass = getRaSlaClass(item);
              const slaLabel = getRaSlaLabel(item);
              return (
                <li
                  key={item.id}
                  className={`ra-crm-ticket-card${isActive ? ' is-active' : ''}`}
                  onClick={() => onSelectItem(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectItem(item.id)}
                  aria-selected={isActive}
                >
                  <div className="ra-crm-ticket-card__top">
                    <span className="ra-crm-ticket-card__name">{item.consumidor || 'Consumidor'}</span>
                    <span className={`ra-badge ra-badge--${item.statusRa}`}>
                      {getStatusLabel(item.statusRa)}
                    </span>
                  </div>
                  <div className="ra-crm-ticket-card__subject">{item.assunto || '—'}</div>
                  <div className="ra-crm-ticket-card__meta">
                    <span>{formatRaListDate(item.dataReclamacao)}</span>
                    <span title={formatSlaRestante(item.prazoRa)}>
                      {formatSlaRestante(item.prazoRa)}
                    </span>
                  </div>
                  <span
                    className={`ra-crm-ticket-card__sla ra-crm-ticket-card__sla--${slaClass}`}
                    title={slaLabel}
                    aria-label={slaLabel}
                  >
                    {slaLabel}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {collapsed ? (
        <button
          type="button"
          className="ra-crm-panel-expand ra-crm-panel-expand--list"
          onClick={onExpand}
          title="Expandir lista"
        >
          <i className="ti ti-chevron-right" aria-hidden="true" />
          <span>LISTA</span>
        </button>
      ) : null}
    </aside>
  );
}
