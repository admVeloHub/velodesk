/**
 * WorkflowRequisicaoForm v1.1.0 — inputs vazios por padrão (sem placeholder)
 * VERSION: v1.1.0 | DATE: 2026-07-23
 */
import React, { useMemo, useState } from 'react';
import {
  resolveRequisicaoCamposVisiveis,
  validateRequisicaoFormValues,
} from '../../../services/workflow/workflowRequisicao';

function RequisicaoFieldInput({ campo, value, onChange, error }) {
  const id = `wf-req-${campo.id}`;

  if (campo.tipo === 'textarea') {
    return (
      <textarea
        id={id}
        className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (campo.tipo === 'select') {
    return (
      <select
        id={id}
        className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione…</option>
        {(campo.opcoes || []).map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>{opcao.label || opcao.valor}</option>
        ))}
      </select>
    );
  }

  if (campo.tipo === 'boolean') {
    return (
      <label className="wf-requisicao-form__boolean">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>Sim</span>
      </label>
    );
  }

  const inputType = campo.tipo === 'number' || campo.tipo === 'currency'
    ? 'number'
    : campo.tipo === 'date'
      ? 'date'
      : 'text';

  return (
    <input
      id={id}
      type={inputType}
      className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
      value={value ?? ''}
      step={campo.tipo === 'currency' ? '0.01' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function WorkflowRequisicaoForm({
  workflowDef,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const campos = useMemo(
    () => resolveRequisicaoCamposVisiveis(workflowDef?.raw || workflowDef),
    [workflowDef],
  );
  const [valores, setValores] = useState(() => {
    const initial = {};
    campos.forEach((campo) => {
      initial[campo.id] = campo.tipo === 'boolean' ? false : '';
    });
    return initial;
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateRequisicaoFormValues(campos, valores);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit?.(valores);
  };

  if (!campos.length) return null;

  return (
    <form className="wf-requisicao-form" onSubmit={handleSubmit}>
      <header className="wf-requisicao-form__head">
        <p className="wf-requisicao-form__eyebrow">Iniciar workflow</p>
        <h2 className="wf-requisicao-form__title">{workflowDef?.title || 'Requisição'}</h2>
        <p className="wf-requisicao-form__hint">
          Preencha apenas os dados complementares. CPF, produto, motivo e detalhe já estão na tabulação.
        </p>
      </header>

      <div className="wf-requisicao-form__fields">
        {campos.map((campo) => (
          <label key={campo.id} className="wf-requisicao-form__field">
            <span className="wf-requisicao-form__label">
              {campo.label}
              {campo.obrigatorio ? <em aria-hidden="true"> *</em> : null}
            </span>
            {campo.ajuda ? <span className="wf-requisicao-form__help">{campo.ajuda}</span> : null}
            <RequisicaoFieldInput
              campo={campo}
              value={valores[campo.id]}
              error={errors[campo.id]}
              onChange={(next) => setValores((prev) => ({ ...prev, [campo.id]: next }))}
            />
            {errors[campo.id] ? (
              <span className="wf-requisicao-form__error">{errors[campo.id]}</span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="wf-requisicao-form__actions">
        <button type="button" className="wf-requisicao-form__btn wf-requisicao-form__btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="wf-requisicao-form__btn wf-requisicao-form__btn--primary" disabled={submitting}>
          {submitting ? 'Iniciando…' : 'Iniciar workflow'}
        </button>
      </div>
    </form>
  );
}
