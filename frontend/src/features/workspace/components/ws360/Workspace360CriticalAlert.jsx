/**
 * Workspace360CriticalAlert v1.0.0 — alertas críticos do Agente de Gestão
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import React, { useCallback, useEffect, useState } from 'react';
import { agentsApi } from '../../../../api/client';

function severityClass(severidade) {
  const s = String(severidade || '').toLowerCase();
  if (s === 'critica') return 'ws360-critical-alert--critica';
  if (s === 'alta') return 'ws360-critical-alert--alta';
  return 'ws360-critical-alert--media';
}

export default function Workspace360CriticalAlert({ onOpenTicket }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await agentsApi.gestaoAlerts({ unread: 'true', limit: 5 });
      const items = (data?.alerts || []).filter((a) => (
        a.tipo === 'handoff_critico' || a.severidade === 'critica' || a.severidade === 'alta'
      ));
      setAlerts(items);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 120_000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  if (loading || alerts.length === 0) return null;

  return (
    <section className="ws360-critical-alert-wrap">
      {alerts.map((alert) => (
        <article
          key={alert._id}
          className={`ws360-critical-alert ${severityClass(alert.severidade)}`}
        >
          <div className="ws360-critical-alert__header">
            <span className="ws360-critical-alert__badge">{String(alert.severidade || 'alerta').toUpperCase()}</span>
            {alert.protocolo && (
              <span className="ws360-critical-alert__protocol">Protocolo {alert.protocolo}</span>
            )}
          </div>
          <p className="ws360-critical-alert__text">{alert.resumo}</p>
          {alert.protocolo && onOpenTicket && (
            <button
              type="button"
              className="ws360-critical-alert__cta"
              onClick={() => onOpenTicket(alert.ticketId || alert.protocolo)}
            >
              Abrir chamado
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
