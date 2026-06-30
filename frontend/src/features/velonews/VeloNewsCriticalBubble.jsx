/**
 * VeloNewsCriticalBubble v1.0.0 — balão persistente inferior esquerdo
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import { useVeloNews } from './VeloNewsProvider';

export default function VeloNewsCriticalBubble() {
  const { criticalBubbleVisible, pendingCriticalNews, openCriticalModal } = useVeloNews();

  if (!criticalBubbleVisible || !pendingCriticalNews) return null;

  return (
    <button
      type="button"
      className="velonews-critical-bubble"
      onClick={() => openCriticalModal(pendingCriticalNews)}
      aria-label="Abrir alerta crítico VeloNews"
    >
      <span className="velonews-critical-bubble__pulse" aria-hidden="true" />
      <i className="ti ti-alert-triangle velonews-critical-bubble__icon" aria-hidden="true" />
      <span className="velonews-critical-bubble__label">VeloNews</span>
      <span className="velonews-critical-bubble__hint">Alerta crítico — clique para ler</span>
    </button>
  );
}
