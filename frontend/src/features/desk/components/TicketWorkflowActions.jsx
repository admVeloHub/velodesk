/**
 * TicketWorkflowActions v1.0.1 — status da etapa ativa do workflow (somente leitura no perfil Agente)
 */
import React from 'react';
import { getWorkflowProgress } from '../../../services/desk/utils';

export default function TicketWorkflowActions({ ticket }) {
  const progress = getWorkflowProgress(ticket);
  if (!progress || progress.workflow?.status === 'completed') return null;

  const { activeStep, awaitingTeamLabel } = progress;
  const stepLabel = activeStep?.label || 'etapa atual';

  return (
    <div className="desk-workflow-actions">
      {awaitingTeamLabel ? (
        <span className="desk-workflow-actions__hint">
          Aguardando {awaitingTeamLabel}
        </span>
      ) : null}
      <span className="desk-workflow-actions__step">{stepLabel}</span>
    </div>
  );
}
