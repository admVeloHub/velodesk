/**
 * RaQueuePanel — filas Reclame Aqui (layout CRM)
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RA_GROUPS } from '../../../services/especiais/reclameAquiData';

const GROUP_DOTS = {
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  neutral: '#94a3b8',
};

export default function RaQueuePanel({
  activeGroup,
  searchQuery,
  collapsed,
  groupCounts,
  onSearchChange,
  onSearchSubmit,
  onSelectGroup,
  onCollapse,
  onExpand,
}) {
  const navigate = useNavigate();

  return (
    <aside
      className={`ra-crm-queue${collapsed ? ' is-collapsed' : ''}`}
      id="raCrmQueuePanel"
    >
      <div className="ra-crm-queue__inner">
        <div className="ra-crm-queue__header">
          <div className="ra-crm-queue__header-top">
            <h2 className="ra-crm-queue__title">Filas RA</h2>
            <button
              type="button"
              className="ra-crm-panel-retract"
              onClick={onCollapse}
              title="Recolher fila"
              aria-expanded={!collapsed}
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
          </div>
          <label className="ra-crm-queue-search">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar reclamações…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchSubmit?.();
                }
              }}
            />
          </label>
        </div>

        <ul className="ra-crm-queue-list">
          {RA_GROUPS.map((group) => (
            <li
              key={group.id}
              className={`ra-crm-queue-item${activeGroup === group.id ? ' is-active' : ''}`}
              onClick={() => onSelectGroup(group.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectGroup(group.id)}
            >
              <span
                className="ra-crm-queue-item__dot"
                style={{ background: GROUP_DOTS[group.tone] || GROUP_DOTS.neutral }}
              />
              <span className="ra-crm-queue-item__name">{group.label}</span>
              <span className="ra-crm-queue-item__count">{groupCounts[group.id] || 0}</span>
            </li>
          ))}
        </ul>

        <div className="ra-crm-queue__footer">
          <button
            type="button"
            className="ra-crm-queue-btn ra-crm-queue-btn--secondary"
            onClick={() => navigate('/especiais/reclame-aqui')}
          >
            <i className="ti ti-table" aria-hidden="true" />
            Gestão
          </button>
          <button
            type="button"
            className="ra-crm-queue-btn ra-crm-queue-btn--primary"
            onClick={() => navigate('/especiais/reclame-aqui/nova')}
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Nova reclamação
          </button>
        </div>
      </div>

      {collapsed ? (
        <button
          type="button"
          className="ra-crm-panel-expand ra-crm-panel-expand--queue"
          onClick={onExpand}
          title="Expandir fila"
        >
          <i className="ti ti-chevron-right" aria-hidden="true" />
          <span>FILA</span>
        </button>
      ) : null}
    </aside>
  );
}
