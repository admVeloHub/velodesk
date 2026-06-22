/**
 * TicketOperationProgress v1.0.0 — indicador de nível operacional (3 etapas)
 */
import React from 'react';
import { getTicketOperationProgress } from '../../../services/desk/utils';

function StepConnector({ completed }) {
  return (
    <span
      className={'ticket-op-progress__connector' + (completed ? ' is-completed' : '')}
      aria-hidden="true"
    />
  );
}

function ProgressStep({ step, state, subtitle }) {
  const label = subtitle ? `${step.title} · ${subtitle}` : step.title;

  return (
    <li
      className={'ticket-op-progress__step ticket-op-progress__step--' + state}
      title={label}
    >
      <span className="ticket-op-progress__circle">
        <i className={'ti ' + step.icon} aria-hidden="true" />
      </span>
    </li>
  );
}

export default function TicketOperationProgress({ ticket, queueId, escalonar }) {
  const { activeStep, workflowArea, resolved, steps } = getTicketOperationProgress(
    ticket,
    queueId,
    escalonar,
  );

  const stepState = (stepId) => {
    if (resolved || activeStep > stepId) return 'completed';
    if (activeStep === stepId) return 'active';
    return 'pending';
  };

  const ariaLabel = resolved
    ? 'Ticket finalizado — todos os níveis concluídos'
    : `Nível ${activeStep} de 3${
        activeStep === 2 && workflowArea ? ` — ${workflowArea}` : ''
      }`;

  return (
    <div
      className="ticket-op-progress"
      id="profileOperationStatus"
      role="group"
      aria-label={ariaLabel}
    >
      <span className="ticket-op-progress__label">Status</span>
      <ol className="ticket-op-progress__track">
        {steps.map((step, index) => {
          const state = stepState(step.id);
          const subtitle = step.id === 2 && workflowArea ? workflowArea : step.subtitle;

          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <StepConnector completed={activeStep > steps[index - 1].id || resolved} />
              )}
              <ProgressStep step={step} state={state} subtitle={subtitle} />
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
