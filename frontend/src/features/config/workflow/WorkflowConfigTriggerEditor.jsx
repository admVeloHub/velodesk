import React, { useEffect, useState } from 'react';
import { TRIGGER_PATH_FIELDS } from './workflowConfigData';

export default function WorkflowConfigTriggerEditor({
  trigger,
  onSave,
  onCancel,
}) {
  const [pathValues, setPathValues] = useState(() => buildInitialValues(trigger));
  const [description, setDescription] = useState(trigger?.description || '');

  useEffect(() => {
    setPathValues(buildInitialValues(trigger));
    setDescription(trigger?.description || '');
  }, [trigger]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const path = TRIGGER_PATH_FIELDS.map((field) => String(pathValues[field.key] || '').trim());
    if (path.some((value) => !value)) return;

    onSave({
      type: trigger?.type || 'tabulation',
      path,
      description: description.trim(),
    });
  };

  return (
    <form className="wf-config-trigger-editor" onSubmit={handleSubmit}>
      <div className="wf-config-trigger-editor__head">
        <div>
          <h3 className="wf-config-trigger-editor__title">Editar gatilho de ativação</h3>
          <p className="wf-config-trigger-editor__subtitle">
            Defina o caminho exato de tabulação que ativa este workflow.
          </p>
        </div>
        <span className="wf-config-trigger__type">Tabulação</span>
      </div>

      <div className="wf-config-trigger-editor__path">
        {TRIGGER_PATH_FIELDS.map((field, index) => (
          <React.Fragment key={field.key}>
            {index > 0 ? (
              <span className="wf-config-trigger-editor__sep" aria-hidden="true">→</span>
            ) : null}
            <label className="wf-config-trigger-editor__field">
              <span>{field.label}</span>
              <input
                type="text"
                value={pathValues[field.key] || ''}
                placeholder={field.placeholder}
                onChange={(e) => setPathValues((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))}
              />
            </label>
          </React.Fragment>
        ))}
      </div>

      <label className="wf-config-trigger-editor__desc-label">
        Descrição do gatilho
        <textarea
          rows={3}
          value={description}
          placeholder="Explique quando este workflow deve ser ativado."
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="wf-config-trigger-editor__actions">
        <button type="button" className="wf-config-btn wf-config-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className="wf-config-btn wf-config-btn--primary"
          disabled={TRIGGER_PATH_FIELDS.some((field) => !String(pathValues[field.key] || '').trim())}
        >
          <i className="ti ti-check" aria-hidden="true" />
          Salvar gatilho
        </button>
      </div>
    </form>
  );
}

function buildInitialValues(trigger) {
  const path = trigger?.path || [];
  return TRIGGER_PATH_FIELDS.reduce((acc, field, index) => {
    acc[field.key] = path[index] || '';
    return acc;
  }, {});
}
