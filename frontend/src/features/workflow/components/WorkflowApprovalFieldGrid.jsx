/**
 * WorkflowApprovalFieldGrid v1.1.0 — grid 3 colunas (contexto + requisição)
 * VERSION: v1.1.0 | DATE: 2026-07-24
 */
import React from 'react';

export default function WorkflowApprovalFieldGrid({ fields }) {
  if (!fields?.length) return null;
  return (
    <div className="wf-approval-fields">
      {fields.map((field) => (
        <div key={field.label} className="wf-approval-fields__cell">
          <span className="wf-approval-fields__label">{field.label}</span>
          <span className={'wf-approval-fields__value' + (field.tone && field.tone !== 'default' ? ` is-${field.tone}` : '')}>
            {field.value}
          </span>
        </div>
      ))}
    </div>
  );
}
