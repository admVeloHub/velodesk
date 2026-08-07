/**

 * WorkflowApprovalDetail v1.7.0 — layout clean 2 colunas + comunicação inline

 * VERSION: v1.7.0 | DATE: 2026-08-06

 */

import React, { useState } from 'react';

import WorkflowApprovalEssentials from './WorkflowApprovalEssentials';

import WorkflowComunicacaoPanel from './WorkflowComunicacaoPanel';

import WorkflowApprovalFooter from './WorkflowApprovalFooter';

import TicketWorkflowStepper from '../../desk/components/TicketWorkflowStepper';

import WorkflowProgressModal from '../../desk/components/WorkflowProgressModal';

import { isTicketInWorkflow } from '../../../services/desk/utils';



export default function WorkflowApprovalDetail({

  detail,

  teamId,

  busy,

  onApprove,

  onFeito,

  onReject,

  onRequestInfoSubmit,

  canManageWorkflow = false,

  canAdvanceWorkflow = false,

  onAdvanceWorkflow,

  onCancelWorkflow,

  advancingWorkflow = false,

  cancelingWorkflow = false,

}) {

  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);



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



  const handleFeito = () => (onFeito || onApprove)?.();



  return (

    <section className="wf-approval-detail wf-approval-detail--clean" aria-label={detail.title}>

      <header className="wf-approval-detail__head wf-approval-detail__head--compact">

        <div className="wf-approval-detail__title-row">

          <div>

            <h1>{detail.essentials?.clientName || detail.title}</h1>

            <p className="wf-approval-detail__meta wf-approval-detail__meta--compact">

              {detail.essentials?.protocol ? `#${detail.essentials.protocol}` : null}

              {detail.essentials?.protocol && detail.metaLine ? ' · ' : null}

              {detail.metaLine}

            </p>

          </div>

          <span className={`wf-approval-badge ${badgeClass}`}>{detail.statusBadge}</span>

        </div>

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



      <div className="wf-approval-detail__body">

        <WorkflowApprovalEssentials

          essentials={detail.essentials}

          slaLabel={detail.slaLabel}

        />

        <WorkflowComunicacaoPanel

          ticket={detail.ticket}

          responsibleAgent={detail.responsibleAgent}

          busy={busy}

          onSubmit={onRequestInfoSubmit}

        />

      </div>



      <WorkflowApprovalFooter
        teamId={teamId}
        awaitingDecision={detail.awaitingDecision}
        actions={detail.actions}

        actionLabels={detail.actionLabels}

        busy={busy}

        onFeito={handleFeito}

        onApprove={onApprove}

        onReject={onReject}

      />

    </section>

  );

}

