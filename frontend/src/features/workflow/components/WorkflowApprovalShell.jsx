/**
 * WorkflowApprovalShell v1.9.2 — runAction libera busy e sincroniza fila após falha
 * VERSION: v1.9.2 | DATE: 2026-08-20
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTickets } from '../../../context/TicketsContext';
import { useNotifications } from '../../../context/NotificationContext';
import { useWorkflowConfig } from '../../../context/WorkflowConfigContext';
import { usePermissionsOptional } from '../../../context/PermissionContext';
import deskLog from '../../../utils/deskDebugLog';
import { subscribeToTicketEvents } from '../../../services/desk/ticketEventsRealtime';
import { findTicketEntry, loadTicketDetailFromApi } from '../../../services/ticketsStorage';
import {
  canInterruptWorkflow,
  hasWorkflowPortalAccess,
  resolveWorkflowTeamQueueForUser,
} from '../../../services/permissions/permissionService';
import {
  computeWorkflowAssigneeQueue,
  computeWorkflowTeamQueue,
  getWorkflowApprovalDetail,
} from '../../../services/workflow/workflowApprovalData';
import {
  getWorkflowTeamQueueMeta,
  ticketMatchesWorkflowTeam,
  resolveWorkflowTeamForTicket,
  isWorkflowTicketCompleted,
  isTicketClosedByAgent,
} from '../../../services/workflow/workflowTeamQueues';
import {
  approveWorkflowDecision,
  rejectWorkflowDecision,
  requestWorkflowInfo,
  resolveComunicacaoResumo,
} from '../../../services/workflow/workflowDecisionHandlers';
import { getWorkflowProgress, isTicketWorkflowActive } from '../../../services/desk/utils';
import { resolveAutomaticaConfig } from '../../config/workflow/workflowConfigData';
import { ticketsApi } from '../../../api/client';
import WorkflowApprovalQueue from './WorkflowApprovalQueue';
import WorkflowApprovalDetail from './WorkflowApprovalDetail';

const EMPTY_SUMMARY = {
  pendingCount: 0,
  awaitingDecisionCount: 0,
  approvedTodayCount: 0,
  slaCriticalCount: 0,
};

const WORKFLOW_QUEUE_POLL_MS = 25_000;

export default function WorkflowApprovalShell() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshKey, refreshTickets, refreshTicketsSilent } = useTickets();
  const { showNotification } = useNotifications();
  const { workflows: workflowDefinitions, loading: workflowConfigLoading } = useWorkflowConfig();
  const permsCtx = usePermissionsOptional();
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [advancingWorkflow, setAdvancingWorkflow] = useState(false);
  const [cancelingWorkflow, setCancelingWorkflow] = useState(false);
  const [demoRevision, setDemoRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);

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
  const queueView = searchParams.get('view');
  const normalizedQueueView = queueView === 'finalizados' ? 'finalizados' : queueView === 'respondidos' ? 'respondidos' : null;

  useEffect(() => {
    const onDemoChange = () => setDemoRevision((v) => v + 1);
    window.addEventListener('velodesk:workflow-demo-changed', onDemoChange);
    return () => window.removeEventListener('velodesk:workflow-demo-changed', onDemoChange);
  }, []);

  // Atualiza fila local sem spinner: polling + Realtime (fallback confiável = intervalo).
  useEffect(() => {
    if (!hasWorkflowAccess) return undefined;

    let inFlight = false;
    const syncQueue = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        await refreshTicketsSilent();
        setDetailRevision((v) => v + 1);
      } finally {
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncQueue();
    };

    void syncQueue();
    const timer = window.setInterval(syncQueue, WORKFLOW_QUEUE_POLL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const unsubscribe = subscribeToTicketEvents((payload) => {
      if (payload?.type === 'workflow' || !payload?.type) {
        void syncQueue();
      }
    });

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribe();
    };
  }, [hasWorkflowAccess, refreshTicketsSilent]);

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
      ? computeWorkflowTeamQueue(teamQueueId, {
        view: normalizedQueueView,
      })
      : computeWorkflowAssigneeQueue();
    deskLog.workflow('fila calculada', {
      teamQueueId,
      queueView: normalizedQueueView,
      pending: data.summary?.pendingCount,
      fila: data.queue?.length,
    });
    return data;
  }, [hasWorkflowAccess, teamQueueId, normalizedQueueView, refreshKey, demoRevision, workflowDefinitions, workflowConfigLoading]);

  const detail = useMemo(
    () => (selectedId && hasWorkflowAccess ? getWorkflowApprovalDetail(selectedId, teamQueueId) : null),
    [selectedId, teamQueueId, hasWorkflowAccess, refreshKey, demoRevision, detailRevision],
  );

  const selectedTicket = useMemo(
    () => (selectedId ? findTicketEntry(selectedId)?.ticket : null),
    [selectedId, refreshKey, detailRevision],
  );

  const workflowProgress = selectedTicket ? getWorkflowProgress(selectedTicket) : null;

  const canManageWorkflow = useMemo(
    () => Boolean(
      selectedTicket
      && isTicketWorkflowActive(selectedTicket)
      && canInterruptWorkflow(permsCtx?.permissions),
    ),
    [selectedTicket, permsCtx?.permissions],
  );

  const canAdvanceWorkflow = useMemo(() => {
    if (!selectedTicket || !isTicketWorkflowActive(selectedTicket)) return false;
    if (selectedTicket?.workflow?.pendingPersist) return false;
    if (!workflowProgress || workflowProgress.workflow?.status === 'completed' || workflowProgress.workflow?.status === 'cancelled') return false;
    const step = workflowProgress.activeStep;
    if (!step) return false;
    if (step.acao?.tipo === 'automatica' || step.atribuicao?.tipo === 'sistema') {
      return resolveAutomaticaConfig(step)?.modo === 'call_to_action';
    }
    if (step.acao?.tipo === 'aprovacao') return false;
    return true;
  }, [selectedTicket, workflowProgress]);

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
    const urlId = fromUrl ? String(fromUrl) : null;

    if (!queueData.queue.length) {
      if (urlId && teamQueueId) {
        const entry = findTicketEntry(urlId);
        if (entry?.ticket && ticketMatchesWorkflowTeam(entry.ticket, teamQueueId)) {
          setSelectedId(urlId);
          return;
        }
      }
      setSelectedId(null);
      return;
    }

    if (urlId && queueData.queue.some((q) => q.id === urlId)) {
      setSelectedId(urlId);
      return;
    }

    if (urlId && teamQueueId) {
      const entry = findTicketEntry(urlId);
      if (entry?.ticket && ticketMatchesWorkflowTeam(entry.ticket, teamQueueId)) {
        setSelectedId(urlId);
        return;
      }
      if (entry?.ticket && !ticketMatchesWorkflowTeam(entry.ticket, teamQueueId)) {
        const otherTeamId = resolveWorkflowTeamForTicket(entry.ticket);
        const otherTeamMeta = otherTeamId ? getWorkflowTeamQueueMeta(otherTeamId) : null;
        const myTeamMeta = getWorkflowTeamQueueMeta(teamQueueId);
        showNotification(
          otherTeamMeta
            ? `Este ticket pertence à fila ${otherTeamMeta.name}, não à fila ${myTeamMeta?.name || teamQueueId}.`
            : `Este ticket não pertence à fila ${myTeamMeta?.name || teamQueueId}.`,
          'warning',
        );
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('ticket');
          return next;
        }, { replace: true });
      }
    }

    const fallbackId = queueData.queue[0].id;
    setSelectedId(fallbackId);
    if (urlId !== fallbackId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('ticket', fallbackId);
        return next;
      }, { replace: true });
    }
  }, [queueData.queue, searchParams, setSearchParams, teamQueueId, showNotification]);

  const handleSelectTicket = useCallback((ticketId) => {
    const id = String(ticketId);
    setSelectedId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('ticket', id);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleSearchOpenDesk = useCallback((ticketId) => {
    const id = String(ticketId);
    if (typeof window.openTicket === 'function') {
      window.openTicket(id);
      return;
    }
    navigate(`/tickets?desk=v2&ticket=${id}`);
  }, [navigate]);

  const runAction = useCallback(async (actionFn, successMsg, args = []) => {
    if (!selectedId || busy) return { ok: false, result: null };
    setBusy(true);
    try {
      const result = await actionFn(selectedId, ...args);
      await refreshTickets();
      setDetailRevision((v) => v + 1);
      showNotification(successMsg, 'success');
      return { ok: true, result };
    } catch (err) {
      deskLog.error('WORKFLOW', 'ação falhou', {
        ticketId: selectedId,
        message: err?.response?.data?.message || err?.message,
      });
      showNotification(err?.response?.data?.message || 'Não foi possível concluir a ação.', 'error');
      try {
        await refreshTicketsSilent();
        setDetailRevision((v) => v + 1);
      } catch {
        // ignora falha de sync pós-erro
      }
      return { ok: false, result: null };
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, refreshTicketsSilent, selectedId, showNotification]);

  const handleApprove = useCallback(
    (options) => runAction(
      approveWorkflowDecision,
      'Solicitação aprovada e workflow avançado.',
      options ? [options] : [],
    ),
    [runAction],
  );

  const handleFeito = useCallback(async () => {
    const { ok } = await runAction(
      approveWorkflowDecision,
      'Solicitação finalizada — cliente notificado e ticket movido para Resolvido.',
      [{ finalizeProdutos: true }],
    );
    if (!ok) return;
    // Feito só remove o ticket da fila atual — sem redirecionar para a view "Finalizados".
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('ticket');
      return next;
    }, { replace: true });
  }, [runAction, setSearchParams]);

  const handleReject = useCallback(async () => {
    const ticket = selectedId ? findTicketEntry(selectedId)?.ticket : null;
    if (!isTicketClosedByAgent(ticket)) {
      const ultimaOrigem = resolveComunicacaoResumo(ticket)?.ultimaOrigem;
      if (ultimaOrigem !== 'workflow') {
        showNotification(
          'Envie uma comunicação ao responsável do ticket antes de reprovar.',
          'warning',
        );
        return;
      }
    }

    const { ok, result } = await runAction(rejectWorkflowDecision, 'Solicitação reprovada.');
    if (!ok) return;
    const finalized = isWorkflowTicketCompleted(result);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (finalized) {
        next.set('view', 'finalizados');
      }
      next.delete('ticket');
      return next;
    }, { replace: true });
  }, [runAction, setSearchParams, selectedId, showNotification]);

  const handleRequestInfoSubmit = useCallback(async (message) => {
    if (!selectedId || busy) return null;
    if (selectedTicket && !isTicketWorkflowActive(selectedTicket)) return null;
    setBusy(true);
    try {
      const updated = await requestWorkflowInfo(selectedId, message, 'workflow');
      setDetailRevision((v) => v + 1);
      showNotification('Mensagem enviada ao responsável.', 'success');
      void refreshTickets();
      return updated;
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível enviar a mensagem.', 'error');
      throw err;
    } finally {
      setBusy(false);
    }
  }, [busy, refreshTickets, selectedId, selectedTicket, showNotification]);

  const handleAdvanceWorkflow = useCallback(async () => {
    if (!selectedId || advancingWorkflow) return;
    setAdvancingWorkflow(true);
    try {
      await ticketsApi.advanceWorkflow(selectedId, {});
      await refreshTickets();
      setDetailRevision((v) => v + 1);
      showNotification('Workflow avançado.', 'success');
    } catch (err) {
      showNotification(
        err?.response?.data?.message || 'Não foi possível avançar o workflow.',
        'warning',
      );
    } finally {
      setAdvancingWorkflow(false);
    }
  }, [advancingWorkflow, refreshTickets, selectedId, showNotification]);

  const handleCancelWorkflow = useCallback(async () => {
    if (!selectedId || cancelingWorkflow) return;
    setCancelingWorkflow(true);
    try {
      const updated = await ticketsApi.cancelWorkflow(selectedId, {});
      void updated;
      await refreshTickets();
      setDetailRevision((v) => v + 1);
      showNotification('Workflow interrompido.', 'success');
    } catch (err) {
      showNotification(
        err?.response?.data?.message || 'Não foi possível interromper o workflow.',
        'warning',
      );
    } finally {
      setCancelingWorkflow(false);
    }
  }, [cancelingWorkflow, refreshTickets, selectedId, showNotification]);

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
        onSelect={handleSelectTicket}
        teamQueueId={teamQueueId}
        onSearchOpenWorkflow={handleSelectTicket}
        onSearchOpenDesk={handleSearchOpenDesk}
      />
      <WorkflowApprovalDetail
        detail={detail}
        teamId={teamQueueId}
        busy={busy}
        onApprove={handleApprove}
        onFeito={handleFeito}
        onReject={handleReject}
        onRequestInfoSubmit={handleRequestInfoSubmit}
        canManageWorkflow={canManageWorkflow}
        canAdvanceWorkflow={canAdvanceWorkflow}
        onAdvanceWorkflow={handleAdvanceWorkflow}
        onCancelWorkflow={handleCancelWorkflow}
        advancingWorkflow={advancingWorkflow}
        cancelingWorkflow={cancelingWorkflow}
      />
    </div>
  );
}
