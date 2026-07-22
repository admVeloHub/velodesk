/**
 * WorkflowApprovalShell — master-detail com fila por time (Financeiro / Produtos)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTickets } from '../../../context/TicketsContext';
import { useNotifications } from '../../../context/NotificationContext';
import { getAgentName } from '../../../services/desk/utils';
import { resolveWorkflowTeamQueueForUser } from '../../../services/permissions/permissionService';
import {
  computeWorkflowTeamQueue,
  getWorkflowApprovalDetail,
  findTicketEntryById,
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

function canSelectWorkflowTicket(ticketId, teamQueueId, queue) {
  const id = String(ticketId);
  if (queue.some((item) => item.id === id)) return true;
  if (!teamQueueId) return false;
  if (getWorkflowApprovalDetail(id, teamQueueId)) return true;
  return Boolean(findTicketEntryById(id));
}

export default function WorkflowApprovalShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshKey, refreshTickets } = useTickets();
  const { showNotification } = useNotifications();
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const teamQueueId = useMemo(() => resolveWorkflowTeamQueueForUser(), [refreshKey, demoRevision]);
  const teamMeta = useMemo(
    () => (teamQueueId ? getWorkflowTeamQueueMeta(teamQueueId) : null),
    [teamQueueId],
  );

  useEffect(() => {
    const onDemoChange = () => setDemoRevision((v) => v + 1);
    const onCacheRefresh = () => setDemoRevision((v) => v + 1);
    window.addEventListener('velodesk:workflow-demo-changed', onDemoChange);
    window.addEventListener('velodesk:refresh-tickets', onCacheRefresh);
    return () => {
      window.removeEventListener('velodesk:workflow-demo-changed', onDemoChange);
      window.removeEventListener('velodesk:refresh-tickets', onCacheRefresh);
    };
  }, []);

  useEffect(() => {
    setInfoPanelOpen(false);
  }, [selectedId]);

  const queueData = useMemo(() => {
    if (!teamQueueId) {
      return { queueLabel: 'Workflow', queue: [], summary: EMPTY_SUMMARY, teamId: null };
    }
    return computeWorkflowTeamQueue(teamQueueId);
  }, [teamQueueId, refreshKey, demoRevision]);

  const handleSelectTicket = useCallback((ticketId) => {
    setSelectedId(String(ticketId));
    if (searchParams.get('ticket')) {
      const next = new URLSearchParams(searchParams);
      next.delete('ticket');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get('ticket');

    if (fromUrl && teamQueueId) {
      const id = String(fromUrl);
      if (canSelectWorkflowTicket(id, teamQueueId, queueData.queue)) {
        setSelectedId(id);
        return;
      }
    }

    setSelectedId((current) => {
      if (current && canSelectWorkflowTicket(current, teamQueueId, queueData.queue)) {
        return current;
      }
      return queueData.queue[0]?.id || null;
    });
  }, [queueData.queue, searchParams, teamQueueId, refreshKey, demoRevision]);

  const detail = useMemo(
    () => (selectedId && teamQueueId ? getWorkflowApprovalDetail(selectedId, teamQueueId) : null),
    [selectedId, teamQueueId, refreshKey, demoRevision],
  );

  const runAction = useCallback(async (actionFn, successMsg) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await actionFn(selectedId);
      await refreshTickets();
      showNotification(successMsg, 'success');
    } catch {
      showNotification('Não foi possível concluir a ação.', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, selectedId, showNotification]);

  const handleApprove = useCallback(
    () => runAction(approveWorkflowDecision, 'Solicitação aprovada e workflow avançado.'),
    [runAction],
  );

  const handleReject = useCallback(
    () => runAction(rejectWorkflowDecision, 'Solicitação reprovada.'),
    [runAction],
  );

  const handleRequestInfoOpen = useCallback(() => {
    if (busy) return;
    setInfoPanelOpen((open) => !open);
  }, [busy]);

  const handleRequestInfoCancel = useCallback(() => {
    if (busy) return;
    setInfoPanelOpen(false);
  }, [busy]);

  const handleRequestInfoSubmit = useCallback(async (message) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await requestWorkflowInfo(selectedId, message);
      await refreshTickets();
      setInfoPanelOpen(false);
      showNotification('Solicitação enviada ao agente responsável.', 'success');
    } catch {
      showNotification('Não foi possível enviar a solicitação.', 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, selectedId, showNotification]);

  if (!teamQueueId) {
    return (
      <div className="wf-approval-shell wf-approval-shell--empty">
        <section className="wf-approval-detail wf-approval-detail--empty wf-approval-detail--full">
          <div className="wf-approval-detail__empty">
            <h2>Sem fila de workflow atribuída</h2>
            <p>
              Este perfil exige função Financeiro ou Produtos para acessar a fila de atendimento.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wf-approval-shell">
      <WorkflowApprovalQueue
        queueLabel={teamMeta?.name || queueData.queueLabel}
        items={queueData.queue}
        selectedId={selectedId}
        onSelect={handleSelectTicket}
      />
      <WorkflowApprovalDetail
        detail={detail}
        summary={queueData.summary}
        busy={busy}
        infoPanelOpen={infoPanelOpen}
        requestedBy={getAgentName() || 'Operador Workflow'}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestInfoOpen={handleRequestInfoOpen}
        onRequestInfoSubmit={handleRequestInfoSubmit}
        onRequestInfoCancel={handleRequestInfoCancel}
      />
    </div>
  );
}
