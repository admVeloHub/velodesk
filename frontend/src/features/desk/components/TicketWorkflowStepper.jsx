/**
 * TicketWorkflowStepper v1.3.0 — layout headerStack (altura dos botões)
 */
import React, { useMemo } from 'react';
import { getWorkflowProgress, isTicketInWorkflow } from '../../../services/desk/utils';
import { getWorkflowStepSubtitle } from '../../../services/desk/workflowDefinitions';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';

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

function buildStepperClassName({ layout, clickable, loading = false }) {
  let cls = 'desk-workflow-stepper';
  cls += layout === 'headerStack'
    ? ' desk-workflow-stepper--header-stack'
    : ' desk-workflow-stepper--compact';
  if (clickable) cls += ' desk-workflow-stepper--clickable';
  if (loading) cls += ' desk-workflow-stepper--loading';
  return cls;
}

export default function TicketWorkflowStepper({ ticket, onClick, clickable = false, layout = 'compact' }) {
  const { workflows, loading: workflowsLoading } = useWorkflowConfig();
  const progress = useMemo(
    () => getWorkflowProgress(ticket),
    [ticket, workflows],
  );

  if (!isTicketInWorkflow(ticket)) return null;

  const interactiveProps = clickable ? {
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    },
    role: 'button',
    tabIndex: 0,
    title: 'Ver evolução do workflow',
  } : {};

  if (!progress) {
    const wf = ticket?.lateralForm?.workflow;
    const label = wf?.title || wf?.definicaoSlug || wf?.templateId || 'Workflow';
    if (workflowsLoading) {
      return (
        <section
          className={buildStepperClassName({ layout, clickable, loading: true })}
          aria-busy="true"
          aria-label={`Carregando workflow: ${label}`}
          {...interactiveProps}
        >
          <p className="desk-workflow-stepper__eyebrow">
            <i className="ti ti-arrows-exchange" aria-hidden="true" />
            {label}
          </p>
          <ol className="desk-workflow-stepper__track">
            <li className="desk-workflow-stepper__step desk-workflow-stepper__step--active">
              <span className="desk-workflow-stepper__circle">
                <i className="ti ti-loader" aria-hidden="true" />
              </span>
            </li>
          </ol>
        </section>
      );
    }

    const step = typeof wf?.step === 'number' ? wf.step + 1 : 1;
    return (
      <section
        className={buildStepperClassName({ layout, clickable })}
        aria-label={`Workflow ativo: ${label}`}
        {...interactiveProps}
      >
        <p className="desk-workflow-stepper__eyebrow">
          <i className="ti ti-arrows-exchange" aria-hidden="true" />
          {label}
        </p>
        <ol className="desk-workflow-stepper__track">
          <li
            className="desk-workflow-stepper__step desk-workflow-stepper__step--active"
            title={`Etapa ${step}`}
          >
            <span className="desk-workflow-stepper__circle">
              <i className="ti ti-circle-dot" aria-hidden="true" />
            </span>
          </li>
        </ol>
      </section>
    );
  }

  const { template, stepsWithState } = progress;

  return (
    <section
      className={buildStepperClassName({ layout, clickable })}
      aria-label={`Workflow ativo: ${template.title}`}
      {...interactiveProps}
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
