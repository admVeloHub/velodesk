/**
 * TicketWorkflowInfoRequestCallout — pedido de informação do workflow visível ao agente responsável
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getWorkflowInfoRequestsForTicket } from '../../../services/workflow/workflowInfoNotifications';

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketWorkflowInfoRequestCallout({ ticket }) {
  const [infoRevision, setInfoRevision] = useState(0);

  useEffect(() => {
    const onInfoChanged = () => setInfoRevision((value) => value + 1);
    window.addEventListener('velodesk:workflow-info-changed', onInfoChanged);
    return () => window.removeEventListener('velodesk:workflow-info-changed', onInfoChanged);
  }, []);

  const requests = useMemo(
    () => getWorkflowInfoRequestsForTicket(ticket),
    [ticket, infoRevision],
  );

  const wf = ticket?.lateralForm?.workflow;
  const fallback = wf?.infoRequestNote && wf?.infoRequestedAt
    ? [{
      id: `wf-local-${wf.infoRequestedAt}`,
      message: wf.infoRequestNote,
      requestedBy: wf.infoRequestedBy || 'Workflow',
      stepLabel: 'Aprovação',
      createdAt: wf.infoRequestedAt,
    }]
    : [];

  const items = requests.length ? requests : fallback;
  if (!items.length) return null;

  return (
    <div className="desk-workflow-info-callout" role="status" aria-live="polite">
      {items.map((req) => (
        <article key={req.id} className="desk-workflow-info-callout__item">
          <header className="desk-workflow-info-callout__head">
            <i className="ti ti-message-question desk-workflow-info-callout__icon" aria-hidden="true" />
            <strong>Pedido de informação — {req.stepLabel || 'Workflow'}</strong>
            <span className="desk-workflow-info-callout__meta">
              {formatWhen(req.createdAt)} · por {req.requestedBy || 'Workflow'}
            </span>
          </header>
          <p className="desk-workflow-info-callout__text">{req.message}</p>
        </article>
      ))}
    </div>
  );
}
