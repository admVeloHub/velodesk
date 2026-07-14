/**
 * TicketWorkflowTimeline v1.0.0 — linha do tempo vertical do workflow
 */
import React from 'react';
import { getWorkflowProgress } from '../../../services/desk/utils';

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function statusLabel(step, slaRemainingLabel, slaTotalHours) {
  if (step.state === 'completed') {
    const time = formatTime(step.completedAt);
    return time ? `Concluído em ${time}` : 'Concluído';
  }
  if (step.state === 'active') {
    if (slaRemainingLabel && slaTotalHours) {
      return `SLA ${slaTotalHours}h • restam ${slaRemainingLabel}`;
    }
    return 'Em análise';
  }
  if (step.slaHours) return `SLA ${step.slaHours}h`;
  return 'Pendente';
}

export default function TicketWorkflowTimeline({ ticket }) {
  const progress = getWorkflowProgress(ticket);
  if (!progress) return null;

  const { stepsWithState, slaRemainingLabel, slaTotalHours } = progress;

  return (
    <section className="desk-workflow-timeline rp-section">
      <div className="desk-workflow-timeline__title">WORKFLOW — LINHA DO TEMPO</div>
      <ol className="desk-workflow-timeline__list">
        {stepsWithState.map((step) => (
          <li
            key={step.id}
            className={'desk-workflow-timeline__item desk-workflow-timeline__item--' + step.state}
          >
            <span className="desk-workflow-timeline__marker" aria-hidden="true">
              {step.state === 'completed' ? (
                <i className="ti ti-check" />
              ) : (
                <i className={'ti ' + step.icon} />
              )}
            </span>
            <div className="desk-workflow-timeline__content">
              <div className="desk-workflow-timeline__row">
                <strong>{step.label}</strong>
                {step.state === 'active' ? (
                  <span className="desk-workflow-timeline__badge">Em análise</span>
                ) : null}
              </div>
              <span className="desk-workflow-timeline__meta">
                {statusLabel(step, slaRemainingLabel, slaTotalHours)}
              </span>
              {step.team && step.team !== 'n1' ? (
                <span className="desk-workflow-timeline__team">
                  Responsável: equipe {step.teamLabel}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
