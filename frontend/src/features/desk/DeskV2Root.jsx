/**
 * Desk CRM — raiz 5 colunas (layout referência)
 * VERSION: v3.18.2 | DATE: 2026-07-29
 * — ticket fechado somente leitura + badge Fechado
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filterTickets,
  resolveDeskSearchEntries,
  pickNextTicketFromEntries,
  resolveDeskWorkingEntries,
  getEntryTicketId,
  isDeskTableQueue,
  isMeusTicketsQueue,
  buildRegistroThread,
  normalizeTicketForDeskV2,
  getAgentName,
  applySendStatus,
  normalizeCpf,
  isValidEmailFormat,
  getTicketProtocolLabel,
  isTicketInWorkflow,
  injectWorkflowSystemMessage,
  getWorkflowProgress,
  syncTicketWorkflowOnCommit,
  getTicketStatusBadgeMeta,
  isTicketReadOnly,
} from '../../services/desk/utils';
import { mergeTicketInto } from '../../services/desk/ticketMergeService';
import {
  applyPendingWorkflowStartToTicket,
  discardPendingWorkflowStart,
  flushPendingWorkflowOnSave,
  mergeApiTicketPreservingPendingWorkflow,
} from '../../services/desk/pendingWorkflowStart';
import { findTicketEntry, mapTicketQueueId, commitTicketViaApi, updateTicketInCache, loadTicketDetailFromApi } from '../../services/ticketsStorage';
import { isDraftTicket, persistDraftTicket } from '../../services/ticketsCache';
import { apiTicketToCockpit, cockpitTicketToApi } from '../../api/adapters/ticketAdapter';
import { lookupClient } from '../../services/clientDb';
import { clientsApi, colaboradoresApi, ticketsApi } from '../../api/client';
import { persistClienteContact } from '../../api/adapters/clienteAdapter';
import { useTickets } from '../../context/TicketsContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { usePermissionsOptional } from '../../context/PermissionContext';
import { canInterruptWorkflow } from '../../services/permissions/permissionService';
import { hasAtendimentoFuncao } from '../../services/desk/atuacaoVision';
import { getAllQueueStatuses, fetchAndHydrateCustomQueues } from '../../services/desk/customQueueBoxes';
import CreateTicketPanel from './components/CreateTicketPanel';
import DeskQueuePanel from './components/DeskQueuePanel';
import DeskTicketList from './components/DeskTicketList';
import DeskResolvedTicketTable from './components/DeskResolvedTicketTable';
import DeskMyTicketsTable from './components/DeskMyTicketsTable';
import DeskTicketTabsBar from './components/DeskTicketTabsBar';
import DeskClientProfileBar from './components/DeskClientProfileBar';
import ClientTicketHistoryModal from './components/ClientTicketHistoryModal';
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
import { createSpellContext, loadSpellEngine, scanText } from '../../services/spellcheck/spellEngine';
import { htmlToPlainText } from '../../services/desk/composeRichEditor';
import { useTicketAiSuggestions } from '../../hooks/useTicketAiSuggestions';
import DeskAiRevisionModal from './components/DeskAiRevisionModal';
import { resolveAutomaticaConfig } from '../config/workflow/workflowConfigData';
import { resolveWorkflowForTicket } from '../../services/desk/workflowEngine';
import { resolveRequisicaoCamposVisiveis } from '../../services/workflow/workflowRequisicao';
import { getAutoCloseOnSave, getDeskSearchMode, setDeskSearchMode } from '../../services/desk/agentDeskPreferences';
import { DESK_SEARCH_MODE_CPF, DESK_SEARCH_MODE_TICKET, parseDeskQueueFromUrl } from '../../services/desk/constants';
import ProdutosForwardPopover from './components/ProdutosForwardPopover';
import WorkflowComunicacaoModal from '../workflow/components/WorkflowComunicacaoModal';
import { replyWorkflowComunicacao } from '../../services/workflow/workflowDecisionHandlers';
import deskPlatformTrace, { createPlatformTraceCounter } from '../../utils/deskPlatformTrace';

/** Respostas de cliente chegam por e-mail a qualquer momento: a thread se atualiza sozinha */
const AUTO_REFRESH_DETAIL_MS = 15000;
const AUTO_REFRESH_QUEUES_MS = 60000;

function ticketNeedsDetailLoad(ticket) {
  if (!ticket) return true;
  if (ticket.listOnly === true) return true;
  if (!ticket._detailLoaded) return true;
  const hasContent = (ticket.messages?.length || 0) > 0
    || (ticket.internalNotes?.length || 0) > 0
    || (ticket.registroHistorico?.length || 0) > 0;
  if (hasContent) return false;
  const status = String(ticket.status || '').trim().toLowerCase();
  if (status === 'novo') return false;
  // Ticket em andamento/resolvido sem thread — provável falha de cache (304)
  return true;
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
  const [searchParams] = useSearchParams();

  const detailLoadRef = useRef(null);
  const [activeQueue, setActiveQueue] = useState(() => parseDeskQueueFromUrl(searchParams.get('queue')));
  const [activeSort, setActiveSort] = useState('data');
  const [entrySortOldestFirst, setEntrySortOldestFirst] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchMode, setSearchMode] = useState(() => getDeskSearchMode());
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

  useEffect(() => {
    const fromUrl = searchParams.get('queue');
    if (!fromUrl) return;
    const queue = parseDeskQueueFromUrl(fromUrl);
    suppressAutoSelectRef.current = true;
    setActiveQueue((current) => (current === queue ? current : queue));
    setTableQueueBrowsing(isDeskTableQueue(queue));
  }, [searchParams]);

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
    await refreshTickets();
    await fetchAndHydrateCustomQueues();
    setQueueStatuses(getAllQueueStatuses());
  }, [refreshTickets]);

  const reload = useCallback(async () => {
    try {
      await syncTicketViews();
      showNotification('Tickets atualizados.', 'success');
    } catch {
      showNotification('Não foi possível atualizar os tickets.', 'error');
    }
  }, [syncTicketViews, showNotification]);

  const entries = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst, searchMode);
  const isTableQueueView = isDeskTableQueue(activeQueue);
  const isResolvedQueue = activeQueue === 'resolvidos';
  const isMyTicketsQueue = isMeusTicketsQueue(activeQueue);
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
        const full = await loadTicketDetailFromApi(ticketId);
        const msgs = full?.messages?.length ?? 0;
        const prevEntry = findTicketEntry(ticketId);
        const prevMsgs = prevEntry?.ticket?.messages?.length;
        if (prevMsgs == null || msgs !== prevMsgs) {
          const last = full?.messages?.[msgs - 1];
          deskPlatformTrace('auto-refresh', 'poll:msgs-mudou', {
            ticketId,
            de: prevMsgs ?? null,
            para: msgs,
            ultimaOrigem: last?.origin || last?.sender || null,
            patch: !cancelled && !commitInProgressRef.current,
          });
        }
        if (!cancelled && !commitInProgressRef.current) {
          const merged = prevEntry?.ticket
            ? mergeApiTicketPreservingPendingWorkflow(prevEntry.ticket, full)
            : full;
          patchTicket(ticketId, merged);
        }
      } catch (err) {
        deskPlatformTrace('auto-refresh', 'poll:erro', { ticketId, message: String(err?.message || err) }, 'warn');
        /* rede instável não deve interromper o atendimento */
      } finally {
        inFlight = false;
      }
    };

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

  const selectTicket = (id) => {
    suppressAutoSelectRef.current = true;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    const entry = findTicketEntry(id);
    if (!entry) {
      showNotification('Não foi possível abrir o ticket — recarregue a lista.', 'warning');
      return;
    }
    openTicket(id);
  };

  const activateTicketTab = (id) => {
    if (String(id) === String(activeTabId)) return;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    setActiveTabId(id);
  };

  const closeTicketTabHandler = (id) => {
    if (String(id) === String(activeTabId)) {
      persistTabSession(activeTabId);
    }
    delete tabSessionsRef.current[String(id)];
    const isLastTab = openTabs.length === 1 && String(openTabs[0].id) === String(id);
    if (isLastTab) suppressAutoSelectRef.current = true;
    closeTicketTab(id);
  };

  const handleMergeTickets = useCallback(async (targetId) => {
    if (!ticket?.id || mergeInProgress) return;
    if (isTicketReadOnly(ticket)) {
      showNotification('Ticket fechado — não é possível mesclar.', 'warning');
      return;
    }
    const sourceId = String(ticket.id);
    if (isDraftTicket(ticket)) {
      showNotification('Salve o ticket antes de mesclar.', 'warning');
      return;
    }
    setMergeInProgress(true);
    try {
      await mergeTicketInto(sourceId, targetId);
      await syncTicketViews();
      setHistoryOpen(false);
      selectTicket(targetId);
      setMainTab('notas');
      if (openTabs.some((tab) => String(tab.id) === sourceId)) {
        closeTicketTabHandler(sourceId);
      }
      showNotification('Tickets mesclados com sucesso.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível mesclar os tickets.';
      showNotification(msg, 'error');
    } finally {
      setMergeInProgress(false);
    }
  }, [
    ticket,
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
      const freshList = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst, searchMode);
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
  }, [activeQueue, appliedSearch, activeSort, entrySortOldestFirst, searchMode, openTicket, closeTicketTab, activeTabId, persistTabSession]);

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

  const handleSearchModeToggle = () => {
    setSearchMode((prev) => {
      const next = prev === DESK_SEARCH_MODE_CPF ? DESK_SEARCH_MODE_TICKET : DESK_SEARCH_MODE_CPF;
      setDeskSearchMode(next);
      return next;
    });
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

  const handleSearchSubmit = () => {
    const q = searchDraft.trim();
    setAppliedSearch(q);

    if (!q) {
      showNotification('Busca limpa. Exibindo fila atual.', 'info');
      return;
    }

    const results = resolveDeskSearchEntries(q, activeSort, entrySortOldestFirst, searchMode);
    if (!results.length) {
      const hint = searchMode === DESK_SEARCH_MODE_TICKET
        ? 'Nenhum ticket encontrado para o protocolo informado.'
        : 'Nenhum ticket encontrado para o CPF informado (11 dígitos).';
      showNotification(hint, 'warning');
      return;
    }

    suppressAutoSelectRef.current = false;
    setTableQueueBrowsing(false);
    persistTabSession(activeTabId);
    openTicket(results[0].ticket.id);

    const msg = searchMode === DESK_SEARCH_MODE_TICKET
      ? (results.length === 1
        ? 'Ticket localizado pelo protocolo.'
        : `${results.length} tickets correspondem ao protocolo informado.`)
      : (results.length === 1
        ? '1 ticket encontrado para este CPF.'
        : `${results.length} tickets encontrados para este CPF.`);
    showNotification(msg, 'success');
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
    const workingListBeforeSave = resolveDeskWorkingEntries(activeQueue, appliedSearch, activeSort, entrySortOldestFirst, searchMode);
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
        entryAfterSave?.ticket || ticket,
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
    const cpf = normalizeCpf(ticket.lateralForm?.cpf || ticket.lateralForm?.clienteCpf || ticket.clientCPF);

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

    try {
      const clienteDoc = await persistClienteContact(clientsApi, {
        cpf,
        nome,
        emails: emailList,
        phones: phoneList,
        whatsappPhone,
        clienteId: ticket.clienteId || ticket.lateralForm?.clienteId,
      });
      const clienteId = clienteDoc?._id || clienteDoc?.id || ticket.clienteId || ticket.lateralForm?.clienteId;
      const primaryEmail = emailList[0] || '';
      const primaryPhone = whatsappPhone || phoneList[0] || '';

      await updateTicketInCache(ticket.id, (t) => {
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
          clienteTelefone: phoneList,
          clienteTelefoneWhatsapp: whatsappPhone,
          clienteId: clienteId || t.lateralForm?.clienteId,
        };
        t.updatedAt = new Date().toISOString();
        return t;
      });

      showNotification('Contato atualizado.', 'success');
      syncTicketViews();
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
    syncTicketViews();
    showNotification('Ticket criado.', 'success');
  };

  const handleQueueBoxCreated = (box) => {
    setQueueStatuses(getAllQueueStatuses());
    setActiveQueue(box.id);
    suppressAutoSelectRef.current = true;
    setTableQueueBrowsing(isDeskTableQueue(box.id));
    syncTicketViews();
  };

  const convMsgs = ticket ? buildRegistroThread(ticket) : [];
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
    const tab = ticketAi.tabulacao || parseTabulationDisplay(ticketAi.tabulacaoDisplay);
    if (!hasApplyableTabulation(tab)) {
      showNotification('Nenhuma tabulação sugerida disponível.', 'warning');
      return;
    }

    const merged = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    const next = applyTabulationSuggestion(merged, tab, config);
    const changed = ['tipo', 'produto', 'motivo', 'detalhe'].some(
      (key) => String(next[key] || '') !== String(merged[key] || ''),
    );

    if (!changed) {
      showNotification('Tabulação indisponível', 'warning');
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

  const matchedWorkflowTemplate = useMemo(() => {
    if (!ticket || isDraftTicket(ticket) || isTicketInWorkflow(ticket)) return null;
    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    if (!isTabulationComplete(fields, config)) return null;
    return resolveWorkflowForTicket(ticket, fields);
  }, [ticket, rightFields, config]);

  const executeWorkflowStart = useCallback(async (requisicaoValores) => {
    const template = pendingWorkflowTemplateRef.current || workflowStartTemplate;
    if (!ticket || !template || startingWorkflow || isTicketInWorkflow(ticket)) return;

    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    setStartingWorkflow(true);
    try {
      const ticketId = ticket.id || ticket._id;
      const entry = findTicketEntry(ticketId);
      const base = { ...(entry?.ticket || ticket) };
      applyRightFieldsToTicket(base, fields);
      applyPendingWorkflowStartToTicket(base, template, requisicaoValores, getAgentName());
      patchTicket(ticketId, base);
      showNotification(
        `Workflow "${template.title}" preparado. Será ativado ao salvar o ticket.`,
        'success',
      );
      pendingWorkflowTemplateRef.current = null;
      setWorkflowStartTemplate(null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível preparar o workflow.';
      showNotification(msg, 'error');
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

    const fields = mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName);
    const tabulationCheck = validateTabulationForSendStatus('em-andamento', fields, config);
    if (!tabulationCheck.ok) {
      showNotification(tabulationCheck.message, 'warning');
      return;
    }

    const template = resolveWorkflowForTicket(ticket, fields);
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
    config,
    executeWorkflowStart,
    rightFields,
    showNotification,
    startingWorkflow,
    ticket,
  ]);

  const handleWorkflowStartModalSubmitted = useCallback(async (valores) => {
    setWorkflowStartModalOpen(false);
    await executeWorkflowStart(valores);
  }, [executeWorkflowStart]);

  const handleWorkflowStartModalClose = useCallback(() => {
    setWorkflowStartModalOpen(false);
    pendingWorkflowTemplateRef.current = null;
    setWorkflowStartTemplate(null);
  }, []);

  const workflowProgress = ticket ? getWorkflowProgress(ticket) : null;
  const isAtendimentoAgent = hasAtendimentoFuncao(colaboradorAtuacao);
  const workflowComposeLocked = Boolean(workflowProgress?.composeLocked) || !isAtendimentoAgent || ticketReadOnly;
  const tabulationReadonly = !isAtendimentoAgent || ticketReadOnly;

  const canAdvanceWorkflow = (() => {
    if (ticket?.workflow?.pendingPersist) return false;
    if (!workflowProgress || workflowProgress.workflow?.status === 'completed') return false;
    const step = workflowProgress.activeStep;
    if (!step) return false;
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
    if (workflowComposeLocked && composeMode === 'public') {
      setComposeMode('internal');
    }
  }, [workflowComposeLocked, composeMode]);

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

  const showTableQueueMain = isTableQueueView && tableQueueBrowsing && !createOpen;
  const showTicketMain = Boolean(ticket) && !showTableQueueMain;
  const showOpenTabsBar = openTabs.length > 0 && !createOpen;

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
        onQueueBoxCreated={handleQueueBoxCreated}
      />

      {!isTableQueueView ? (
        <DeskTicketList
          queueStatuses={queueStatuses}
          activeTicketId={activeTabId}
          activeSort={activeSort}
          entries={entries}
          searchActive={!!appliedSearch.trim()}
          searchQuery={searchDraft}
          searchMode={searchMode}
          collapsed={listCollapsed}
          onSearchChange={handleSearchChange}
          onSearchModeToggle={handleSearchModeToggle}
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
                onSelectTicket={selectTicket}
                onReload={reload}
                refreshing={ticketsLoading}
              />
            ) : showTableQueueMain && isResolvedQueue ? (
              <DeskResolvedTicketTable
                entries={entries}
                searchActive={!!appliedSearch.trim()}
                onSelectTicket={selectTicket}
                onReload={reload}
                refreshing={ticketsLoading}
              />
            ) : !showTicketMain ? (
              <div className="crm-empty-state" id="crmEmptyMain">Selecione um ticket na lista ao lado</div>
            ) : (
              <div className="crm-ticket-view">
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
              <span className={'status-badge tabs-top__status status-badge--' + ticketStatus.cls}>
                {ticketStatus.label}
              </span>
            </nav>
            <ClientTicketHistoryModal
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              ticket={ticket}
              client={client}
              onSelectTicket={selectTicket}
              sourceTicketId={ticket?.id || ticket?._id}
              onMergeTickets={handleMergeTickets}
              merging={mergeInProgress}
            />
            <div className={'crm-conversation-wrap' + (waChatOpen ? ' crm-conversation-wrap--wa' : '')}>
              {mainTab === 'conversa' && waChatOpen ? (
                <div className="tab-panel is-active" data-panel="conversa">
                  <DeskWhatsAppChat
                    key={ticket.id}
                    ticket={ticket}
                    client={client}
                    messages={convMsgs}
                    composeText={composeText}
                    onComposeTextChange={setComposeText}
                    onUseIaReply={setComposeText}
                    onSend={() => handleCommitWithStatus(sendStatus)}
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
                        onUseIaReply={setComposeText}
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
                        workflowLocked={workflowComposeLocked}
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

      {ticket && !createOpen && !(isMyTicketsQueue && showTableQueueMain) && (
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
          onReplyWorkflowRequest={handleOpenComunicacaoModal}
          replyWorkflowBusy={comunicacaoBusy}
          onCommitStatus={handleCommitWithStatus}
          waChatOpen={waChatOpen}
          onOpenChat={handleOpenChat}
          onCloseChat={() => setWaChatOpen(false)}
          sendDisabled={sendDisabledBySpell || ticketReadOnly}
          iaTabulationDisplay={ticketAi.tabulacaoDisplay}
          iaTabulation={ticketAi.tabulacao}
          iaTabulationFonte={ticketAi.tabulacaoFonte}
          iaTabulationLoading={ticketAi.loading}
          iaWaitingMessage={ticketAi.waitingMessage}
          iaHasSuggestion={ticketAi.hasSuggestion}
          iaHasTabulationSuggestion={ticketAi.hasTabulationSuggestion}
          iaShowSection={ticketAi.showIaBar || Boolean(ticketAi.waitingReason)}
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
        submitting={startingWorkflow}
        onClose={handleWorkflowStartModalClose}
        onSubmitted={handleWorkflowStartModalSubmitted}
      />
    </div>
  );
}
