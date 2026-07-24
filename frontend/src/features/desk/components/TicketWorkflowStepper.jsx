/**
 * TicketWorkflowStepper v1.1.0 — stepper horizontal do workflow ativo (mockup)
 */
import React from 'react';
import { getWorkflowProgress } from '../../../services/desk/utils';
import { getWorkflowStepSubtitle } from '../../../services/desk/workflowDefinitions';

function StepIcon({ step }) {
  if (step.state === 'completed') {
    return <i className="ti ti-check" aria-hidden="true" />;
  }
  return <i className={'ti ' + step.icon} aria-hidden="true" />;
}

function connectorClass(prevStep, nextStep) {
  let cls = 'desk-workflow-stepper__connector';
  if (prevStep?.state === 'completed') cls += ' is-completed';
  else if (nextStep?.state === 'signaled') cls += ' is-signaled';
  return cls;
}

export default function TicketWorkflowStepper({ ticket }) {
  const progress = getWorkflowProgress(ticket);
  if (!progress) return null;

  const { template, stepsWithState } = progress;

  return (
    <section
      className="desk-workflow-stepper desk-workflow-stepper--compact"
      aria-label={`Workflow ativo: ${template.title}`}
    >
      <p className="desk-workflow-stepper__eyebrow" title={`Workflow ativo: ${template.title}`}>
        <i className="ti ti-arrows-exchange" aria-hidden="true" />
        {template.title}
      </p>
      <ol className="desk-workflow-stepper__track">
        {stepsWithState.map((step, index) => {
          const subtitle = getWorkflowStepSubtitle(step, progress);
          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <li
                  className={connectorClass(stepsWithState[index - 1], step)}
                  aria-hidden="true"
                />
              )}
              <li
                className={'desk-workflow-stepper__step desk-workflow-stepper__step--' + step.state}
                title={subtitle ? `${step.label} — ${subtitle}` : step.label}
              >
                <span className="desk-workflow-stepper__circle">
                  <StepIcon step={step} />
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </section>
  );
}
