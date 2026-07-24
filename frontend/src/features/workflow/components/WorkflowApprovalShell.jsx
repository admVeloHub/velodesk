/**
 * WorkflowApprovalShell v1.7.0 — recarrega detalhe quando comunicacaoPendente sem array
 * VERSION: v1.7.0 | DATE: 2026-07-24
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTickets } from '../../../context/TicketsContext';
import { useNotifications } from '../../../context/NotificationContext';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import { usePermissionsOptional } from '../../../context/PermissionContext';
import deskLog from '../../../utils/deskDebugLog';
import { findTicketEntry, loadTicketDetailFromApi } from '../../../services/ticketsStorage';
import {
  hasWorkflowPortalAccess,
  resolveWorkflowTeamQueueForUser,
} from '../../../services/permissions/permissionService';
import {
  computeWorkflowAssigneeQueue,
  computeWorkflowTeamQueue,
  getWorkflowApprovalDetail,
} from '../../../services/workflow/workflowApprovalData';
import { getWorkflowTeamQueueMeta } from '../../../services/workflow/workflowTeamQueues';
import {
  approveWorkflowDecision,
  rejectWorkflowDecision,
  requestWorkflowInfo,
} from '../../../services/workflow/workflowDecisionHandlers';
import WorkflowApprovalQueue from './WorkflowApprovalQueue';
import WorkflowApprovalDetail from './WorkflowApprovalDetail';

const EMPTY_SUMMARY = {
  pendingCount: 0,
  awaitingDecisionCount: 0,
  approvedTodayCount: 0,
  slaCriticalCount: 0,
};

export default function WorkflowApprovalShell() {
  const [searchParams] = useSearchParams();
  const { refreshKey, refreshTickets } = useTickets();
  const { showNotification } = useNotifications();
  const { workflows: workflowDefinitions, loading: workflowConfigLoading } = useWorkflowConfig();
  const permsCtx = usePermissionsOptional();
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const hasWorkflowAccess = useMemo(
    () => hasWorkflowPortalAccess(permsCtx?.permissions),
    [permsCtx?.permissions, refreshKey, demoRevision],
  );
  const teamQueueId = useMemo(
    () => (hasWorkflowAccess ? resolveWorkflowTeamQueueForUser(permsCtx?.permissions) : null),
    [hasWorkflowAccess, permsCtx?.permissions, refreshKey, demoRevision],
  );
  const teamMeta = useMemo(
    () => (teamQueueId ? getWorkflowTeamQueueMeta(teamQueueId) : null),
    [teamQueueId],
  );

  useEffect(() => {
    const onDemoChange = () => setDemoRevision((v) => v + 1);
    window.addEventListener('velodesk:workflow-demo-changed', onDemoChange);
    return () => window.removeEventListener('velodesk:workflow-demo-changed', onDemoChange);
  }, []);

  useEffect(() => {
    setInfoPanelOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !hasWorkflowAccess) return undefined;

    const entry = findTicketEntry(selectedId);
    const ticket = entry?.ticket;
    const hasComunicacaoArray = Array.isArray(
      ticket?.workflow?.requisicao?.comunicacaoWorkflow,
    );
    const comunicacaoPendente = ticket?.workflow?.requisicao?.comunicacaoPendente === true;
    const needsDetail = !ticket
      || ticket.listOnly === true
      || !ticket._detailLoaded
      || (comunicacaoPendente && !hasComunicacaoArray);

    if (!needsDetail) return undefined;

    deskLog.workflow('carregando detalhe do ticket', { ticketId: selectedId });
    let cancelled = false;
    void loadTicketDetailFromApi(selectedId)
      .then((full) => {
        if (cancelled) return;
        deskLog.workflow('detalhe carregado', {
          ticketId: selectedId,
          requisicao: full?.workflow?.requisicao?.valores || {},
          comunicacao: full?.workflow?.requisicao?.comunicacaoWorkflow?.length || 0,
        });
        setDetailRevision((v) => v + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        deskLog.error('WORKFLOW', 'falha ao carregar detalhe', {
          ticketId: selectedId,
          status,
          message: err?.response?.data?.message || err?.message,
        });
        if (status === 403) {
          showNotification('Sem permissão para carregar o detalhe deste ticket.', 'warning');
        }
      });

    return () => { cancelled = true; };
  }, [selectedId, hasWorkflowAccess, refreshKey, showNotification]);

  const queueData = useMemo(() => {
    if (!hasWorkflowAccess) {
      return { queueLabel: 'Workflow', queue: [], summary: EMPTY_SUMMARY, teamId: null };
    }
    const data = teamQueueId
      ? computeWorkflowTeamQueue(teamQueueId)
      : computeWorkflowAssigneeQueue();
    deskLog.workflow('fila calculada', {
      teamQueueId,
      pending: data.summary?.pendingCount,
      fila: data.queue?.length,
    });
    return data;
  }, [hasWorkflowAccess, teamQueueId, refreshKey, demoRevision, workflowDefinitions, workflowConfigLoading]);

  const detail = useMemo(
    () => (selectedId && hasWorkflowAccess ? getWorkflowApprovalDetail(selectedId, teamQueueId) : null),
    [selectedId, teamQueueId, hasWorkflowAccess, refreshKey, demoRevision, detailRevision],
  );

  useEffect(() => {
    if (!detail || !selectedId) return;
    deskLog.workflow('detalhe renderizado', {
      ticketId: selectedId,
      fieldSections: detail.fieldSections?.map((s) => ({
        title: s.title,
        fields: s.fields?.map((f) => ({ label: f.label, value: f.value })),
      })),
    });
  }, [detail, selectedId]);

  useEffect(() => {
    const fromUrl = searchParams.get('ticket');
    if (fromUrl && queueData.queue.some((q) => q.id === String(fromUrl))) {
      setSelectedId(String(fromUrl));
      return;
    }
    if (!selectedId && queueData.queue.length) {
      setSelectedId(queueData.queue[0].id);
    } else if (selectedId && !queueData.queue.some((q) => q.id === selectedId)) {
      setSelectedId(queueData.queue[0]?.id || null);
    }
  }, [queueData.queue, searchParams, selectedId]);

  const runAction = useCallback(async (actionFn, successMsg, args = []) => {
    if (!selectedId || busy) return false;
    setBusy(true);
    try {
      await actionFn(selectedId, ...args);
      await refreshTickets();
      setDetailRevision((v) => v + 1);
      showNotification(successMsg, 'success');
      return true;
    } catch (err) {
      deskLog.error('WORKFLOW', 'ação falhou', {
        ticketId: selectedId,
        message: err?.response?.data?.message || err?.message,
      });
      showNotification(err?.response?.data?.message || 'Não foi possível concluir a ação.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, selectedId, showNotification]);

  const handleApprove = useCallback(
    (options) => runAction(
      approveWorkflowDecision,
      'Solicitação aprovada e workflow avançado.',
      options ? [options] : [],
    ),
    [runAction],
  );

  const handleReject = useCallback(
    () => runAction(rejectWorkflowDecision, 'Solicitação reprovada.'),
    [runAction],
  );

  const handleRequestInfoOpen = useCallback(() => {
    if (busy) return;
    setInfoPanelOpen(true);
  }, [busy]);

  const handleRequestInfoCancel = useCallback(() => {
    if (busy) return;
    setInfoPanelOpen(false);
  }, [busy]);

  const handleRequestInfoSubmit = useCallback(async (message) => {
    if (!selectedId || busy) return null;
    setBusy(true);
    try {
      const updated = await requestWorkflowInfo(selectedId, message, 'workflow');
      setDetailRevision((v) => v + 1);
      showNotification('Mensagem enviada ao responsável.', 'success');
      // Lista/boxes em background — não bloqueia nem apaga a thread do modal
      void refreshTickets();
      return updated;
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível enviar a mensagem.', 'error');
      throw err;
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, selectedId, showNotification]);

  if (!hasWorkflowAccess) {
    return (
      <div className="wf-approval-shell wf-approval-shell--empty">
        <section className="wf-approval-detail wf-approval-detail--empty wf-approval-detail--full">
          <div className="wf-approval-detail__empty">
            <h2>Visão Workflow indisponível</h2>
            <p>
              Esta visão exige a permissão <strong>Visão Workflow</strong> nos overrides da função do agente.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const queueLabel = teamMeta?.name || queueData.queueLabel;

  return (
    <div className="wf-approval-shell">
      <WorkflowApprovalQueue
        queueLabel={queueLabel}
        items={queueData.queue}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <WorkflowApprovalDetail
        detail={detail}
        summary={queueData.summary}
        teamId={teamQueueId}
        busy={busy}
        infoPanelOpen={infoPanelOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestInfoOpen={handleRequestInfoOpen}
        onRequestInfoSubmit={handleRequestInfoSubmit}
        onRequestInfoCancel={handleRequestInfoCancel}
      />
    </div>
  );
}
