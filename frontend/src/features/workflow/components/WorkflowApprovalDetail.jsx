import React from 'react';
import WorkflowApprovalKpis from './WorkflowApprovalKpis';
import WorkflowApprovalFieldGrid from './WorkflowApprovalFieldGrid';
import WorkflowApprovalSlaBar from './WorkflowApprovalSlaBar';
import WorkflowApprovalActions from './WorkflowApprovalActions';
import WorkflowApprovalRequestInfoPanel from './WorkflowApprovalRequestInfoPanel';

export default function WorkflowApprovalDetail({
  detail,
  summary,
  busy,
  infoPanelOpen,
  requestedBy,
  onApprove,
  onReject,
  onRequestInfoOpen,
  onRequestInfoSubmit,
  onRequestInfoCancel,
}) {
  if (!detail) {
    return (
      <section className="wf-approval-detail wf-approval-detail--empty">
        <div className="wf-approval-detail__empty">
          <p>Selecione um item da fila ou aguarde novas solicitações de decisão.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="wf-approval-detail" aria-label={detail.title}>
      <header className="wf-approval-detail__head">
        <div className="wf-approval-detail__title-row">
          <h1>{detail.title}</h1>
          <span className="wf-approval-badge wf-approval-badge--pending">{detail.statusBadge}</span>
        </div>
        <p className="wf-approval-detail__meta">{detail.metaLine}</p>
      </header>

      <WorkflowApprovalKpis summary={summary} />

      <article className="wf-approval-card">
        <h3>{detail.cardTitle}</h3>
        <p className="wf-approval-card__sub">{detail.cardSubtext}</p>

        {detail.slaLabel ? (
          <WorkflowApprovalSlaBar label={detail.slaLabel} pct={detail.slaPct} />
        ) : null}

        <WorkflowApprovalFieldGrid fields={detail.fields} />

        {detail.justificationQuote || detail.internalNote ? (
          <blockquote className="wf-approval-quote">
            {detail.justificationQuote ? (
              <p className="wf-approval-quote__text">
                &ldquo;{detail.justificationQuote}&rdquo;
              </p>
            ) : null}
            {detail.internalNote ? (
              <p className="wf-approval-quote__note">
                — {detail.internalNote}
              </p>
            ) : null}
          </blockquote>
        ) : null}

        <WorkflowApprovalRequestInfoPanel
          open={infoPanelOpen}
          busy={busy}
          responsibleAgent={detail.responsibleAgent}
          requestedBy={requestedBy}
          onSubmit={onRequestInfoSubmit}
          onCancel={onRequestInfoCancel}
        />

        <WorkflowApprovalActions
          actions={detail.actions}
          busy={busy}
          infoPanelOpen={infoPanelOpen}
          onApprove={onApprove}
          onReject={onReject}
          onRequestInfoOpen={onRequestInfoOpen}
        />
      </article>
    </section>
  );
}
