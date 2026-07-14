import React from 'react';

function WorkflowConfigStepItem({ step, isLast }) {
  return (
    <li className={'wf-config-step' + (isLast ? ' wf-config-step--last' : '')}>
      <div className={'wf-config-step__icon wf-config-step__icon--' + (step.iconTone || 'start')}>
        <i className={'ti ' + step.icon} aria-hidden="true" />
      </div>
      <div className="wf-config-step__body">
        <h4 className="wf-config-step__title">{step.title}</h4>
        <p className="wf-config-step__desc">{step.description}</p>
        {step.badges?.length ? (
          <div className="wf-config-step__badges">
            {step.badges.map((badge) => (
              <span
                key={badge.label}
                className={'wf-config-step__badge wf-config-step__badge--' + (badge.tone || 'neutral')}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function WorkflowConfigStepsTimeline({ steps, onAddStep }) {
  return (
    <section className="wf-config-steps">
      <h3 className="wf-config-steps__title">Etapas do workflow</h3>
      <ol className="wf-config-steps__timeline">
        {(steps || []).map((step, index) => (
          <WorkflowConfigStepItem
            key={step.id}
            step={step}
            isLast={index === (steps.length - 1)}
          />
        ))}
      </ol>
      <button type="button" className="wf-config-steps__add" onClick={onAddStep}>
        <i className="ti ti-plus" aria-hidden="true" />
        Adicionar etapa ao workflow
      </button>
    </section>
  );
}
