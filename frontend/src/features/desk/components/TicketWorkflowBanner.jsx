/**
 * TicketWorkflowBanner v1.0.0 — banner SLA do passo ativo
 */
import React from 'react';
import { getWorkflowProgress } from '../../../services/desk/utils';

export default function TicketWorkflowBanner({ ticket }) {
  const progress = getWorkflowProgress(ticket);
  if (!progress?.composeLocked || !progress.awaitingTeamLabel) return null;

  const { awaitingTeamLabel, slaTotalHours, slaRemainingLabel } = progress;

  return (
    <div className="desk-workflow-banner" role="status" aria-live="polite">
      <i className="ti ti-clock desk-workflow-banner__icon" aria-hidden="true" />
      <span>
        Aguardando aprovação do {awaitingTeamLabel}
        {slaTotalHours ? ` — SLA: ${slaTotalHours}h` : ''}
        {slaRemainingLabel ? ` • restam ${slaRemainingLabel}` : ''}
        {` • Responsável: equipe ${awaitingTeamLabel}`}
      </span>
    </div>
  );
}
