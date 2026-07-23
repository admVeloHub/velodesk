import React, { useCallback, useEffect, useState } from 'react';
import WorkflowApprovalKpis from './WorkflowApprovalKpis';
import WorkflowApprovalFieldGrid from './WorkflowApprovalFieldGrid';
import WorkflowApprovalSlaBar from './WorkflowApprovalSlaBar';
import WorkflowApprovalActions from './WorkflowApprovalActions';
import WorkflowApprovalRequestInfoPanel from './WorkflowApprovalRequestInfoPanel';
import WorkflowApprovalProdutosCard from './WorkflowApprovalProdutosCard';
import WorkflowApprovalProdutosApprovePanel from './WorkflowApprovalProdutosApprovePanel';

export default function WorkflowApprovalDetail({
  detail,
  summary,
  teamId,
  busy,
  infoPanelOpen,
  requestedBy,
  onApproveConfirm,
  onReject,
  onRequestInfoOpen,
  onRequestInfoSubmit,
  onRequestInfoCancel,
}) {
  const [approvePanelOpen, setApprovePanelOpen] = useState(false);
  const isProdutosTeam = teamId === 'produtos';

  useEffect(() => {
    setApprovePanelOpen(false);
  }, [detail?.ticketId]);

  const handleApproveClick = useCallback(() => {
    if (busy) return;
    if (isProdutosTeam) {
      onRequestInfoCancel?.();
      setApprovePanelOpen(true);
      return;
    }
    onApproveConfirm?.();
  }, [busy, isProdutosTeam, onApproveConfirm, onRequestInfoCancel]);

  const handleApprovePanelClose = useCallback(() => {
    if (busy) return;
    setApprovePanelOpen(false);
  }, [busy]);

  const handleApprovePanelConfirm = useCallback(async (selectedActions) => {
    const ok = await onApproveConfirm?.({ selectedActions });
    if (ok) setApprovePanelOpen(false);
  }, [onApproveConfirm]);

  if (!detail) {
    return (
      <section className="wf-approval-detail wf-approval-detail--empty">
        <div className="wf-approval-detail__empty">
          <p>Selecione um ticket da fila ou aguarde novos encaminhamentos.</p>
        </div>
      </section>
    );
  }

  const badgeClass = detail.awaitingDecision
    ? 'wf-approval-badge--pending'
    : detail.teamStepActive
      ? 'wf-approval-badge--active'
      : 'wf-approval-badge--muted';

  return (
    <section className="wf-approval-detail" aria-label={detail.title}>
      <header className="wf-approval-detail__head">
        <div className="wf-approval-detail__title-row">
          <h1>{detail.title}</h1>
          <span className={`wf-approval-badge ${badgeClass}`}>{detail.statusBadge}</span>
        </div>
        <p className="wf-approval-detail__meta">{detail.metaLine}</p>
        {detail.statusMessage ? (
          <p className="wf-approval-detail__status-msg">{detail.statusMessage}</p>
        ) : null}
      </header>

      <WorkflowApprovalKpis summary={summary} />

      <div className="wf-approval-card-wrap">
        <article className="wf-approval-card">
          {detail.layout !== 'produtos-cadastral' && detail.layout !== 'produtos-erros-bugs' ? (
            <>
              <h3>{detail.cardTitle}</h3>
              <p className="wf-approval-card__sub">{detail.cardSubtext}</p>
            </>
          ) : (
            <p className="wf-approval-card__sub wf-approval-card__sub--compact">{detail.cardSubtext}</p>
          )}

          {detail.slaLabel ? (
            <WorkflowApprovalSlaBar label={detail.slaLabel} pct={detail.slaPct} />
          ) : null}

          {detail.layout === 'produtos-cadastral' || detail.layout === 'produtos-erros-bugs' ? (
            <WorkflowApprovalProdutosCard detail={detail} />
          ) : (
            <>
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
            </>
          )}

          {detail.awaitingDecision ? (
            <>
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
                actionLabels={detail.actionLabels}
                busy={busy}
                infoPanelOpen={infoPanelOpen}
                approvePanelOpen={approvePanelOpen}
                onApprove={handleApproveClick}
                onReject={onReject}
                onRequestInfoOpen={onRequestInfoOpen}
              />
            </>
          ) : null}
        </article>

        {isProdutosTeam && detail.awaitingDecision ? (
          <WorkflowApprovalProdutosApprovePanel
            open={approvePanelOpen}
            busy={busy}
            onConfirm={handleApprovePanelConfirm}
            onClose={handleApprovePanelClose}
          />
        ) : null}
      </div>
    </section>
  );
}
