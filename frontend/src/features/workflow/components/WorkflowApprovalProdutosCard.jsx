import React from 'react';
import WorkflowApprovalAttachments from './WorkflowApprovalAttachments';

function formatSubmittedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderRowValue(row) {
  if (row.booleanValue != null) {
    return (
      <span className={`wf-approval-produtos-rows__value${row.booleanValue ? ' is-success' : ' is-muted'}`}>
        {row.booleanValue ? (
          <>
            <i className="ti ti-check" aria-hidden="true" />
            Fotos Verificadas
          </>
        ) : (
          <>
            <i className="ti ti-x" aria-hidden="true" />
            Fotos não verificadas
          </>
        )}
      </span>
    );
  }

  return (
    <span className={`wf-approval-produtos-rows__value${row.tone && row.tone !== 'default' ? ` is-${row.tone}` : ''}`}>
      {row.value}
    </span>
  );
}

export default function WorkflowApprovalProdutosCard({ detail }) {
  const {
    typeBar,
    submittedAt,
    dadoAntigo,
    dadoNovo,
    descricao,
    rows,
    highlightCpf,
    attachments,
    layout,
  } = detail;

  const isErrosBugs = layout === 'produtos-erros-bugs';
  const showDiff = !isErrosBugs && (dadoAntigo || dadoNovo);
  const descriptionText = descricao || (isErrosBugs ? dadoNovo : '');

  return (
    <div className="wf-approval-produtos">
      {typeBar ? (
        <div className="wf-approval-produtos-type-bar">
          Tipo: {typeBar}
        </div>
      ) : null}

      {submittedAt ? (
        <p className="wf-approval-produtos-timestamp">{formatSubmittedAt(submittedAt)}</p>
      ) : null}

      {highlightCpf ? (
        <p className="wf-approval-produtos-highlight">CPF: {highlightCpf}</p>
      ) : null}

      {showDiff ? (
        <div className="wf-approval-produtos-diff">
          {dadoAntigo ? (
            <div className="wf-approval-produtos-diff__item">
              <span className="wf-approval-produtos-diff__label">Dado Antigo:</span>
              <span className="wf-approval-produtos-diff__value">{dadoAntigo}</span>
            </div>
          ) : null}
          {dadoNovo ? (
            <div className="wf-approval-produtos-diff__item">
              <span className="wf-approval-produtos-diff__label">Dado Novo:</span>
              <span className="wf-approval-produtos-diff__value">{dadoNovo}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {isErrosBugs && descriptionText ? (
        <div className="wf-approval-produtos-descricao">
          <span className="wf-approval-produtos-descricao__label">Descrição:</span>
          <p className="wf-approval-produtos-descricao__text">{descriptionText}</p>
        </div>
      ) : null}

      {attachments ? (
        <WorkflowApprovalAttachments attachments={attachments} />
      ) : null}

      {rows?.length ? (
        <ul className="wf-approval-produtos-rows">
          {rows.map((row, index) => (
            <li key={`${row.label}-${index}`} className="wf-approval-produtos-rows__item">
              {row.icon ? (
                <span className="wf-approval-produtos-rows__icon" aria-hidden="true">
                  <i className={`ti ${row.icon}`} />
                </span>
              ) : null}
              <div className="wf-approval-produtos-rows__body">
                {!row.hideLabel ? (
                  <span className="wf-approval-produtos-rows__label">{row.label}:</span>
                ) : null}
                {renderRowValue(row)}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
