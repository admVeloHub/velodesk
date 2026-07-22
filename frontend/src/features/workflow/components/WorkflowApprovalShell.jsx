/**
 * WorkflowApprovalShell — master-detail com fila por time (Financeiro / Produtos)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTickets } from '../../../context/TicketsContext';
import { useNotifications } from '../../../context/NotificationContext';
import { getAgentName } from '../../../services/desk/utils';
import {
  canAccessWorkflowApprovalConsole,
  readCachedPermissions,
  resolveWorkflowTeamQueueForUser,
} from '../../../services/permissions/permissionService';
import {
  computeWorkflowTeamActionQueue,
  getWorkflowApprovalDetail,
  findTicketEntryById,
} from '../../../services/workflow/workflowApprovalData';
import {
  resolveEffectiveWorkflowTeamId,
} from '../../../services/workflow/workflowTeamQueues';
import {
  approveWorkflowDecision,
  rejectWorkflowDecision,
  requestWorkflowInfo,
} from '../../../services/workflow/workflowDecisionHandlers';
import WorkflowApprovalQueue from './WorkflowApprovalQueue';
import WorkflowApprovalDetail from './WorkflowApprovalDetail';
import WorkflowTeamPicker from './WorkflowTeamPicker';
import WorkflowTeamSwitcher from './WorkflowTeamSwitcher';

const EMPTY_SUMMARY = {
  pendingCount: 0,
  awaitingDecisionCount: 0,
  approvedTodayCount: 0,
  slaCriticalCount: 0,
};

function canSelectWorkflowTicket(ticketId, effectiveTeamId, queue) {
  const id = String(ticketId);
  if (queue.some((item) => item.id === id)) return true;
  if (!effectiveTeamId) return false;
  if (getWorkflowApprovalDetail(id, effectiveTeamId)) return true;
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

  const urlTeam = searchParams.get('team');
  const effectiveTeamId = useMemo(
    () => resolveEffectiveWorkflowTeamId({ perm: readCachedPermissions(), urlTeam }),
    [urlTeam, refreshKey, demoRevision],
  );
  const canAccessConsole = useMemo(() => canAccessWorkflowApprovalConsole(), [refreshKey, demoRevision]);
  const rbacTeamId = useMemo(
    () => resolveWorkflowTeamQueueForUser(readCachedPermissions()),
    [refreshKey, demoRevision],
  );
  const showTeamSwitcher = canAccessConsole && !rbacTeamId && Boolean(effectiveTeamId);

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
    if (!effectiveTeamId) {
      return { queueLabel: 'Workflow', queue: [], summary: EMPTY_SUMMARY, teamId: null };
    }
    return computeWorkflowTeamActionQueue(effectiveTeamId);
  }, [effectiveTeamId, refreshKey, demoRevision]);

  const handleSelectTeam = useCallback((teamId) => {
    const next = new URLSearchParams(searchParams);
    next.set('team', teamId);
    next.delete('ticket');
    setSearchParams(next, { replace: true });
    setSelectedId(null);
  }, [searchParams, setSearchParams]);

  const handleSelectTicket = useCallback((ticketId) => {
    setSelectedId(String(ticketId));
    if (searchParams.get('ticket')) {
      const next = new URLSearchParams(searchParams);
      next.delete('ticket');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!effectiveTeamId) return;

    const fromUrl = searchParams.get('ticket');

    if (fromUrl) {
      const id = String(fromUrl);
      if (canSelectWorkflowTicket(id, effectiveTeamId, queueData.queue)) {
        setSelectedId(id);
        return;
      }
    }

    setSelectedId((current) => {
      if (current && canSelectWorkflowTicket(current, effectiveTeamId, queueData.queue)) {
        return current;
      }
      return queueData.queue[0]?.id || null;
    });
  }, [queueData.queue, searchParams, effectiveTeamId, refreshKey, demoRevision]);

  const detail = useMemo(
    () => (selectedId && effectiveTeamId ? getWorkflowApprovalDetail(selectedId, effectiveTeamId) : null),
    [selectedId, effectiveTeamId, refreshKey, demoRevision],
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

  const handleApproveConfirm = useCallback(async (payload = {}) => {
    if (!selectedId || busy) return false;

    const queueIds = queueData.queue.map((q) => q.id);
    const currentIdx = queueIds.indexOf(String(selectedId));
    let nextId = queueIds[currentIdx + 1] ?? queueIds[currentIdx - 1] ?? null;
    if (nextId === String(selectedId)) nextId = null;

    const isProdutosFinalize = Boolean(payload.selectedActions?.length);

    setBusy(true);
    try {
      await approveWorkflowDecision(selectedId, payload);
      await refreshTickets();

      if (isProdutosFinalize && effectiveTeamId) {
        const refreshed = computeWorkflowTeamActionQueue(effectiveTeamId);
        setSelectedId(refreshed.queue[0]?.id ?? nextId ?? null);
        showNotification('Solicitação concluída. Ticket encerrado e cliente notificado.', 'success');
      } else {
        showNotification('Solicitação aprovada e workflow avançado.', 'success');
      }
      return true;
    } catch {
      showNotification('Não foi possível concluir a ação.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, effectiveTeamId, queueData.queue, refreshTickets, selectedId, showNotification]);

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

  if (!canAccessConsole) {
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

  if (!effectiveTeamId) {
    return (
      <div className="wf-approval-shell wf-approval-shell--gate">
        <WorkflowTeamPicker variant="gate" onSelect={handleSelectTeam} />
      </div>
    );
  }

  const queueLabel = queueData.queueLabel;

  return (
    <div className="wf-approval-shell-wrap">
      {showTeamSwitcher ? (
        <WorkflowTeamSwitcher activeTeamId={effectiveTeamId} onSelect={handleSelectTeam} />
      ) : null}
      <div className="wf-approval-shell">
        <WorkflowApprovalQueue
          queueLabel={queueLabel}
          items={queueData.queue}
          selectedId={selectedId}
          onSelect={handleSelectTicket}
        />
        <WorkflowApprovalDetail
          detail={detail}
          summary={queueData.summary}
          teamId={effectiveTeamId}
          busy={busy}
          infoPanelOpen={infoPanelOpen}
          requestedBy={getAgentName() || 'Operador Workflow'}
          onApproveConfirm={handleApproveConfirm}
          onReject={handleReject}
          onRequestInfoOpen={handleRequestInfoOpen}
          onRequestInfoSubmit={handleRequestInfoSubmit}
          onRequestInfoCancel={handleRequestInfoCancel}
        />
      </div>
    </div>
  );
}
