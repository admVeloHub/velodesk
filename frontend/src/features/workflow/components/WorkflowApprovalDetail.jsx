/**
 * WorkflowApprovalDetail v1.6.0 — stepper clicável + modal interromper workflow
 * VERSION: v1.6.0 | DATE: 2026-07-28
 */
import React, { useCallback, useEffect, useState } from 'react';
import WorkflowApprovalKpis from './WorkflowApprovalKpis';
import WorkflowApprovalFieldGrid from './WorkflowApprovalFieldGrid';
import WorkflowApprovalSlaBar from './WorkflowApprovalSlaBar';
import WorkflowApprovalActions from './WorkflowApprovalActions';
import WorkflowApprovalProdutosApprovePanel from './WorkflowApprovalProdutosApprovePanel';
import WorkflowComunicacaoModal from './WorkflowComunicacaoModal';
import TicketWorkflowStepper from '../../desk/components/TicketWorkflowStepper';
import WorkflowProgressModal from '../../desk/components/WorkflowProgressModal';
import { isTicketInWorkflow } from '../../../services/desk/utils';

export default function WorkflowApprovalDetail({
  detail,
  summary,
  teamId,
  busy,
  infoPanelOpen,
  onApprove,
  onReject,
  onRequestInfoOpen,
  onRequestInfoSubmit,
  onRequestInfoCancel,
  canManageWorkflow = false,
  canAdvanceWorkflow = false,
  onAdvanceWorkflow,
  onCancelWorkflow,
  advancingWorkflow = false,
  cancelingWorkflow = false,
}) {
  const [approvePanelOpen, setApprovePanelOpen] = useState(false);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
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
    onApprove?.();
  }, [busy, isProdutosTeam, onApprove, onRequestInfoCancel]);

  const handleApprovePanelClose = useCallback(() => {
    if (busy) return;
    setApprovePanelOpen(false);
  }, [busy]);

  const handleApprovePanelConfirm = useCallback(async (selectedActions) => {
    const ok = await onApprove?.({ selectedActions });
    if (ok !== false) setApprovePanelOpen(false);
  }, [onApprove]);

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
        {canManageWorkflow && detail.ticket && isTicketInWorkflow(detail.ticket) ? (
          <div className="wf-approval-detail__workflow-track">
            <TicketWorkflowStepper
              ticket={detail.ticket}
              clickable
              onClick={() => setWorkflowModalOpen(true)}
            />
            <WorkflowProgressModal
              open={workflowModalOpen}
              ticket={detail.ticket}
              onClose={() => setWorkflowModalOpen(false)}
              onCancelWorkflow={async () => {
                await onCancelWorkflow?.();
                setWorkflowModalOpen(false);
              }}
              onAdvanceWorkflow={onAdvanceWorkflow}
              canceling={cancelingWorkflow}
              advancing={advancingWorkflow}
              canAdvance={canAdvanceWorkflow}
              canCancel
            />
          </div>
        ) : null}
      </header>

      <WorkflowApprovalKpis summary={summary} />

      <div className="wf-approval-card-wrap">
        <article className="wf-approval-card">
          <h3>{detail.cardTitle}</h3>
          <p className="wf-approval-card__sub">{detail.cardSubtext}</p>

          {detail.slaLabel ? (
            <WorkflowApprovalSlaBar label={detail.slaLabel} pct={detail.slaPct} />
          ) : null}

          {detail.fieldSections?.length ? (
            detail.fieldSections.map((section) => (
              <div key={section.title} className="wf-approval-section">
                <h4 className="wf-approval-section__title">{section.title}</h4>
                <WorkflowApprovalFieldGrid fields={section.fields} />
              </div>
            ))
          ) : (
            <WorkflowApprovalFieldGrid fields={detail.fields} />
          )}

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

          {detail.awaitingDecision ? (
            <>
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

              {isProdutosTeam ? (
                <WorkflowApprovalProdutosApprovePanel
                  open={approvePanelOpen}
                  busy={busy}
                  onClose={handleApprovePanelClose}
                  onConfirm={handleApprovePanelConfirm}
                />
              ) : null}
            </>
          ) : null}
        </article>
      </div>

      <WorkflowComunicacaoModal
        open={infoPanelOpen}
        busy={busy}
        ticket={detail.ticket}
        origem="workflow"
        title="Pedir informação"
        subtitle={`Thread com ${detail.responsibleAgent || 'o responsável do ticket'}`}
        onClose={onRequestInfoCancel}
        onSubmit={onRequestInfoSubmit}
      />
    </section>
  );
}
