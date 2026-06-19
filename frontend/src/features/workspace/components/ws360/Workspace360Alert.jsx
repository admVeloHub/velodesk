import React from 'react';

export default function Workspace360Alert({ alert, onOpen }) {
  if (!alert) return null;

  return (
    <div className="ws360-alert" role="alert">
      <div className="ws360-alert__content">
        <i className="ti ti-alert-triangle" aria-hidden="true" />
        <span>
          <strong>1 ticket</strong> está prestes a vencer o SLA — {alert.clientName} · {alert.subject} · vence em {alert.expiresIn}
        </span>
      </div>
      <button type="button" className="ws360-alert__link" onClick={() => onOpen(alert.ticketId)}>
        Ver agora →
      </button>
    </div>
  );
}
