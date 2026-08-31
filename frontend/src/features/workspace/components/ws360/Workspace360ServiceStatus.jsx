/**
 * Workspace360ServiceStatus v2.0.0 — badges dinâmicos via VelohubCentral/console_config/
 * module_status (mesmo mecanismo do mostrador de serviços do VeloHub); nada hardcoded.
 * VERSION: v2.0.0 | DATE: 2026-08-31
 */
import React from 'react';
import { useModuleStatus } from '../../../../hooks/useModuleStatus';

const STATUS_TONE = {
  on: 'active',
  revisao: 'warning',
  off: 'offline',
};

function statusTitle(item) {
  if (item.status === 'on') return `${item.label} — ativo`;
  if (item.status === 'revisao') return `${item.label} — em revisão`;
  if (item.status === 'off') return `${item.label} — indisponível`;
  return `${item.label} — status desconhecido`;
}

export default function Workspace360ServiceStatus({ className = '', tagsOnly = false }) {
  const { items, loading } = useModuleStatus();

  if (loading && !items.length) return null;
  if (!items.length) return null;

  const activeCount = items.filter((item) => item.status === 'on').length;

  const tagGrid = (
    <div className="ws360-service-status__grid" role="list">
      {items.map((item) => (
        <span
          key={item.key}
          role="listitem"
          className={`ws360-service-status__tag ws360-service-status__tag--${STATUS_TONE[item.status] || 'unknown'}`}
          title={statusTitle(item)}
        >
          {item.label}
        </span>
      ))}
    </div>
  );

  if (tagsOnly) {
    return (
      <div
        className={`ws360-service-status ws360-service-status--tags-only${className ? ` ${className}` : ''}`}
        role="group"
        aria-label="Status dos serviços"
      >
        {tagGrid}
      </div>
    );
  }

  const hintLabel = `${activeCount} ativo${activeCount === 1 ? '' : 's'}`;

  return (
    <article
      className={`ws360-kpi ws360-kpi--success ws360-service-status${className ? ` ${className}` : ''}`}
      aria-label="Status dos serviços"
    >
      <div className="ws360-kpi__top">
        <i className="ti ti-brand-speedtest" aria-hidden="true" />
        <span className="ws360-kpi__hint ws360-kpi__hint--success">{hintLabel}</span>
      </div>
      {tagGrid}
      <span className="ws360-kpi__label">Status dos serviços</span>
    </article>
  );
}
