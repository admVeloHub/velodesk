/**
 * WorkflowApprovalEssentials — ficha limpa do detalhe /workflow
 */
import React, { useState } from 'react';
import WorkflowApprovalAttachments from './WorkflowApprovalAttachments';

function EssentialRow({ label, value, children }) {
  if (!value && !children) return null;
  return (
    <div className="wf-approval-essentials__row">
      <span className="wf-approval-essentials__label">{label}</span>
      <span className="wf-approval-essentials__value">{children || value}</span>
    </div>
  );
}

export default function WorkflowApprovalEssentials({ essentials, slaLabel }) {
  const [requisicaoOpen, setRequisicaoOpen] = useState(false);

  if (!essentials) return null;

  const {
    cpf,
    produto,
    motivo,
    detalhe,
    responsavel,
    dadoAntigo,
    dadoNovo,
    descricao,
    tipoLabel,
    attachments,
    layout,
    requisicaoFields = [],
  } = essentials;

  const hasDiff = Boolean(dadoAntigo || dadoNovo);
  const hasAttachments = attachments && (
    (attachments.imagens?.length || 0) + (attachments.videos?.length || 0) > 0
    || attachments.recusouEvidencias
  );
  const isErrosBugs = layout === 'produtos-erros-bugs';

  return (
    <section className="wf-approval-essentials" aria-label="Informações do ticket">
      {tipoLabel ? (
        <p className="wf-approval-essentials__type">{tipoLabel}</p>
      ) : null}
      {slaLabel ? (
        <p className="wf-approval-essentials__sla">{slaLabel}</p>
      ) : null}

      <div className="wf-approval-essentials__grid">
        <EssentialRow label="CPF" value={cpf} />
        <EssentialRow label="Produto" value={produto} />
        <EssentialRow label="Motivo" value={motivo} />
        {detalhe ? <EssentialRow label="Detalhe" value={detalhe} /> : null}
        <EssentialRow label="Responsável" value={responsavel} />
      </div>

      {hasDiff ? (
        <div className="wf-approval-diff">
          {dadoAntigo ? (
            <div className="wf-approval-diff__item">
              <span className="wf-approval-diff__label">Dado antigo</span>
              <span className="wf-approval-diff__value">{dadoAntigo}</span>
            </div>
          ) : null}
          {dadoNovo ? (
            <div className="wf-approval-diff__item">
              <span className="wf-approval-diff__label">Dado novo</span>
              <span className="wf-approval-diff__value wf-approval-diff__value--new">{dadoNovo}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {isErrosBugs && descricao ? (
        <div className="wf-approval-essentials__descricao">
          <span className="wf-approval-essentials__label">Descrição</span>
          <p>{descricao}</p>
        </div>
      ) : null}

      {hasAttachments ? (
        <div className="wf-approval-essentials__attachments">
          <span className="wf-approval-essentials__label">Anexos</span>
          <WorkflowApprovalAttachments attachments={attachments} compact />
        </div>
      ) : null}

      {requisicaoFields.length ? (
        <div className="wf-approval-essentials__accordion">
          <button
            type="button"
            className="wf-approval-essentials__accordion-toggle"
            aria-expanded={requisicaoOpen}
            onClick={() => setRequisicaoOpen((v) => !v)}
          >
            <span>Dados da requisição</span>
            <i className={`ti ti-chevron-${requisicaoOpen ? 'up' : 'down'}`} aria-hidden="true" />
          </button>
          {requisicaoOpen ? (
            <ul className="wf-approval-essentials__requisicao-list">
              {requisicaoFields.map((field) => (
                <li key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
