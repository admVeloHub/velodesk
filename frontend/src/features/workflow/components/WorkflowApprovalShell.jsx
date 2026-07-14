/**
 * WorkflowApprovalShell — master-detail
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTickets } from '../../../context/TicketsContext';
import { useNotifications } from '../../../context/NotificationContext';
import { getAgentName } from '../../../services/desk/utils';
import {
  computeWorkflowApprovalQueue,
  getWorkflowApprovalDetail,
} from '../../../services/workflow/workflowApprovalData';
import {
  approveWorkflowDecision,
  rejectWorkflowDecision,
  requestWorkflowInfo,
} from '../../../services/workflow/workflowDecisionHandlers';
import WorkflowApprovalQueue from './WorkflowApprovalQueue';
import WorkflowApprovalDetail from './WorkflowApprovalDetail';

export default function WorkflowApprovalShell() {
  const [searchParams] = useSearchParams();
  const { refreshKey, refreshTickets } = useTickets();
  const { showNotification } = useNotifications();
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  useEffect(() => {
    const onDemoChange = () => setDemoRevision((v) => v + 1);
    window.addEventListener('velodesk:workflow-demo-changed', onDemoChange);
    return () => window.removeEventListener('velodesk:workflow-demo-changed', onDemoChange);
  }, []);

  useEffect(() => {
    setInfoPanelOpen(false);
  }, [selectedId]);

  const queueData = useMemo(
    () => computeWorkflowApprovalQueue(),
    [refreshKey, demoRevision],
  );

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

  const detail = useMemo(
    () => (selectedId ? getWorkflowApprovalDetail(selectedId) : null),
    [selectedId, refreshKey, demoRevision],
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

  return (
    <div className="wf-approval-shell">
      <WorkflowApprovalQueue
        queueLabel={queueData.queueLabel}
        items={queueData.queue}
        selectedId={selectedId}
        onSelect={setSelectedId}
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
