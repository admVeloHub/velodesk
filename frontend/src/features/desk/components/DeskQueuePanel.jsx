/**
 * DeskQueuePanel v1.1.0 — fila de atendimento
 */
import React, { useState } from 'react';
import { countByQueue } from '../../../services/desk/utils';
import CreateQueueBoxModal from './CreateQueueBoxModal';

export default function DeskQueuePanel({
  queueStatuses,
  activeQueue,
  searchQuery,
  collapsed,
  onSearchChange,
  onSearchSubmit,
  onSelectQueue,
  onCollapse,
  onExpand,
  onCreateTicket,
  onQueueBoxCreated,
}) {
  const [boxModalOpen, setBoxModalOpen] = useState(false);

  return (
    <>
      <aside
        className={'queue-panel' + (collapsed ? ' is-collapsed' : '')}
        id="crmQueuePanel"
      >
        <div className="queue-panel__inner">
          <div className="queue-panel__header">
            <div className="queue-panel__header-top">
              <h2 className="queue-panel__title">Fila de atendimento</h2>
              <button
                type="button"
                className="crm-panel-retract"
                id="btnCollapseQueue"
                onClick={onCollapse}
                title="Recolher fila"
                aria-expanded={!collapsed}
              >
                <i className="ti ti-chevron-left" />
              </button>
            </div>
            <label className="queue-search">
              <i className="ti ti-search" />
              <input
                type="search"
                id="crmQueueSearch"
                placeholder="Buscar tickets…"
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
          <ul className="queue-status-list" id="queueStatusList">
            {queueStatuses.map((s) => (
              <li
                key={s.id}
                className={'queue-status-item' + (activeQueue === s.id ? ' is-active' : '')}
                data-queue={s.id}
                onClick={() => onSelectQueue(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectQueue(s.id)}
              >
                <span className="queue-status-item__dot" style={{ background: s.dot }} />
                <span className="queue-status-item__name">{s.name}</span>
                <span className="queue-status-item__count">{countByQueue(s.id)}</span>
              </li>
            ))}
          </ul>
          <div className="queue-panel__footer">
            <button
              type="button"
              className="queue-btn queue-btn--secondary"
              id="crmNewBox"
              onClick={() => setBoxModalOpen(true)}
            >
              <i className="ti ti-plus" /> Nova caixa
            </button>
            <button type="button" className="queue-btn queue-btn--primary" id="crmNewTicket" onClick={onCreateTicket}>
              <i className="ti ti-plus" /> Criar ticket
            </button>
          </div>
        </div>
        {collapsed && (
          <button type="button" className="crm-panel-expand-tab crm-panel-expand-tab--queue" id="btnExpandQueue" onClick={onExpand} title="Expandir fila">
            <i className="ti ti-chevron-right" /><span>FILA</span>
          </button>
        )}
      </aside>

      <CreateQueueBoxModal
        open={boxModalOpen}
        onClose={() => setBoxModalOpen(false)}
        onCreated={(box) => {
          onQueueBoxCreated?.(box);
          setBoxModalOpen(false);
        }}
      />
    </>
  );
}
