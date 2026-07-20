/**
 * Workspace360ServiceStatus v1.4.0 — tags compactas sem card KPI (tagsOnly)
 * VERSION: v1.4.0 | DATE: 2026-07-17
 */
import React, { useMemo } from 'react';
import { useServiceStatusProducts } from '../../../../hooks/useServiceStatusProducts';

export default function Workspace360ServiceStatus({ className = '', tagsOnly = false }) {
  const { items, loading } = useServiceStatusProducts();

  const activeItems = useMemo(
    () => items.filter((item) => item.ativo),
    [items],
  );

  const stats = useMemo(() => ({ active: activeItems.length }), [activeItems]);

  if (loading && !activeItems.length) return null;
  if (!activeItems.length) return null;

  const tagGrid = (
    <div className="ws360-service-status__grid" role="list">
      {activeItems.map((item) => (
        <span
          key={item.id}
          role="listitem"
          className="ws360-service-status__tag ws360-service-status__tag--active"
          title={`${item.label} — ativo`}
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
        aria-label="Produtos disponíveis"
      >
        {tagGrid}
      </div>
    );
  }

  const hintTone = 'success';
  const hintLabel = `${stats.active} ativo${stats.active === 1 ? '' : 's'}`;

  return (
    <article
      className={`ws360-kpi ws360-kpi--${hintTone} ws360-service-status${className ? ` ${className}` : ''}`}
      aria-label="Produtos disponíveis"
    >
      <div className="ws360-kpi__top">
        <i className="ti ti-brand-speedtest" aria-hidden="true" />
        <span className={`ws360-kpi__hint ws360-kpi__hint--${hintTone}`}>{hintLabel}</span>
      </div>
      {tagGrid}
      <span className="ws360-kpi__label">Produtos disponíveis</span>
    </article>
  );
}
