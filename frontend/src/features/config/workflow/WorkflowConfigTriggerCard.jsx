import React from 'react';

export default function WorkflowConfigTriggerCard({ trigger, onEdit }) {
  if (!trigger) return null;

  const pathLabel = (trigger.path || []).join(' → ');

  return (
    <>
      <div className="wf-config-trigger__banner">
        <span className="wf-config-trigger__type">Tabulação</span>
        <span className="wf-config-trigger__path">{pathLabel}</span>
        <button type="button" className="wf-config-trigger__edit" onClick={onEdit}>
          editar
        </button>
      </div>
      {trigger.description ? (
        <p className="wf-config-trigger__desc">{trigger.description}</p>
      ) : null}
    </>
  );
}
