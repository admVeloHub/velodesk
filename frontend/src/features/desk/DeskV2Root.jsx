/**
 * Desk CRM — raiz 5 colunas (layout referência)
 * VERSION: v3.28.4 | DATE: 2026-08-10
 * — waChatId com DDI 55 (toWhatsAppChatIdDigits)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filterTickets,
  resolveDeskSearchEntries,
  resolveDeskSearchEntriesAsync,
  pickNextTicketFromEntries,
  resolveDeskWorkingEntries,
  countByQueue,
  getEntryTicketId,
  isDeskTableQueue,
  isMeusTicketsQueue,
  buildRegistroThread,
  buildWhatsAppConvMsgs,
  getWhatsAppDeskUiState,
  normalizeTicketForDeskV2,
  getAgentName,
  applySendStatus,
  normalizeCpf,
  isValidEmailFormat,
  getTicketProtocolLabel,
  isTicketInWorkflow,
  isTicketWorkflowActive,
  injectWorkflowSystemMessage,
  getWorkflowProgress,
  syncTicketWorkflowOnCommit,
  getTicketStatusBadgeMeta,
  isTicketReadOnly,
  getDeskSearchNotFoundMessage,
  getDeskSearchSuccessMessage,
  isFusaoAbsorvido,
  isClientIdentifiedForWorkflow,
  toWhatsAppChatIdDigits,
} from '../../services/desk/utils';
import { fundirTickets } from '../../services/desk/ticketFusaoService';
import {
  applyPendingWorkflowStartToTicket,
  discardPendingWorkflowStart,
  flushPendingWorkflowOnSave,
  hasPendingWorkflowPersist,
  mergeApiTicketPreservingPendingWorkflow,
  resolveTicketSnapshotForWorkflowFlush,
} from '../../services/desk/pendingWorkflowStart';
import { wrapComposerOpeningForTicket } from '../../services/desk/clientMessageEnvelope';
import {
  findTicketEntry,
  commitTicketViaApi,
  updateTicketInCache,
  loadTicketDetailFromApi,
  sendWhatsAppMessageViaApi,
} from '../../services/ticketsStorage';
import { isDraftTicket, persistDraftTicket } from '../../services/ticketsCache';
import { apiTicketToCockpit, cockpitTicketToApi } from '../../api/adapters/ticketAdapter';
import { lookupClient } from '../../services/clientDb';
import { clientsApi, colaboradoresApi, ticketsApi } from '../../api/client';
import { persistClienteContact } from '../../api/adapters/clienteAdapter';
import { useTickets } from '../../context/TicketsContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { usePermissionsOptional } from '../../context/PermissionContext';
import {
  canAdvanceWorkflowStep,
  canInterruptWorkflow,
  canSendInternalNoteOnTicket,
  canSendPublicMessageOnTicket,
} from '../../services/permissions/permissionService';
import { getAllQueueStatuses, fetchAndHydrateCustomQueues } from '../../services/desk/customQueueBoxes';
import { refreshQueueCountsFromApi } from '../../services/desk/queueCounts';
import CreateTicketPanel from './components/CreateTicketPanel';
import DeskQueuePanel from './components/DeskQueuePanel';
import DeskTicketList from './components/DeskTicketList';
import DeskResolvedTicketTable from './components/DeskResolvedTicketTable';
import DeskMyTicketsTable from './components/DeskMyTicketsTable';
import DeskTicketTabsBar from './components/DeskTicketTabsBar';
import DeskClientProfileBar from './components/DeskClientProfileBar';
import ClientTicketHistoryModal from './components/ClientTicketHistoryModal';
import TicketFusaoStatusControls from './components/TicketFusaoStatusControls';
import DeskConversation from './components/DeskConversation';
import TicketWorkflowInfoRequestCallout from './components/TicketWorkflowInfoRequestCallout';
import { markWorkflowInfoRequestsReadForTicket } from '../../services/workflow/workflowInfoNotifications';
import DeskWhatsAppChat from './components/DeskWhatsAppChat';
import DeskComposePanel from './components/DeskComposePanel';
import DeskInternalNotesPanel from './components/DeskInternalNotesPanel';
import DeskEventsPanel from './components/DeskEventsPanel';
import DeskConsultasPanel from './components/DeskConsultasPanel';
import DeskRightPanel from './components/DeskRightPanel';
import { applyCascadeFieldChange, applyTabulationSuggestion, buildDefaultRightFields, getMotivos, hasApplyableTabulation, isTabulationComplete, mergeRightFieldsWithDefaults, parseTabulationDisplay, sanitizeResponsavel, validateTabulationForSendStatus } from '../../services/tabulationConfig';
import { useTabulation } from '../../context/TabulationContext';
import { useWorkflowConfig } from '../../context/WorkflowConfigContext';
import { createSpellContext, loadSpellEngine, scanText } from '../../services/spellcheck/spellEngine';
import { htmlToPlainText } from '../../services/desk/composeRichEditor';
import { useTicketAiSuggestions } from '../../hooks/useTicketAiSuggestions';
import DeskAiRevisionModal from './components/DeskAiRevisionModal';
import { resolveAutomaticaConfig } from '../config/workflow/workflowConfigData';
import { resolveWorkflowForTicket } from '../../services/desk/workflowEngine';
import { getRuntimeWorkflows } from '../../services/desk/workflowRuntimeStore';
import { resolveRequisicaoCamposVisiveis } from '../../services/workflow/workflowRequisicao';
import { getAutoCloseOnSave } from '../../services/desk/agentDeskPreferences';
import { parseDeskQueueFromUrl, parseDeskMyTicketsSectionFromUrl } from '../../services/desk/constants';
import ProdutosForwardPopover from './components/ProdutosForwardPopover';
import WorkflowComunicacaoModal from '../workflow/components/WorkflowComunicacaoModal';
import { replyWorkflowComunicacao } from '../../services/workflow/workflowDecisionHandlers';
import deskPlatformTrace, { createPlatformTraceCounter } from '../../utils/deskPlatformTrace';
import { hasPublicThreadChanged } from '../../services/desk/ticketThreadSync';
import { hasAtendimentoFuncao } from '../../services/desk/atuacaoVision';

/** Respostas de cliente chegam por e-mail a qualquer momento: a thread se atualiza sozinha */
const AUTO_REFRESH_DETAIL_MS = 15000;
const AUTO_REFRESH_QUEUES_MS = 60000;

const WORKFLOW_REQUIRES_CLIENT_MESSAGE = 'Identifique o cliente (CPF válido) antes de iniciar o workflow.';

function ticketNeedsDetailLoad(ticket) {
  if (!ticket) return true;
  if (ticket.listOnly === true) return true;
  if (!ticket._detailLoaded) return true;
  const hasContent = (ticket.messages?.length || 0) > 0
    || (ticket.internalNotes?.length || 0) > 0
    || (ticket.registroHistorico?.length || 0) > 0;
  // Sem thread no cache — buscar detalhe (ticket "novo" no servidor pode já ter msg do cliente)
  return !hasContent;
}

const agentDebugMsgCount = createPlatformTraceCounter();

function applyRightFieldsToTicket(t, rightFields) {
  const prevLf = t.lateralForm || {};
  const tipo = String(
    rightFields.tipo || prevLf.classificacaoTipo || prevLf.tipoChamado || 'Solicitação'
  ).trim() || 'Solicitação';
  const responsavel = sanitizeResponsavel(rightFields.responsavel)
    || sanitizeResponsavel(prevLf.responsavel);
  t.lateralForm = {
    ...prevLf,
    classificacaoTipo: tipo,
    tipoChamado: tipo,
    produto: rightFields.produto || prevLf.produto,
    motivo: rightFields.motivo || prevLf.motivo,
    detalhe: rightFields.detalhe || prevLf.detalhe,
    canal: rightFields.canal || prevLf.canal,
    responsavel,
    workflow: prevLf.workflow,
  };
  t.responsibleAgent = responsavel;
  t.channel = rightFields.canal;
  t.updatedAt = new Date().toISOString();
  return t;
}

function buildDefaultSessionFromTicket(ticket, config) {
  const lf = ticket.lateralForm || {};
  return {
    mainTab: 'conversa',
    composeMode: 'public',
    composeText: '',
    internalText: '',
    composeAttachments: [],
    sendStatus: 'em-andamento',
    rightFields: buildDefaultRightFields(config, ticket, getAgentName),
    waChatOpen: false,
    spellIgnoredWords: [],
  };
}

export default function DeskV2Root() {
  const {
    refreshKey,
    refreshTickets,
    refreshTicketsSilent,
    loading: ticketsLoading,
    openTabs,
    activeTabId,
    openTicket,
    closeTicketTab,
    replaceOpenTabId,
    setActiveTabId,
    patchTicket,
  } = useTickets();
  const { showNotification } = useNotifications();
  const { user } = useAuth();
  const permsCtx = usePermissionsOptional();
  const { config } = useTabulation();
  const { workflows: runtimeWorkflows } = useWorkflowConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const detailLoadRef = useRef(null);
  const [activeQueue, setActiveQueue] = useState(() => parseDeskQueueFromUrl(searchParams.get('queue')));
  const [activeSort, setActiveSort] = useState('data');
  const [entrySortOldestFirst, setEntrySortOldestFirst] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [queueCollapsed, setQueueCollapsed] = useState(() => localStorage.getItem('velodeskCrmQueueCollapsed') === '1');
  const [listCollapsed, setListCollapsed] = useState(() => localStorage.getItem('velodeskCrmTicketListCollapsed') === '1');
  const [createOpen, setCreateOpen] = useState(false);
  const [mainTab, setMainTab] = useState('conversa');
  const [composeMode, setComposeMode] = useState('public');
  const [composeText, setComposeText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [sendStatus, setSendStatus] = useState('em-andamento');
  const [rightFields, setRightFields] = useState({});
  const [waChatOpen, setWaChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [aiRevisionOpen, setAiRevisionOpen] = useState(false);
  const [aiRevisionSubmitting, setAiRevisionSubmitting] = useState(false);
  const [composeSpellErrors, setComposeSpellErrors] = useState([]);
  const [spellIgnoredWords, setSpellIgnoredWords] = useState(() => new Set());
  const [queueStatuses, setQueueStatuses] = useState(() => getAllQueueStatuses());
  const suppressAutoSelectRef = useRef(true);
  const pendingAdvanceTicketIdRef = useRef(null);
  const [tableQueueBrowsing, setTableQueueBrowsing] = useState(false);
  const tabSessionsRef = useRef({});
  const prevActiveTabIdRef = useRef(null);
  const [colaboradorAtuacao, setColaboradorAtuacao] = useState([]);
  const [advancingWorkflow, setAdvancingWorkflow] = useState(false);
  const [cancelingWorkflow, setCancelingWorkflow] = useState(false);
  const [startingWorkflow, setStartingWorkflow] = useState(false);
  const [workflowStartModalOpen, setWorkflowStartModalOpen] = useState(false);
  const [comunicacaoModalOpen, setComunicacaoModalOpen] = useState(false);
  const [comunicacaoBusy, setComunicacaoBusy] = useState(false);
  const [workflowStartTemplate, setWorkflowStartTemplate] = useState(null);
  const pendingWorkflowTemplateRef = useRef(null);
  const commitInProgressRef = useRef(false);
  const waSendInProgressRef = useRef(false);
  const [waSendInProgress, setWaSendInProgress] = useState(false);
  const openedTicketFromUrlRef = useRef(null);

  const syncUrlTicketParam = useCallback((ticketId) => {
    const id = ticketId ? String(ticketId).trim() : '';
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('ticket', id);
      else next.delete('ticket');
      return next;
    }, { replace: true });
    openedTicketFromUrlRef.current = id || null;
  }, [setSearchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get('queue');
    if (!fromUrl) return;
    const queue = parseDeskQueueFromUrl(fromUrl);
    suppressAutoSelectRef.current = true;
    setActiveQueue((current) => (current === queue ? current : queue));
    setTableQueueBrowsing(isDeskTableQueue(queue));
  }, [searchParams]);

  useEffect(() => {
    const ticketId = String(searchParams.get('ticket') || '').trim();
    if (!ticketId) {
      openedTicketFromUrlRef.current = null;
      return undefined;
    }
    if (openedTicketFromUrlRef.current === ticketId) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      let entry = findTicketEntry(ticketId);
      if (!entry) {
        try {
          await loadTicketDetailFromApi(ticketId);
          entry = findTicketEntry(ticketId);
        } catch {
          if (!cancelled) {
            showNotification('Não foi possível abrir o ticket — recarregue a lista.', 'warning');
          }
          return;
        }
      }
      if (cancelled || !entry) return;
      openedTicketFromUrlRef.current = ticketId;
      suppressAutoSelectRef.current = true;
      setTableQueueBrowsing(false);
      openTicket(ticketId);
    })();

    return () => { cancelled = true; };
  }, [searchParams, refreshKey, openTicket, showNotification]);

  useEffect(() => {
    if (!user?.email) {
      setColaboradorAtuacao([]);
      return undefined;
    }
    let cancelled = false;
    colaboradoresApi.byEmail(user.email)
      .then((data) => {
        if (!cancelled) setColaboradorAtuacao(data?.atuacao || []);
      })
      .catch(() => {
        if (!cancelled) setColaboradorAtuacao([]);
      });
    return () => { cancelled = true; };
  }, [user?.email]);

  const syncTicketViews = useCallback(async () => {
    await Promise.all([
      refreshTickets().catch(() => {}),
      refreshQueueCountsFromApi(user?.email).catch(() => {}),
    ]);
    await fetchAndHydrateCustomQueues().catch(() => {});
    setQueueStatuses(getAllQueueStatuses());
  }, [refreshTickets, user?.email]);

  const reload = useCallback(async () => {
    try {
      await syncTicketViews();
      showNotification('Tickets atualizados.', 'success');
    } catch {
      showNotification('Não foi possível atualizar os tickets.', 'error');
    }
  }, [syncTicketViews, showNotification]);

  const entries = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst);
  const isTableQueueView = isDeskTableQueue(activeQueue);
  const isResolvedQueue = activeQueue === 'resolvidos';
  const isMyTicketsQueue = isMeusTicketsQueue(activeQueue);
  const myTicketsExpandedSection = parseDeskMyTicketsSectionFromUrl(searchParams.get('section'));
  const entry = activeTabId ? findTicketEntry(activeTabId) : null;
  const ticket = entry?.ticket;
  const ticketReadOnly = isTicketReadOnly(ticket);
  const ticketStatus = getTicketStatusBadgeMeta(ticket, entry?.queueId || 'em-andamento');
  const client = ticket ? lookupClient(ticket.lateralForm?.cpf || ticket.clientCPF) : null;

  const persistTabSession = useCallback((ticketId) => {
    if (!ticketId) return;
    tabSessionsRef.current[String(ticketId)] = {
      mainTab,
      composeMode,
      composeText,
      internalText,
      composeAttachments,
      sendStatus,
      rightFields,
      waChatOpen,
      spellIgnoredWords: Array.from(spellIgnoredWords),
    };
  }, [mainTab, composeMode, composeText, internalText, composeAttachments, sendStatus, rightFields, waChatOpen, spellIgnoredWords]);

  const restoreTabSession = useCallback((ticketId) => {
    const ticketEntry = findTicketEntry(ticketId);
    if (!ticketEntry) return;
    const t = ticketEntry.ticket;
    normalizeTicketForDeskV2(t);
    const defaults = buildDefaultSessionFromTicket(t, config);
    const saved = tabSessionsRef.current[String(ticketId)];
    const hasSavedProduto = Boolean((t.lateralForm?.produto || '').trim());
    const session = saved || defaults;
    const nextRightFields = mergeRightFieldsWithDefaults(
      hasSavedProduto && saved?.rightFields ? saved.rightFields : defaults.rightFields,
      t,
      getAgentName,
    );
    setMainTab(session.mainTab ?? defaults.mainTab);
    setComposeMode(session.composeMode ?? defaults.composeMode);
    setComposeText(session.composeText ?? defaults.composeText);
    setInternalText(session.internalText ?? defaults.internalText);
    setComposeAttachments(Array.isArray(session.composeAttachments) ? session.composeAttachments : defaults.composeAttachments);
    setSendStatus(session.sendStatus ?? defaults.sendStatus);
    setRightFields(nextRightFields);
    setWaChatOpen(session.waChatOpen ?? defaults.waChatOpen);
    setSpellIgnoredWords(new Set(session.spellIgnoredWords ?? defaults.spellIgnoredWords ?? []));
    setComposeSpellErrors([]);
  }, [config]);

  const sendDisabledBySpell = composeMode === 'public' && composeSpellErrors.length > 0;

  useEffect(() => {
    let cancelled = false;
    void fetchAndHydrateCustomQueues().then(() => {
      if (!cancelled) setQueueStatuses(getAllQueueStatuses());
    });
    return () => { cancelled = true; };
  }, [user?.email]);

  useEffect(() => {
    loadSpellEngine().catch(() => {});
  }, []);

  useEffect(() => {
    const openCreate = () => setCreateOpen(true);
    const closeCreate = () => setCreateOpen(false);
    const onRefreshTickets = () => { reload(); };
    const onWorkflowInfoChanged = () => { syncTicketViews(); };
    window.addEventListener('velodesk:quick-register', openCreate);
    window.addEventListener('velodesk:quick-register-close', closeCreate);
    window.addEventListener('velodesk:refresh-tickets', onRefreshTickets);
    window.addEventListener('velodesk:workflow-info-changed', onWorkflowInfoChanged);
    return () => {
      window.removeEventListener('velodesk:quick-register', openCreate);
      window.removeEventListener('velodesk:quick-register-close', closeCreate);
      window.removeEventListener('velodesk:refresh-tickets', onRefreshTickets);
      window.removeEventListener('velodesk:workflow-info-changed', onWorkflowInfoChanged);
    };
  }, [reload, syncTicketViews]);

  useEffect(() => {
    if (!ticket) return;
    markWorkflowInfoRequestsReadForTicket(ticket);
  }, [ticket?.id]);

  useEffect(() => {
    if (!activeTabId || isDraftTicket({ id: activeTabId })) {
      return undefined;
    }
    const entry = findTicketEntry(activeTabId);
    const current = entry?.ticket;
    if (!ticketNeedsDetailLoad(current)) {
      return undefined;
    }

    let cancelled = false;
    const ticketId = String(activeTabId);
    detailLoadRef.current = ticketId;

    loadTicketDetailFromApi(ticketId)
      .then((full) => {
        if (cancelled || detailLoadRef.current !== ticketId) return;
        const entry = findTicketEntry(ticketId);
        const merged = entry?.ticket
          ? mergeApiTicketPreservingPendingWorkflow(entry.ticket, full)
          : full;
        patchTicket(ticketId, merged);
      })
      .catch(() => {
        if (!cancelled && detailLoadRef.current === ticketId) {
          showNotification('Não foi possível carregar o ticket completo.', 'warning');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTabId, refreshKey, patchTicket, showNotification]);

  // Ticket aberto: recarrega o detalhe em ciclo curto para trazer resposta do cliente sem ação do agente
  useEffect(() => {
    if (!activeTabId || isDraftTicket({ id: activeTabId })) {
      return undefined;
    }

    const ticketId = String(activeTabId);
    let cancelled = false;
    let inFlight = false;

    const syncDetail = async () => {
      if (cancelled || inFlight) return;
      if (document.hidden) return;
      if (commitInProgressRef.current) return;
      inFlight = true;
      try {
        const raw = await ticketsApi.get(ticketId);
        if (raw?.listOnly === true) return;
        const full = apiTicketToCockpit(raw);
        if (!full?.id && !full?._id) return;
        full.listOnly = false;
        full._detailLoaded = true;

        const prevEntry = findTicketEntry(ticketId);
        const prevTicket = prevEntry?.ticket;
        const merged = prevTicket
          ? mergeApiTicketPreservingPendingWorkflow(prevTicket, full)
          : full;
        const threadChanged = hasPublicThreadChanged(prevTicket, merged);
        const detailFilled = ticketNeedsDetailLoad(prevTicket) && !ticketNeedsDetailLoad(merged);

        if (threadChanged || detailFilled) {
          const msgs = merged?.messages?.length ?? 0;
          const prevMsgs = prevTicket?.messages?.length;
          const last = merged?.messages?.[msgs - 1];
          deskPlatformTrace('auto-refresh', 'poll:msgs-mudou', {
            ticketId,
            de: prevMsgs ?? null,
            para: msgs,
            ultimaOrigem: last?.origin || last?.sender || null,
            detailFilled,
            patch: !cancelled && !commitInProgressRef.current,
          });
        }

        if (!cancelled && !commitInProgressRef.current && (threadChanged || detailFilled)) {
          patchTicket(ticketId, merged);
        }
      } catch (err) {
        deskPlatformTrace('auto-refresh', 'poll:erro', { ticketId, message: String(err?.message || err) }, 'warn');
        /* rede instável não deve interromper o atendimento */
      } finally {
        inFlight = false;
      }
    };

    const entry = findTicketEntry(ticketId);
    if (ticketNeedsDetailLoad(entry?.ticket)) {
      void syncDetail();
    }

    const timer = window.setInterval(syncDetail, AUTO_REFRESH_DETAIL_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) void syncDetail();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeTabId, patchTicket]);

  // Filas: ciclo longo e silencioso para novos tickets aparecerem sem recarregar a página
  useEffect(() => {
    let inFlight = false;

    const syncQueues = async () => {
      if (inFlight || document.hidden || commitInProgressRef.current) return;
      inFlight = true;
      try {
        await refreshTicketsSilent();
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(syncQueues, AUTO_REFRESH_QUEUES_MS);
    return () => window.clearInterval(timer);
  }, [refreshTicketsSilent]);

  useEffect(() => {
    if (pendingAdvanceTicketIdRef.current) return;
    if (tableQueueBrowsing) return;
    if (suppressAutoSelectRef.current && !activeTabId) return;
    if (openTabs.length === 0) return;
    if (activeTabId && findTicketEntry(activeTabId)) return;
    const last = openTabs[openTabs.length - 1];
    if (last) setActiveTabId(last.id);
  }, [activeTabId, refreshKey, entries.length, openTabs, setActiveTabId, tableQueueBrowsing]);

  useEffect(() => {
    if (!activeTabId) {
      prevActiveTabIdRef.current = null;
      return;
    }
    if (String(prevActiveTabIdRef.current) === String(activeTabId)) return;
    prevActiveTabIdRef.current = activeTabId;
    restoreTabSession(activeTabId);
  }, [activeTabId, restoreTabSession]);

  useEffect(() => {
    if (!activeTabId || !config?.produtos?.length) return;
    const entry = findTicketEntry(activeTabId);
    if (!entry) return;
    const lf = entry.ticket?.lateralForm || {};
    setRightFields((prev) => {
      if (!(lf.produto || '').trim()) {
        const defaults = buildDefaultRightFields(config, entry.ticket, getAgentName);
        const hasLocalTabulation = Boolean(prev.produto || prev.motivo || prev.detalhe);
        if (hasLocalTabulation) {
          return mergeRightFieldsWithDefaults(prev, entry.ticket, getAgentName);
        }
        if (
          prev.responsavel === defaults.responsavel
          && prev.canal === defaults.canal
          && prev.tipo === defaults.tipo
          && !prev.produto
          && !prev.motivo
          && !prev.detalhe
        ) {
          return prev;
        }
        return defaults;
      }
      if (prev.produto === lf.produto && getMotivos(config, prev.produto).includes(prev.motivo || '')) {
        return mergeRightFieldsWithDefaults(prev, entry.ticket, getAgentName);
      }
      return buildDefaultRightFields(config, entry.ticket, getAgentName);
    });
  }, [config, activeTabId]);

  const openMergedChildTicket = useCallback(async (childId) => {
    const id = String(childId || '').trim();
    if (!id) return;
    suppressAutoSelectRef.current = true;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    let entry = findTicketEntry(id);
    if (!entry) {
      try {
        await loadTicketDetailFromApi(id);
        entry = findTicketEntry(id);
      } catch {
        showNotification('Não foi possível abrir o ticket mesclado.', 'warning');
        return;
      }
    }
    if (!entry) {
      showNotification('Não foi possível abrir o ticket mesclado.', 'warning');
      return;
    }
    syncUrlTicketParam(id);
    openTicket(id);
  }, [activeTabId, openTicket, persistTabSession, showNotification, syncUrlTicketParam]);

  const selectTicket = (id) => {
    suppressAutoSelectRef.current = true;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    const entry = findTicketEntry(id);
    if (!entry) {
      showNotification('Não foi possível abrir o ticket — recarregue a lista.', 'warning');
      return;
    }
    if (isFusaoAbsorvido(entry.ticket)) {
      const parentId = entry.ticket?.fusao?.parentId;
      if (parentId) {
        showNotification('Ticket mesclado — abrindo o chamado ativo.', 'info');
        const parentEntry = findTicketEntry(parentId);
        if (parentEntry) {
          syncUrlTicketParam(parentId);
          openTicket(parentId);
          return;
        }
        (async () => {
          try {
            await loadTicketDetailFromApi(parentId);
            syncUrlTicketParam(parentId);
            openTicket(parentId);
          } catch {
            showNotification('Não foi possível abrir o ticket ativo da mesclagem.', 'warning');
          }
        })();
        return;
      }
      showNotification('Este ticket foi mesclado e não está mais disponível na fila.', 'warning');
      return;
    }
    syncUrlTicketParam(id);
    openTicket(id);
  };

  const activateTicketTab = (id) => {
    if (String(id) === String(activeTabId)) return;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    syncUrlTicketParam(id);
    setActiveTabId(id);
  };

  const closeTicketTabHandler = (id) => {
    if (String(id) === String(activeTabId)) {
      persistTabSession(activeTabId);
    }
    delete tabSessionsRef.current[String(id)];
    const isLastTab = openTabs.length === 1 && String(openTabs[0].id) === String(id);
    if (isLastTab) suppressAutoSelectRef.current = true;
    const remaining = openTabs.filter((tab) => String(tab.id) !== String(id));
    const nextActive = String(activeTabId) === String(id)
      ? (remaining.length ? remaining[remaining.length - 1].id : null)
      : activeTabId;
    closeTicketTab(id);
    syncUrlTicketParam(nextActive);
  };

  const handleFundirTickets = useCallback(async ({ activeId, inactiveIds, cpf }) => {
    if (!activeId || mergeInProgress) return;
    setMergeInProgress(true);
    try {
      await fundirTickets({ activeId, inactiveIds, cpf });
      await syncTicketViews();
      setHistoryOpen(false);
      selectTicket(activeId);
      setMainTab('notas');
      (inactiveIds || []).forEach((id) => {
        if (openTabs.some((tab) => String(tab.id) === String(id))) {
          closeTicketTabHandler(id);
        }
      });
      showNotification('Mesclagem registrada com sucesso.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível mesclar os tickets.';
      showNotification(msg, 'error');
      throw err;
    } finally {
      setMergeInProgress(false);
    }
  }, [
    mergeInProgress,
    syncTicketViews,
    selectTicket,
    openTabs,
    closeTicketTabHandler,
    showNotification,
  ]);

  const advanceAfterSaveIfEnabled = useCallback((savedTicketId, plannedNextId, listAnchorId = savedTicketId, force = false) => {
    if ((!force && !getAutoCloseOnSave()) || !savedTicketId) return;

    let nextId = plannedNextId;
    if (!nextId) {
      const freshList = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst);
      nextId = pickNextTicketFromEntries(listAnchorId, freshList);
    }

    if (String(savedTicketId) === String(activeTabId)) {
      persistTabSession(activeTabId);
    }
    delete tabSessionsRef.current[String(savedTicketId)];

    const willOpenNext = nextId && String(nextId) !== String(savedTicketId);
    suppressAutoSelectRef.current = !willOpenNext;
    closeTicketTab(savedTicketId);

    if (!willOpenNext) return;

    pendingAdvanceTicketIdRef.current = String(nextId);
    suppressAutoSelectRef.current = false;
    queueMicrotask(() => {
      setTableQueueBrowsing(false);
      openTicket(nextId);
      pendingAdvanceTicketIdRef.current = null;
    });
  }, [activeQueue, appliedSearch, activeSort, entrySortOldestFirst, openTicket, closeTicketTab, activeTabId, persistTabSession]);

  const selectMainTab = (tab) => {
    setMainTab(tab);
  };

  const selectQueue = (queueId) => {
    suppressAutoSelectRef.current = true;
    setActiveQueue(queueId);
    setSearchDraft('');
    setAppliedSearch('');
    localStorage.setItem('velodeskCrmTicketListCollapsed', '0');
    setListCollapsed(false);
    setTableQueueBrowsing(isDeskTableQueue(queueId));
  };

  const handleSearchChange = useCallback((value) => {
    const next = String(value ?? '');
    setSearchDraft(next);
    const trimmed = next.trim();
    setAppliedSearch(trimmed);
    if (trimmed) {
      setTableQueueBrowsing(false);
    }
  }, []);

  const handleSearchSubmit = async () => {
    const q = searchDraft.trim();
    setAppliedSearch(q);

    if (!q) {
      showNotification('Busca limpa. Exibindo fila atual.', 'info');
      return;
    }

    let results = resolveDeskSearchEntries(q, activeSort, entrySortOldestFirst);
    if (!results.length) {
      try {
        results = await resolveDeskSearchEntriesAsync(q, activeSort, entrySortOldestFirst);
      } catch {
        results = [];
      }
    }
    if (!results.length) {
      showNotification(getDeskSearchNotFoundMessage(q), 'warning');
      return;
    }

    suppressAutoSelectRef.current = false;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    openTicket(results[0].ticket.id);

    showNotification(getDeskSearchSuccessMessage(q, results.length), 'success');
  };

  const handleIgnoreSpellWord = useCallback((word) => {
    setSpellIgnoredWords((prev) => new Set([...prev, word]));
  }, []);

  const handleFlaggedErrorsChange = useCallback((errors) => {
    setComposeSpellErrors(errors || []);
  }, []);

  const handleQueueCollapse = (collapsed) => {
    localStorage.setItem('velodeskCrmQueueCollapsed', collapsed ? '1' : '0');
    setQueueCollapsed(collapsed);
  };

  const handleListCollapse = (collapsed) => {
    localStorage.setItem('velodeskCrmTicketListCollapsed', collapsed ? '1' : '0');
    setListCollapsed(collapsed);
  };

  const handleCommitWithStatus = async (statusId) => {
    if (!ticket || !entry || commitInProgressRef.current) return null;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não aceita modificações.', 'warning');
      return null;
    }
    commitInProgressRef.current = true;
    const status = statusId || sendStatus;
    const savedListTicketId = getEntryTicketId(entry);
    const workingListBeforeSave = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst);
    const plannedNextId = getAutoCloseOnSave()
      ? pickNextTicketFromEntries(savedListTicketId, workingListBeforeSave)
      : null;
    const messageHtml = String(composeText || '').trim();
    const internalNoteHtml = String(internalText || '').trim();
    const messageText = htmlToPlainText(messageHtml).trim();
    const internalNoteText = htmlToPlainText(internalNoteHtml).trim();
    const attachmentUrls = (composeAttachments || [])
      .map((item) => String(item?.url || '').trim())
      .filter(Boolean);
    const hasPublicPayload = Boolean(messageText || attachmentUrls.length);
    const messagePayload = messageHtml || '';
    const internalNotePayload = internalNoteHtml || '';

    const deskPerms = permsCtx?.permissions;
    if (hasPublicPayload && !canSendPublicMessageOnTicket(ticket, deskPerms)) {
      showNotification('Sem permissão para enviar mensagem pública neste ticket.', 'warning');
      commitInProgressRef.current = false;
      return null;
    }
    if (internalNoteText && !canSendInternalNoteOnTicket(ticket, deskPerms)) {
      showNotification('Sem permissão para comentar neste ticket.', 'warning');
      commitInProgressRef.current = false;
      return null;
    }
    if (!hasPublicPayload && !internalNoteText && !canSendPublicMessageOnTicket(ticket, deskPerms)) {
      showNotification('Sem permissão para alterar tabulação ou status deste ticket.', 'warning');
      commitInProgressRef.current = false;
      return null;
    }

    const tabulationCheck = validateTabulationForSendStatus(
      status,
      mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName),
      config,
    );
    if (!tabulationCheck.ok) {
      showNotification(tabulationCheck.message, 'warning');
      commitInProgressRef.current = false;
      return null;
    }

    if (messageText) {
      if (composeSpellErrors.length > 0) {
        showNotification(
          `Corrija ${composeSpellErrors.length} erro${composeSpellErrors.length > 1 ? 's' : ''} ortográfico${composeSpellErrors.length > 1 ? 's' : ''} antes de enviar.`,
          'warning',
        );
        commitInProgressRef.current = false;
        return null;
      }
      try {
        const spellCtx = createSpellContext(config, spellIgnoredWords);
        const errors = await scanText(messageText, spellCtx.whitelist, spellCtx.ignoredWords);
        if (errors.length > 0) {
          setComposeSpellErrors(errors);
          setComposeMode('public');
          showNotification(
            `Corrija ${errors.length} erro${errors.length > 1 ? 's' : ''} ortográfico${errors.length > 1 ? 's' : ''} antes de enviar.`,
            'warning',
          );
          commitInProgressRef.current = false;
          return null;
        }
      } catch {
        /* LT indisponível — modo degradado: não bloqueia envio */
      }
    }
    setComposeSpellErrors([]);

    try {
      if (isDraftTicket(ticket)) {
        const draftId = String(ticket.id);
        const session = tabSessionsRef.current[draftId];
        let prepared = applyRightFieldsToTicket(
          { ...ticket },
          mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName),
        );
        syncTicketWorkflowOnCommit(prepared);
        applySendStatus({ ticket: prepared, boxId: entry.boxId }, status);
        const regKey = Date.now();
        const ts = new Date().toISOString();
        const author = getAgentName();
        if (hasPublicPayload) {
          if (!prepared.messages) prepared.messages = [];
          prepared.messages.push({
            id: `${regKey}-pub`,
            type: 'agent',
            fromClient: false,
            origin: 'agente',
            text: messagePayload,
            attachments: attachmentUrls,
            timestamp: ts,
            author,
          });
        }
        if (internalNoteText) {
          if (!prepared.internalNotes) prepared.internalNotes = [];
          prepared.internalNotes.push({
            id: `${regKey}-int`,
            type: 'internal',
            origin: 'agente',
            text: internalNotePayload,
            timestamp: ts,
            author,
          });
        }
        const persisted = await persistDraftTicket(prepared, messageText || internalNoteText || attachmentUrls.length);
        const newId = persisted.id || persisted._id;
        const draftFlushTicket = hasPendingWorkflowPersist(prepared)
          ? { ...prepared, id: newId, _id: newId }
          : null;
        if (draftFlushTicket) {
          const flushResult = await flushPendingWorkflowOnSave(
            newId,
            draftFlushTicket,
            {
              ticketsApi,
              apiTicketToCockpit,
              patchTicket,
              injectWorkflowSystemMessage,
            },
          );
          if (flushResult.error) {
            showNotification(
              flushResult.error?.response?.data?.message
                || 'Ticket salvo, mas falhou ao ativar o workflow.',
              'warning',
            );
          }
        }
        delete tabSessionsRef.current[draftId];
        if (session) {
          tabSessionsRef.current[String(newId)] = {
            ...session,
            sendStatus: status,
            composeText: hasPublicPayload ? '' : session.composeText,
            internalText: internalNoteText ? '' : session.internalText,
            composeAttachments: hasPublicPayload ? [] : session.composeAttachments,
          };
        }
        replaceOpenTabId(draftId, newId, {
          title: persisted.title || ticket.title,
          clientName: persisted.clientName || ticket.clientName,
          ticketLabel: getTicketProtocolLabel(persisted) || 'Rascunho',
        });
        setSendStatus(status);
        if (hasPublicPayload) setComposeText('');
        if (internalNoteText) setInternalText('');
        if (hasPublicPayload) setComposeAttachments([]);
        showNotification(
          hasPublicPayload || internalNoteText ? 'Ticket enviado e salvo.' : 'Ticket salvo.',
          'success',
        );
        await syncTicketViews();
        advanceAfterSaveIfEnabled(newId, plannedNextId, draftId);
        return newId;
      }

      let prepared = applyRightFieldsToTicket(
        { ...ticket },
        mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName),
      );
      syncTicketWorkflowOnCommit(prepared);
      applySendStatus({ ticket: prepared, boxId: entry.boxId }, status);

      const ticketBeforeSave = findTicketEntry(ticket.id)?.ticket || ticket;
      const workflowFlushDeps = {
        ticketsApi,
        apiTicketToCockpit,
        patchTicket,
        injectWorkflowSystemMessage,
      };

      await commitTicketViaApi(ticket.id, {
        ...cockpitTicketToApi(prepared),
        text: messagePayload,
        internalText: internalNotePayload,
        author: getAgentName(),
        ...(attachmentUrls.length ? { attachments: attachmentUrls } : {}),
      });

      const entryAfterSave = findTicketEntry(ticket.id);
      const flushResult = await flushPendingWorkflowOnSave(
        ticket.id,
        resolveTicketSnapshotForWorkflowFlush(ticketBeforeSave, entryAfterSave?.ticket || ticket),
        workflowFlushDeps,
      );
      if (flushResult.error) {
        showNotification(
          flushResult.error?.response?.data?.message
            || 'Ticket salvo, mas falhou ao ativar o workflow.',
          'warning',
        );
      }

      setSendStatus(status);
      if (hasPublicPayload) setComposeText('');
      if (internalNoteText) setInternalText('');
      if (hasPublicPayload) setComposeAttachments([]);
      if (activeTabId) {
        const sessionKey = String(activeTabId);
        const session = tabSessionsRef.current[sessionKey];
        if (session) {
          tabSessionsRef.current[sessionKey] = {
            ...session,
            composeText: hasPublicPayload ? '' : session.composeText,
            internalText: internalNoteText ? '' : session.internalText,
            composeAttachments: hasPublicPayload ? [] : session.composeAttachments,
          };
        }
      }
      showNotification(
        hasPublicPayload || internalNoteText ? 'Ticket enviado e salvo.' : 'Ticket salvo.',
        'success',
      );
      await syncTicketViews();
      advanceAfterSaveIfEnabled(ticket.id, plannedNextId, savedListTicketId);
      return ticket.id;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar ticket.';
      showNotification(msg, 'error');
      return null;
    } finally {
      commitInProgressRef.current = false;
    }
  };

  const resolveWhatsAppChatId = () => toWhatsAppChatIdDigits(
    client?.whatsappPhone
    || ticket?.lateralForm?.clienteTelefoneWhatsapp
    || (Array.isArray(ticket?.lateralForm?.clienteTelefone) ? ticket.lateralForm.clienteTelefone[0] : '')
    || ticket?.clientPhone
    || '',
  );

  const runWhatsAppSend = async ({ text, initialTemplate = false }) => {
    if (!ticket || !entry || waSendInProgressRef.current || commitInProgressRef.current) return;

    const waChatId = resolveWhatsAppChatId();
    if (!waChatId) {
      showNotification('Cadastre o telefone WhatsApp do cliente antes de enviar.', 'warning');
      return;
    }

    waSendInProgressRef.current = true;
    setWaSendInProgress(true);
    try {
      const result = await sendWhatsAppMessageViaApi(ticket.id, {
        text,
        initialTemplate,
        waChatId: waChatId || undefined,
        author: getAgentName(),
      });

      if (result?.ticket) {
        patchTicket(ticket.id, result.ticket);
      }

      if (result?.twilio && !result.twilio.sent) {
        showNotification(
          result.twilio.reason || 'Mensagem salva no ticket, mas o Twilio não enviou ao celular.',
          'warning',
        );
      } else if (result?.twilio?.mode === 'template' || initialTemplate) {
        showNotification(
          'Mensagem inicial enviada via template. Aguarde a resposta do cliente.',
          'success',
        );
      } else if (result?.twilio?.sent) {
        showNotification('WhatsApp enviado.', 'success');
      }

      if (!initialTemplate) {
        setComposeText('');
      }
      setWaChatOpen(true);
      if (activeTabId) {
        const sessionKey = String(activeTabId);
        const session = tabSessionsRef.current[sessionKey];
        if (session) {
          tabSessionsRef.current[sessionKey] = {
            ...session,
            composeText: initialTemplate ? session.composeText : '',
            waChatOpen: true,
          };
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao enviar WhatsApp.';
      showNotification(msg, 'error');
    } finally {
      waSendInProgressRef.current = false;
      setWaSendInProgress(false);
    }
  };

  const handleSendWhatsAppMessage = async () => {
    if (!ticket || !entry || waSendInProgressRef.current || commitInProgressRef.current) return;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não aceita modificações.', 'warning');
      return;
    }
    if (isDraftTicket(ticket)) {
      showNotification(
        'Salve o ticket antes de enviar WhatsApp — rascunho só registra na tela, não envia ao celular.',
        'warning',
      );
      return;
    }

    const waUi = getWhatsAppDeskUiState(ticket);
    if (!waUi.composeEnabled) {
      showNotification('Envie a mensagem inicial ou aguarde a resposta do cliente.', 'warning');
      return;
    }

    const messageText = String(composeText || '').trim();
    if (!messageText) return;

    await runWhatsAppSend({ text: messageText });
  };

  const handleSendWhatsAppInitial = async () => {
    if (!ticket || !entry || waSendInProgressRef.current || commitInProgressRef.current) return;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não aceita modificações.', 'warning');
      return;
    }
    if (isDraftTicket(ticket)) {
      showNotification('Salve o ticket antes de enviar WhatsApp.', 'warning');
      return;
    }
    await runWhatsAppSend({ initialTemplate: true });
  };

  const handleFieldChange = (key, value) => {
    if (ticketReadOnly) return;
    setRightFields((f) => applyCascadeFieldChange(f, key, value));
  };

  const handleSaveContact = async (draft) => {
    if (!ticket) return;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não aceita modificações.', 'warning');
      throw new Error('Ticket fechado');
    }

    const nome = String(draft?.name || '').trim();
    const emailList = Array.isArray(draft?.emails)
      ? draft.emails.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const phoneList = Array.isArray(draft?.phones)
      ? draft.phones.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const whatsappPhone = String(draft?.whatsappPhone || '').trim()
      || (phoneList.length === 1 ? phoneList[0] : '');
    const replyEmail = String(draft?.replyEmail || '').trim()
      || (emailList.length === 1 ? emailList[0] : '');
    const cpf = normalizeCpf(
      draft?.cpf || ticket.lateralForm?.cpf || ticket.lateralForm?.clienteCpf || ticket.clientCPF,
    );

    if (!nome) {
      showNotification('Informe o nome do cliente.', 'error');
      throw new Error('Nome obrigatório');
    }
    for (const email of emailList) {
      if (!isValidEmailFormat(email)) {
        showNotification('Informe um e-mail válido (ex.: nome@dominio.com).', 'error');
        throw new Error('E-mail inválido');
      }
    }
    if (phoneList.length > 1 && !whatsappPhone) {
      showNotification('Selecione qual telefone será usado no WhatsApp.', 'error');
      throw new Error('WhatsApp obrigatório');
    }
    if (emailList.length > 1 && !replyEmail) {
      showNotification('Selecione qual e-mail será usado para responder ao cliente.', 'error');
      throw new Error('E-mail de resposta obrigatório');
    }

    try {
      const clienteDoc = await persistClienteContact(clientsApi, {
        cpf,
        nome,
        emails: emailList,
        phones: phoneList,
        whatsappPhone,
        replyEmail,
        clienteId: draft?.clienteId || ticket.clienteId || ticket.lateralForm?.clienteId,
      });
      const clienteId = clienteDoc?._id || clienteDoc?.id || ticket.clienteId || ticket.lateralForm?.clienteId;
      const primaryEmail = replyEmail || emailList[0] || '';
      const primaryPhone = whatsappPhone || phoneList[0] || '';

      const updated = await updateTicketInCache(ticket.id, (t) => {
        t.clientName = nome;
        t.solicitante = nome;
        t.clientEmail = primaryEmail;
        t.clientPhone = primaryPhone;
        if (clienteId) t.clienteId = clienteId;
        t.lateralForm = {
          ...t.lateralForm,
          cpf,
          clienteCpf: cpf,
          clienteNome: nome,
          clienteEmail: emailList,
          clienteEmailResposta: replyEmail,
          clienteTelefone: phoneList,
          clienteTelefoneWhatsapp: whatsappPhone,
          clienteId: clienteId || t.lateralForm?.clienteId,
        };
        t.updatedAt = new Date().toISOString();
        return t;
      });

      if (updated) {
        patchTicket(ticket.id, updated);
      }

      showNotification('Contato atualizado.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar contato.';
      showNotification(msg, 'error');
      throw err;
    }
  };

  const handleOpenChat = () => {
    setMainTab('conversa');
    setComposeMode('public');
    setWaChatOpen(true);
  };

  const handleCreateSaved = (id) => {
    persistTabSession(activeTabId);
    delete tabSessionsRef.current[String(id)];
    prevActiveTabIdRef.current = null;
    suppressAutoSelectRef.current = true;
    setTableQueueBrowsing(false);
    setCreateOpen(false);
    openTicket(id);
    setActiveQueue('novos');
    showNotification('Rascunho aberto — salve quando concluir o atendimento.', 'success');
  };

  const convMsgs = ticket ? buildRegistroThread(ticket) : [];
  const waConvMsgs = ticket ? buildWhatsAppConvMsgs(ticket) : [];
  const waUiState = ticket ? getWhatsAppDeskUiState(ticket) : null;
  const threadLen = convMsgs.length;
  const activeTicketId = ticket?.id ? String(ticket.id) : '';

  useEffect(() => {
    if (!activeTicketId) return;
    const prevThread = agentDebugMsgCount[`thread:${activeTicketId}`];
    if (prevThread === threadLen) return;
    agentDebugMsgCount[`thread:${activeTicketId}`] = threadLen;
    deskPlatformTrace('auto-refresh', 'render:thread-mudou', {
      ticketId: activeTicketId,
      msgsNaThread: threadLen,
      refreshKey,
    });
  }, [activeTicketId, threadLen, refreshKey]);

  const ticketAi = useTicketAiSuggestions(ticket, rightFields, convMsgs, internalText);

  const handleApplyTabulation = useCallback(async () => {
    const merged = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);

    if (isTabulationComplete(merged, config, ticket, getAgentName)) {
      const synced = ['tipo', 'produto', 'motivo', 'detalhe', 'canal'].some(
        (key) => String(merged[key] || '') !== String(rightFields?.[key] || ''),
      );
      if (synced) setRightFields(merged);
      if (activeTabId) {
        const sessionKey = String(activeTabId);
        tabSessionsRef.current[sessionKey] = {
          ...(tabSessionsRef.current[sessionKey] || {}),
          rightFields: merged,
        };
      }
      showNotification('Tabulação já preenchida.', 'success');
      return;
    }

    const tab = ticketAi.tabulacao || parseTabulationDisplay(ticketAi.tabulacaoDisplay);
    if (!hasApplyableTabulation(tab)) {
      showNotification('Nenhuma tabulação sugerida disponível.', 'warning');
      return;
    }

    const next = applyTabulationSuggestion(merged, tab, config);
    const changed = ['tipo', 'produto', 'motivo', 'detalhe'].some(
      (key) => String(next[key] || '') !== String(merged[key] || ''),
    );

    if (!changed) {
      if (isTabulationComplete(next, config, ticket, getAgentName)) {
        setRightFields(next);
        if (activeTabId) {
          const sessionKey = String(activeTabId);
          tabSessionsRef.current[sessionKey] = {
            ...(tabSessionsRef.current[sessionKey] || {}),
            rightFields: next,
          };
        }
        showNotification('Tabulação já preenchida.', 'success');
        return;
      }
      showNotification('Sugestão de tabulação não preenche os campos obrigatórios.', 'warning');
      return;
    }

    setRightFields(next);

    if (activeTabId) {
      const sessionKey = String(activeTabId);
      tabSessionsRef.current[sessionKey] = {
        ...(tabSessionsRef.current[sessionKey] || {}),
        rightFields: next,
      };
    }

    if (ticket && !isDraftTicket(ticket)) {
      try {
        await updateTicketInCache(ticket.id, (t) => applyRightFieldsToTicket(t, next));
        syncTicketViews();
      } catch {
        showNotification('Tabulação aplicada nos campos, mas não foi possível salvar no ticket.', 'warning');
        return;
      }
    }

    showNotification('Tabulação sugerida pela IA aplicada nos campos.', 'success');
  }, [
    activeTabId,
    config,
    rightFields,
    showNotification,
    syncTicketViews,
    ticket,
    ticketAi.tabulacao,
    ticketAi.tabulacaoDisplay,
  ]);

  const workflowDefinitions = useMemo(
    () => (runtimeWorkflows?.length ? runtimeWorkflows : getRuntimeWorkflows()),
    [runtimeWorkflows],
  );

  const matchedWorkflowTemplate = useMemo(() => {
    if (!ticket || isDraftTicket(ticket) || isTicketWorkflowActive(ticket)) return null;
    if (!isClientIdentifiedForWorkflow(ticket)) return null;
    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    return resolveWorkflowForTicket(ticket, fields, workflowDefinitions);
  }, [ticket, rightFields, workflowDefinitions]);

  const executeWorkflowStart = useCallback(async (payload) => {
    const template = pendingWorkflowTemplateRef.current || workflowStartTemplate;
    if (!ticket || !template || startingWorkflow || isTicketInWorkflow(ticket)) return false;

    const requisicaoValores = payload?.valores ?? payload;
    const solicitacaoProdutos = payload?.solicitacaoProdutos ?? null;

    if (!isClientIdentifiedForWorkflow(ticket)) {
      showNotification(WORKFLOW_REQUIRES_CLIENT_MESSAGE, 'warning');
      return;
    }

    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    setStartingWorkflow(true);
    try {
      const ticketId = ticket.id || ticket._id;
      const entry = findTicketEntry(ticketId);

      const tabOnly = { ...(entry?.ticket || ticket) };
      applyRightFieldsToTicket(tabOnly, fields);
      if (tabOnly.lateralForm?.workflow) {
        const nextLf = { ...tabOnly.lateralForm };
        delete nextLf.workflow;
        tabOnly.lateralForm = nextLf;
      }
      await updateTicketInCache(ticketId, () => tabOnly);

      const entryAfterTab = findTicketEntry(ticketId);
      const base = { ...(entryAfterTab?.ticket || tabOnly) };
      applyRightFieldsToTicket(base, fields);
      if (solicitacaoProdutos) {
        base.lateralForm = {
          ...(base.lateralForm || {}),
          solicitacaoProdutos,
        };
      }
      applyPendingWorkflowStartToTicket(base, template, requisicaoValores, getAgentName());
      patchTicket(ticketId, base);

      const flushResult = await flushPendingWorkflowOnSave(ticketId, base, {
        ticketsApi,
        apiTicketToCockpit,
        patchTicket,
        injectWorkflowSystemMessage,
      });
      if (flushResult.error) {
        showNotification(
          flushResult.error?.response?.data?.message
            || 'Não foi possível iniciar o workflow.',
          'warning',
        );
        return false;
      }

      showNotification(`Workflow "${template.title}" iniciado.`, 'success');
      pendingWorkflowTemplateRef.current = null;
      setWorkflowStartTemplate(null);
      await syncTicketViews();
      return true;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível iniciar o workflow.';
      showNotification(msg, 'error');
      return false;
    } finally {
      setStartingWorkflow(false);
    }
  }, [
    rightFields,
    showNotification,
    startingWorkflow,
    ticket,
    workflowStartTemplate,
    patchTicket,
    syncTicketViews,
  ]);

  const handleOpenComunicacaoModal = useCallback(async () => {
    if (!ticket || comunicacaoBusy) return;
    setComunicacaoBusy(true);
    try {
      if (ticket.listOnly || !ticket._detailLoaded) {
        await loadTicketDetailFromApi(ticket.id || ticket._id);
        await syncTicketViews();
      }
      setComunicacaoModalOpen(true);
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível abrir a conversa.', 'error');
    } finally {
      setComunicacaoBusy(false);
    }
  }, [comunicacaoBusy, showNotification, syncTicketViews, ticket]);

  const handleSubmitComunicacao = useCallback(async (message) => {
    if (!ticket || comunicacaoBusy) return null;
    setComunicacaoBusy(true);
    try {
      const updated = await replyWorkflowComunicacao(ticket.id || ticket._id, message);
      await syncTicketViews();
      showNotification('Resposta enviada ao time do workflow.', 'success');
      return updated;
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Não foi possível enviar a resposta.', 'error');
      throw err;
    } finally {
      setComunicacaoBusy(false);
    }
  }, [comunicacaoBusy, showNotification, syncTicketViews, ticket]);

  const handleStartWorkflow = useCallback(() => {
    if (!ticket || isDraftTicket(ticket) || startingWorkflow || isTicketInWorkflow(ticket)) return;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não aceita modificações.', 'warning');
      return;
    }

    if (!isClientIdentifiedForWorkflow(ticket)) {
      showNotification(WORKFLOW_REQUIRES_CLIENT_MESSAGE, 'warning');
      return;
    }

    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    const template = resolveWorkflowForTicket(ticket, fields, workflowDefinitions);
    if (!template) {
      showNotification('Tabulação não compatível com nenhum workflow ativo.', 'warning');
      return;
    }

    pendingWorkflowTemplateRef.current = template;
    setWorkflowStartTemplate(template);

    const campos = resolveRequisicaoCamposVisiveis(template?.raw || template);
    if (!campos.length) {
      executeWorkflowStart();
      return;
    }

    setWorkflowStartModalOpen(true);
  }, [
    executeWorkflowStart,
    workflowDefinitions,
    rightFields,
    showNotification,
    startingWorkflow,
    ticket,
  ]);

  const handleWorkflowStartModalSubmitted = useCallback(async (valores) => {
    const ok = await executeWorkflowStart(valores);
    if (ok) setWorkflowStartModalOpen(false);
  }, [executeWorkflowStart]);

  const handleWorkflowStartModalClose = useCallback(() => {
    setWorkflowStartModalOpen(false);
    pendingWorkflowTemplateRef.current = null;
    setWorkflowStartTemplate(null);
  }, []);

  const workflowProgress = ticket ? getWorkflowProgress(ticket) : null;
  const isAtendimentoAgent = hasAtendimentoFuncao(colaboradorAtuacao);
  const deskPermissions = permsCtx?.permissions;
  const canPublicCompose = ticket ? canSendPublicMessageOnTicket(ticket, deskPermissions) : false;
  const canInternalCompose = ticket ? canSendInternalNoteOnTicket(ticket, deskPermissions) : false;
  const canInitiateWorkflow = canPublicCompose;
  const workflowPublicLocked = ticketReadOnly || !canPublicCompose;
  const tabulationReadonly = ticketReadOnly || !canPublicCompose;

  const canAdvanceWorkflow = (() => {
    if (ticket?.workflow?.pendingPersist) return false;
    if (!canAdvanceWorkflowStep(ticket, deskPermissions)) return false;
    if (!workflowProgress || workflowProgress.workflow?.status === 'completed') return false;
    const step = workflowProgress.activeStep;
    if (!step) return false;
    if (isAtendimentoAgent) {
      if (workflowProgress.externalTeamActive) return false;
      const stepTeam = step.team;
      if (stepTeam && !['n1', 'agent'].includes(stepTeam)) return false;
      const requisicaoValores = ticket?.workflow?.requisicao?.valores;
      const hasRequisicao = requisicaoValores && Object.keys(requisicaoValores).length > 0;
      if (
        hasRequisicao
        && step.acao?.tipo === 'manual'
        && ['n1', 'agent'].includes(stepTeam || 'n1')
      ) {
        return false;
      }
    }
    if (step.acao?.tipo === 'automatica' || step.atribuicao?.tipo === 'sistema') {
      const modo = resolveAutomaticaConfig(step)?.modo;
      return modo === 'call_to_action';
    }
    if (step.acao?.tipo === 'aprovacao') {
      return false;
    }
    return true;
  })();

  const canManageWorkflow = useMemo(
    () => Boolean(ticket && isTicketInWorkflow(ticket) && canInterruptWorkflow(permsCtx?.permissions)),
    [ticket, permsCtx?.permissions],
  );

  const handleAdvanceWorkflow = useCallback(async () => {
    if (!ticket || isDraftTicket(ticket) || advancingWorkflow) return;
    setAdvancingWorkflow(true);
    try {
      const updated = await ticketsApi.advanceWorkflow(ticket.id || ticket._id, {});
      await updateTicketInCache(ticket.id, () => normalizeTicketForDeskV2(updated));
      await syncTicketViews();
      showNotification('Workflow avançado.', 'success');
    } catch (err) {
      showNotification(
        err?.response?.data?.message || 'Não foi possível avançar o workflow.',
        'warning',
      );
    } finally {
      setAdvancingWorkflow(false);
    }
  }, [
    advancingWorkflow,
    showNotification,
    syncTicketViews,
    ticket,
  ]);

  const handleCancelWorkflow = useCallback(async () => {
    if (!ticket || isDraftTicket(ticket) || cancelingWorkflow) return;

    if (ticket.workflow?.pendingPersist || ticket._pendingWorkflowStart) {
      await updateTicketInCache(ticket.id, (t) => discardPendingWorkflowStart({ ...t }));
      showNotification('Workflow cancelado.', 'success');
      return;
    }

    setCancelingWorkflow(true);
    try {
      const updated = await ticketsApi.cancelWorkflow(ticket.id || ticket._id, {});
      await updateTicketInCache(ticket.id, () => normalizeTicketForDeskV2(updated));
      await syncTicketViews();
      showNotification('Workflow interrompido.', 'success');
    } catch (err) {
      showNotification(
        err?.response?.data?.message || 'Não foi possível interromper o workflow.',
        'warning',
      );
    } finally {
      setCancelingWorkflow(false);
    }
  }, [
    cancelingWorkflow,
    showNotification,
    syncTicketViews,
    ticket,
  ]);

  useEffect(() => {
    if (workflowPublicLocked && composeMode === 'public') {
      setComposeMode('internal');
    }
  }, [workflowPublicLocked, composeMode]);

  const handleOpenAiRevision = useCallback(() => {
    setAiRevisionOpen(true);
  }, []);

  const handleCloseAiRevision = useCallback(() => {
    setAiRevisionOpen(false);
  }, []);

  const handleAiRevisionSubmit = useCallback(async (inputOperador) => {
    setAiRevisionSubmitting(true);
    try {
      const result = await ticketAi.requestRevision(inputOperador);
      if (result.success) {
        showNotification('Sugestão revisada pela IA.', 'success');
      } else if (result.error) {
        showNotification(result.error, 'warning');
      }
      return result;
    } finally {
      setAiRevisionSubmitting(false);
    }
  }, [ticketAi, showNotification]);

  const handleUseIaReply = useCallback((nucleo) => {
    const wrapped = wrapComposerOpeningForTicket({
      nucleo,
      ticket,
      agentName: getAgentName(),
    });
    setComposeText(wrapped);
  }, [ticket]);

  const showTableQueueMain = isTableQueueView && tableQueueBrowsing && !createOpen;
  const showTicketMain = Boolean(ticket) && !showTableQueueMain;
  const showOpenTabsBar = openTabs.length > 0 && !createOpen && !showTableQueueMain;

  return (
    <div className={'app-shell' + (isTableQueueView ? ' app-shell--table-queue' : '')} id="deskAppShell">
      <DeskQueuePanel
        queueStatuses={queueStatuses}
        activeQueue={activeQueue}
        collapsed={queueCollapsed}
        onSelectQueue={selectQueue}
        onCollapse={() => handleQueueCollapse(true)}
        onExpand={() => handleQueueCollapse(false)}
        onCreateTicket={() => setCreateOpen(true)}
        refreshKey={refreshKey}
      />

      {!isTableQueueView ? (
        <DeskTicketList
          queueStatuses={queueStatuses}
          activeTicketId={activeTabId}
          activeSort={activeSort}
          entries={entries}
          searchActive={!!appliedSearch.trim()}
          searchQuery={searchDraft}
          collapsed={listCollapsed}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onSelectTicket={selectTicket}
          onSortChange={setActiveSort}
          entrySortOldestFirst={entrySortOldestFirst}
          onToggleEntrySort={() => setEntrySortOldestFirst((v) => !v)}
          onCollapse={() => handleListCollapse(true)}
          onExpand={() => handleListCollapse(false)}
          onReload={reload}
          refreshing={ticketsLoading}
          showSkeleton={ticketsLoading && entries.length === 0 && !appliedSearch.trim()}
        />
      ) : null}

      <main className={'crm-main-content' + (createOpen ? ' crm-main-content--create' : '') + (showTableQueueMain ? ' crm-main-content--table-queue' : '')} id="crmMainContent">
        {createOpen ? (
          <CreateTicketPanel
            onClose={() => setCreateOpen(false)}
            onSaved={handleCreateSaved}
          />
        ) : (
          <>
            {showOpenTabsBar ? (
              <DeskTicketTabsBar
                onSelectTab={activateTicketTab}
                onCloseTab={closeTicketTabHandler}
              />
            ) : null}
            {showTableQueueMain && isMyTicketsQueue ? (
              <DeskMyTicketsTable
                entries={entries}
                searchActive={!!appliedSearch.trim()}
                expandedSectionId={myTicketsExpandedSection}
                onSelectTicket={selectTicket}
                onReload={reload}
                refreshing={ticketsLoading}
              />
            ) : showTableQueueMain && isResolvedQueue ? (
              <DeskResolvedTicketTable
                entries={entries}
                searchActive={!!appliedSearch.trim()}
                displayTotal={countByQueue('resolvidos')}
                onSelectTicket={selectTicket}
                onReload={reload}
                refreshing={ticketsLoading}
              />
            ) : !showTicketMain ? (
              <div className="crm-empty-state" id="crmEmptyMain">Selecione um ticket na lista ao lado</div>
            ) : (
              <div className="crm-ticket-view desk-crm-ticket-scope">
                <DeskClientProfileBar
              ticket={ticket}
              client={client}
              onSaveContact={handleSaveContact}
              onOpenHistory={() => setHistoryOpen(true)}
              onAdvanceWorkflow={handleAdvanceWorkflow}
              onCancelWorkflow={handleCancelWorkflow}
              advancingWorkflow={advancingWorkflow}
              cancelingWorkflow={cancelingWorkflow}
              canAdvanceWorkflow={canAdvanceWorkflow && !ticketReadOnly}
              canManageWorkflow={canManageWorkflow && !ticketReadOnly}
            />
            <nav className="tabs-top" aria-label="Navegação do ticket">
              <div className="tabs-top__tabs">
                <button
                  type="button"
                  className={'tab-btn' + (mainTab === 'conversa' ? ' is-active' : '')}
                  onClick={() => selectMainTab('conversa')}
                >
                  <i className="ti ti-message-2" /> Conversa
                </button>
                <button
                  type="button"
                  className={'tab-btn' + (mainTab === 'notas' ? ' is-active' : '')}
                  onClick={() => selectMainTab('notas')}
                >
                  <i className="ti ti-file-text" /> Notas
                </button>
                <button
                  type="button"
                  className={'tab-btn' + (mainTab === 'eventos' ? ' is-active' : '')}
                  onClick={() => selectMainTab('eventos')}
                >
                  <i className="ti ti-timeline" /> Eventos
                </button>
                <button
                  type="button"
                  className={'tab-btn' + (mainTab === 'consultas' ? ' is-active' : '')}
                  onClick={() => selectMainTab('consultas')}
                >
                  <i className="ti ti-search" /> Consultas
                </button>
              </div>
              <div className="tabs-top__status-group">
                <TicketFusaoStatusControls ticket={ticket} onOpenChild={openMergedChildTicket} />
                <span className={'status-badge tabs-top__status status-badge--' + ticketStatus.cls}>
                  {ticketStatus.label}
                </span>
              </div>
            </nav>
            <ClientTicketHistoryModal
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              ticket={ticket}
              client={client}
              onSelectTicket={selectTicket}
              sourceTicketId={ticket?.id || ticket?._id}
              onFundirTickets={handleFundirTickets}
              merging={mergeInProgress}
            />
            <div className={'crm-conversation-wrap' + (waChatOpen ? ' crm-conversation-wrap--wa' : '')}>
              {mainTab === 'conversa' && waChatOpen ? (
                <div className="tab-panel is-active" data-panel="conversa">
                  <DeskWhatsAppChat
                    ticket={ticket}
                    client={client}
                    messages={waConvMsgs}
                    composeText={composeText}
                    onComposeTextChange={setComposeText}
                    onUseIaReply={handleUseIaReply}
                    onSend={handleSendWhatsAppMessage}
                    onSendInitial={handleSendWhatsAppInitial}
                    waUiState={waUiState}
                    initialSendBusy={waSendInProgress}
                    sendBusy={waSendInProgress}
                    iaReply={ticketAi.respostaSugerida}
                    iaReplyLoading={ticketAi.loading}
                    iaWaitingMessage={ticketAi.waitingMessage}
                    iaShowBar={ticketAi.showIaBar}
                    iaHasSuggestion={ticketAi.hasSuggestion}
                  />
                </div>
              ) : (
                <div
                  className={
                    'tab-panel is-active'
                    + (mainTab === 'notas' ? ' tab-panel--notes' : '')
                    + (mainTab === 'eventos' ? ' tab-panel--eventos' : '')
                    + (mainTab === 'consultas' ? ' tab-panel--consultas' : '')
                  }
                  data-panel={mainTab}
                >
                  {mainTab === 'conversa' ? (
                    <>
                      <TicketWorkflowInfoRequestCallout ticket={ticket} />
                      <DeskConversation
                        ticket={ticket}
                        messages={convMsgs}
                        onUseIaReply={handleUseIaReply}
                        iaReply={ticketAi.respostaSugerida}
                        iaReplyLoading={ticketAi.loading}
                        iaWaitingMessage={ticketAi.waitingMessage}
                        iaShowBar={ticketAi.showIaBar}
                        iaHasSuggestion={ticketAi.hasSuggestion}
                        iaError={ticketAi.error}
                        iaAuditScore={ticketAi.auditScore}
                        onRequestRevision={handleOpenAiRevision}
                      />
                      <DeskComposePanel
                        ticketId={ticket.id}
                        variant="full"
                        composeMode={composeMode}
                        composeText={composeText}
                        internalText={internalText}
                        composeAttachments={composeAttachments}
                        onComposeAttachmentsChange={setComposeAttachments}
                        onComposeModeChange={setComposeMode}
                        onComposeTextChange={setComposeText}
                        onInternalTextChange={setInternalText}
                        spellIgnoredWords={spellIgnoredWords}
                        onIgnoreSpellWord={handleIgnoreSpellWord}
                        onFlaggedErrorsChange={handleFlaggedErrorsChange}
                        workflowLocked={workflowPublicLocked}
                        internalComposeLocked={!canInternalCompose || ticketReadOnly}
                        workflowTeamLabel={workflowProgress?.awaitingTeamLabel}
                        ticketReadOnly={ticketReadOnly}
                      />
                    </>
                  ) : mainTab === 'notas' ? (
                    <DeskInternalNotesPanel
                      ticket={ticket}
                      client={client}
                    />
                  ) : mainTab === 'eventos' ? (
                    <DeskEventsPanel
                      ticket={ticket}
                      client={client}
                    />
                  ) : (
                    <DeskConsultasPanel
                      ticket={ticket}
                      client={client}
                      active={mainTab === 'consultas'}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
            )}
          </>
        )}
      </main>

      {ticket && !createOpen && !showTableQueueMain && (
        <DeskRightPanel
          ticket={ticket}
          client={client}
          queueId={entry?.queueId}
          rightFields={rightFields}
          sendStatus={sendStatus}
          onFieldChange={handleFieldChange}
          onApplyTabulation={handleApplyTabulation}
          onStartWorkflow={handleStartWorkflow}
          startingWorkflow={startingWorkflow}
          canStartWorkflow={Boolean(matchedWorkflowTemplate)}
          canInitiateWorkflow={canInitiateWorkflow}
          onReplyWorkflowRequest={handleOpenComunicacaoModal}
          replyWorkflowBusy={comunicacaoBusy}
          onCommitStatus={handleCommitWithStatus}
          waChatOpen={waChatOpen}
          onOpenChat={handleOpenChat}
          onCloseChat={() => setWaChatOpen(false)}
          sendDisabled={
            sendDisabledBySpell
            || ticketReadOnly
            || (composeMode === 'public' ? !canPublicCompose : !canInternalCompose)
          }
          iaTabulationDisplay={ticketAi.tabulacaoDisplay}
          iaTabulation={ticketAi.tabulacao}
          iaTabulationFonte={ticketAi.tabulacaoFonte}
          iaTabulationLoading={ticketAi.loading}
          iaWaitingMessage={ticketAi.waitingMessage}
          iaHasSuggestion={ticketAi.hasSuggestion}
          iaHasTabulationSuggestion={ticketAi.hasTabulationSuggestion}
          iaShowSection={ticketAi.showIaSection}
          iaAuditScore={ticketAi.auditScore}
          tabulationReadonly={tabulationReadonly}
          ticketReadOnly={ticketReadOnly}
        />
      )}

      <DeskAiRevisionModal
        open={aiRevisionOpen}
        auditScore={ticketAi.auditScore}
        submitting={aiRevisionSubmitting}
        onClose={handleCloseAiRevision}
        onSubmit={handleAiRevisionSubmit}
      />

      <WorkflowComunicacaoModal
        open={comunicacaoModalOpen}
        busy={comunicacaoBusy}
        ticket={ticket}
        origem="responsavel"
        title="Responder solicitação"
        subtitle="Comunicação com o time do workflow"
        onClose={() => !comunicacaoBusy && setComunicacaoModalOpen(false)}
        onSubmit={handleSubmitComunicacao}
      />

      <ProdutosForwardPopover
        open={workflowStartModalOpen}
        workflowDef={workflowStartTemplate}
        ticket={ticket}
        submitting={startingWorkflow}
        onClose={handleWorkflowStartModalClose}
        onSubmitted={handleWorkflowStartModalSubmitted}
      />
    </div>
  );
}
