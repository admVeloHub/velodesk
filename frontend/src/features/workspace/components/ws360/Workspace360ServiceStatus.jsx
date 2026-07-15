/**
 * Workspace360ServiceStatus v1.2.0 — produtos ativos/fora do ar (formato KPI)
 * VERSION: v1.2.0 | DATE: 2026-07-15
 */
import React, { useMemo } from 'react';
import { useServiceStatusProducts } from '../../../../hooks/useServiceStatusProducts';

export default function Workspace360ServiceStatus({ className = '', tagsOnly = false }) {
  const { items, loading } = useServiceStatusProducts();

  const stats = useMemo(() => {
    const active = items.filter((item) => item.ativo).length;
    const offline = items.length - active;
    return { active, offline };
  }, [items]);

  if (loading && !items.length) return null;

  const tagGrid = (
    <div className="ws360-service-status__grid" role="list">
      {items.map((item) => (
        <span
          key={item.id}
          role="listitem"
          className={`ws360-service-status__tag${item.ativo ? ' ws360-service-status__tag--active' : ' ws360-service-status__tag--offline'}`}
          title={item.ativo ? `${item.label} — ativo` : `${item.label} — fora do ar`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );

  if (tagsOnly) {
    return (
      <article
        className={`ws360-kpi ws360-service-status ws360-service-status--tags-only${className ? ` ${className}` : ''}`}
        aria-label="Status dos serviços da empresa"
      >
        {tagGrid}
      </article>
    );
  }

  const hintTone = stats.offline > 0 ? 'warn' : 'success';
  const hintLabel = stats.offline > 0
    ? `${stats.offline} fora do ar`
    : `${stats.active} ativos`;

  return (
    <article
      className={`ws360-kpi ws360-kpi--${hintTone} ws360-service-status${className ? ` ${className}` : ''}`}
      aria-label="Status dos serviços da empresa"
    >
      <div className="ws360-kpi__top">
        <i className="ti ti-brand-speedtest" aria-hidden="true" />
        <span className={`ws360-kpi__hint ws360-kpi__hint--${hintTone}`}>{hintLabel}</span>
      </div>
      {tagGrid}
      <span className="ws360-kpi__label">Status dos serviços</span>
    </article>
  );
}
