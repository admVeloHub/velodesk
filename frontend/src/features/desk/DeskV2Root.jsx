/**
 * Desk CRM — raiz 5 colunas (layout referência)
 * VERSION: v3.5.8 | DATE: 2026-07-02
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  filterTickets,
  resolveDeskSearchEntries,
  pickDefaultTicket,
  buildRegistroThread,
  normalizeTicketForDeskV2,
  getAgentName,
  applySendStatus,
  normalizeCpf,
  isValidEmailFormat,
  getTicketProtocolLabel,
} from '../../services/desk/utils';
import { findTicketEntry, updateTicketInKanban, sendTicketRegistroEntry } from '../../services/kanbanStorage';
import { isDraftTicket, persistDraftTicket } from '../../services/ticketsCache';
import { lookupClient } from '../../services/clientDb';
import { clientsApi } from '../../api/client';
import { persistClienteContact } from '../../api/adapters/clienteAdapter';
import { useTickets } from '../../context/TicketsContext';
import { useNotifications } from '../../context/NotificationContext';
import { getAllQueueStatuses, restoreCustomKanbanBoxes } from '../../services/desk/customQueueBoxes';
import CreateTicketPanel from './components/CreateTicketPanel';
import DeskQueuePanel from './components/DeskQueuePanel';
import DeskTicketList from './components/DeskTicketList';
import DeskTicketTabsBar from './components/DeskTicketTabsBar';
import DeskClientProfileBar from './components/DeskClientProfileBar';
import DeskConversation from './components/DeskConversation';
import DeskWhatsAppChat from './components/DeskWhatsAppChat';
import DeskComposePanel from './components/DeskComposePanel';
import DeskInternalNotesPanel from './components/DeskInternalNotesPanel';
import DeskRightPanel from './components/DeskRightPanel';
import { applyCascadeFieldChange, buildDefaultRightFields, getMotivos, mergeRightFieldsWithDefaults, validateTabulationForSendStatus } from '../../services/tabulationConfig';
import { useTabulation } from '../../context/TabulationContext';
import { createSpellContext, loadSpellEngine, scanText } from '../../services/spellcheck/spellEngine';
import { htmlToPlainText } from '../../services/desk/composeRichEditor';

function applyRightFieldsToTicket(t, rightFields, escalonar) {
  const prevLf = t.lateralForm || {};
  const tipo = String(
    rightFields.tipo || prevLf.classificacaoTipo || prevLf.tipoChamado || 'Solicitação'
  ).trim() || 'Solicitação';
  const nextLf = {
    ...prevLf,
    classificacaoTipo: tipo,
    tipoChamado: tipo,
    produto: rightFields.produto || prevLf.produto,
    motivo: rightFields.motivo || prevLf.motivo,
    detalhe: rightFields.detalhe || prevLf.detalhe,
    canal: rightFields.canal || prevLf.canal,
    responsavel: rightFields.responsavel || prevLf.responsavel,
    escalonar,
  };
  if (escalonar) {
    nextLf.wasEscalated = true;
    nextLf.lastWorkflow = escalonar;
    nextLf.retornoN1 = false;
  } else if (prevLf.wasEscalated) {
    nextLf.retornoN1 = true;
  }
  t.lateralForm = nextLf;
  t.responsibleAgent = rightFields.responsavel;
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
    sendStatus: 'em-andamento',
    rightFields: buildDefaultRightFields(config, ticket, getAgentName),
    escalonar: lf.escalonar || null,
    waChatOpen: false,
    spellIgnoredWords: [],
  };
}

export default function DeskV2Root() {
  const {
    refreshKey,
    refreshTickets,
    loading: ticketsLoading,
    openTabs,
    activeTabId,
    openTicket,
    closeTicketTab,
    replaceOpenTabId,
    setActiveTabId,
  } = useTickets();
  const { showNotification } = useNotifications();
  const { config } = useTabulation();

  const [activeQueue, setActiveQueue] = useState('em-andamento');
  const [activeSort, setActiveSort] = useState('data');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [queueCollapsed, setQueueCollapsed] = useState(() => localStorage.getItem('velodeskCrmQueueCollapsed') === '1');
  const [listCollapsed, setListCollapsed] = useState(() => localStorage.getItem('velodeskCrmTicketListCollapsed') === '1');
  const [createOpen, setCreateOpen] = useState(false);
  const [mainTab, setMainTab] = useState('conversa');
  const [composeMode, setComposeMode] = useState('public');
  const [composeText, setComposeText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [sendStatus, setSendStatus] = useState('em-andamento');
  const [rightFields, setRightFields] = useState({});
  const [escalonar, setEscalonar] = useState(null);
  const [waChatOpen, setWaChatOpen] = useState(false);
  const [composeSpellErrors, setComposeSpellErrors] = useState([]);
  const [spellIgnoredWords, setSpellIgnoredWords] = useState(() => new Set());
  const [queueStatuses, setQueueStatuses] = useState(() => getAllQueueStatuses());
  const suppressAutoSelectRef = useRef(false);
  const tabSessionsRef = useRef({});
  const prevActiveTabIdRef = useRef(null);

  const syncTicketViews = useCallback(async () => {
    await refreshTickets();
    restoreCustomKanbanBoxes();
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

  const entries = appliedSearch.trim()
    ? resolveDeskSearchEntries(appliedSearch, activeSort)
    : filterTickets(activeQueue, '', activeSort);
  const entry = activeTabId ? findTicketEntry(activeTabId) : null;
  const ticket = entry?.ticket;
  const client = ticket ? lookupClient(ticket.lateralForm?.cpf || ticket.clientCPF) : null;

  const persistTabSession = useCallback((ticketId) => {
    if (!ticketId) return;
    tabSessionsRef.current[String(ticketId)] = {
      mainTab,
      composeMode,
      composeText,
      internalText,
      sendStatus,
      rightFields,
      escalonar,
      waChatOpen,
      spellIgnoredWords: Array.from(spellIgnoredWords),
    };
  }, [mainTab, composeMode, composeText, internalText, sendStatus, rightFields, escalonar, waChatOpen, spellIgnoredWords]);

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
    setSendStatus(session.sendStatus ?? defaults.sendStatus);
    setRightFields(nextRightFields);
    setEscalonar(session.escalonar ?? defaults.escalonar);
    setWaChatOpen(session.waChatOpen ?? defaults.waChatOpen);
    setSpellIgnoredWords(new Set(session.spellIgnoredWords ?? defaults.spellIgnoredWords ?? []));
    setComposeSpellErrors([]);
  }, [config]);

  const sendDisabledBySpell = composeMode === 'public' && composeSpellErrors.length > 0;

  useEffect(() => {
    restoreCustomKanbanBoxes();
    setQueueStatuses(getAllQueueStatuses());
  }, []);

  useEffect(() => {
    loadSpellEngine().catch(() => {});
  }, []);

  useEffect(() => {
    const openCreate = () => setCreateOpen(true);
    const closeCreate = () => setCreateOpen(false);
    const onRefreshTickets = () => { reload(); };
    window.addEventListener('velodesk:quick-register', openCreate);
    window.addEventListener('velodesk:quick-register-close', closeCreate);
    window.addEventListener('velodesk:refresh-tickets', onRefreshTickets);
    return () => {
      window.removeEventListener('velodesk:quick-register', openCreate);
      window.removeEventListener('velodesk:quick-register-close', closeCreate);
      window.removeEventListener('velodesk:refresh-tickets', onRefreshTickets);
    };
  }, [reload]);

  useEffect(() => {
    if (suppressAutoSelectRef.current && !activeTabId) return;

    if (openTabs.length > 0) {
      if (activeTabId && findTicketEntry(activeTabId)) return;
      const last = openTabs[openTabs.length - 1];
      if (last) setActiveTabId(last.id);
      return;
    }

    if (activeTabId && findTicketEntry(activeTabId)) return;
    const def = pickDefaultTicket(activeQueue);
    if (def) openTicket(def);
  }, [activeQueue, activeTabId, refreshKey, entries.length, openTabs, openTicket, setActiveTabId]);

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
    suppressAutoSelectRef.current = false;
    persistTabSession(activeTabId);
    openTicket(id);
  };

  const activateTicketTab = (id) => {
    if (String(id) === String(activeTabId)) return;
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

  const selectMainTab = (tab) => {
    setMainTab(tab);
  };

  const selectQueue = (queueId) => {
    suppressAutoSelectRef.current = false;
    setActiveQueue(queueId);
    setSearchDraft('');
    setAppliedSearch('');
    if (openTabs.length === 0) {
      const def = pickDefaultTicket(queueId);
      if (def) openTicket(def);
    }
  };

  const handleSearchSubmit = () => {
    const q = searchDraft.trim();
    setAppliedSearch(q);

    if (!q) {
      showNotification('Busca limpa. Exibindo fila atual.', 'info');
      return;
    }

    const results = resolveDeskSearchEntries(q, activeSort);
    if (!results.length) {
      showNotification('Nenhum ticket encontrado para CPF ou número informado.', 'warning');
      return;
    }

    suppressAutoSelectRef.current = false;
    persistTabSession(activeTabId);
    openTicket(results[0].ticket.id);

    const digits = q.replace(/\D/g, '');
    const isCpf = digits.length === 11;
    const msg = isCpf
      ? (results.length === 1
        ? '1 ticket encontrado para este CPF.'
        : `${results.length} tickets encontrados para este CPF.`)
      : (results.length === 1
        ? 'Ticket localizado.'
        : `${results.length} tickets correspondem ao número informado.`);
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
    if (!ticket || !entry) return null;
    const status = statusId || sendStatus;
    const messageHtml = String(composeText || '').trim();
    const internalNoteHtml = String(internalText || '').trim();
    const messageText = htmlToPlainText(messageHtml).trim();
    const internalNoteText = htmlToPlainText(internalNoteHtml).trim();
    const messagePayload = messageHtml || '';
    const internalNotePayload = internalNoteHtml || '';

    const tabulationCheck = validateTabulationForSendStatus(
      status,
      mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName),
      config,
    );
    if (!tabulationCheck.ok) {
      showNotification(tabulationCheck.message, 'warning');
      return null;
    }

    if (messageText) {
      if (composeSpellErrors.length > 0) {
        showNotification(
          `Corrija ${composeSpellErrors.length} erro${composeSpellErrors.length > 1 ? 's' : ''} ortográfico${composeSpellErrors.length > 1 ? 's' : ''} antes de enviar.`,
          'warning',
        );
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
          escalonar,
        );
        applySendStatus({ ticket: prepared, boxId: entry.boxId }, status);
        const regKey = Date.now();
        const ts = new Date().toISOString();
        const author = getAgentName();
        if (messageText) {
          if (!prepared.messages) prepared.messages = [];
          prepared.messages.push({
            id: `${regKey}-pub`,
            type: 'agent',
            fromClient: false,
            origin: 'agente',
            text: messagePayload,
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
        const persisted = await persistDraftTicket(prepared, messageText || internalNoteText);
        const newId = persisted.id || persisted._id;
        delete tabSessionsRef.current[draftId];
        if (session) {
          tabSessionsRef.current[String(newId)] = {
            ...session,
            sendStatus: status,
            composeText: messageText ? '' : session.composeText,
            internalText: internalNoteText ? '' : session.internalText,
          };
        }
        replaceOpenTabId(draftId, newId, {
          title: persisted.title || ticket.title,
          clientName: persisted.clientName || ticket.clientName,
          ticketLabel: getTicketProtocolLabel(persisted) || 'Rascunho',
        });
        setSendStatus(status);
        if (messageText) setComposeText('');
        if (internalNoteText) setInternalText('');
        showNotification(
          messageText || internalNoteText ? 'Ticket enviado e salvo.' : 'Ticket salvo.',
          'success',
        );
        syncTicketViews();
        return newId;
      }

      if (messageText || internalNoteText) {
        await sendTicketRegistroEntry(ticket.id, {
          text: messagePayload,
          internalText: internalNotePayload,
          author: getAgentName(),
        });
      }
      await updateTicketInKanban(ticket.id, (t) => {
        applyRightFieldsToTicket(
          t,
          mergeRightFieldsWithDefaults(rightFields, ticket, getAgentName),
          escalonar,
        );
        applySendStatus({ ticket: t, boxId: entry.boxId }, status);
        return t;
      });
      setSendStatus(status);
      if (messageText) setComposeText('');
      if (internalNoteText) setInternalText('');
      if (activeTabId) {
        const sessionKey = String(activeTabId);
        const session = tabSessionsRef.current[sessionKey];
        if (session) {
          tabSessionsRef.current[sessionKey] = {
            ...session,
            composeText: messageText ? '' : session.composeText,
            internalText: internalNoteText ? '' : session.internalText,
          };
        }
      }
      showNotification(
        messageText || internalNoteText ? 'Ticket enviado e salvo.' : 'Ticket salvo.',
        'success',
      );
      syncTicketViews();
      return ticket.id;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar ticket.';
      showNotification(msg, 'error');
      return null;
    }
  };

  const handleApplyTabulation = () => {
    const lf = ticket?.lateralForm || {};
    setRightFields((f) => {
      const produto = lf.produto || f.produto;
      let next = applyCascadeFieldChange(f, 'produto', produto);
      next = {
        ...next,
        tipo: lf.classificacaoTipo || f.tipo,
        motivo: lf.motivo || next.motivo,
        detalhe: lf.detalhe || next.detalhe,
      };
      if (lf.motivo && next.produto) {
        next = applyCascadeFieldChange({ ...f, produto: next.produto, tipo: next.tipo }, 'motivo', lf.motivo);
        next.detalhe = lf.detalhe || next.detalhe;
      }
      return next;
    });
    showNotification('Tabulação sugerida pela IA aplicada.', 'success');
  };

  const handleFieldChange = (key, value) => {
    setRightFields((f) => applyCascadeFieldChange(f, key, value));
  };

  const handleSaveContact = async (draft) => {
    if (!ticket) return;

    const nome = String(draft?.name || '').trim();
    const email = String(draft?.email || '').trim();
    const telefone = String(draft?.phone || '').trim();
    const cpf = normalizeCpf(ticket.lateralForm?.cpf || ticket.lateralForm?.clienteCpf || ticket.clientCPF);

    if (!nome) {
      showNotification('Informe o nome do cliente.', 'error');
      throw new Error('Nome obrigatório');
    }
    if (email && !isValidEmailFormat(email)) {
      showNotification('Informe um e-mail válido (ex.: nome@dominio.com).', 'error');
      throw new Error('E-mail inválido');
    }

    try {
      const clienteDoc = await persistClienteContact(clientsApi, {
        cpf,
        nome,
        email,
        telefone,
        clienteId: ticket.clienteId || ticket.lateralForm?.clienteId,
      });
      const clienteId = clienteDoc?._id || clienteDoc?.id || ticket.clienteId || ticket.lateralForm?.clienteId;

      await updateTicketInKanban(ticket.id, (t) => {
        t.clientName = nome;
        t.solicitante = nome;
        t.clientEmail = email;
        t.clientPhone = telefone;
        if (clienteId) t.clienteId = clienteId;
        t.lateralForm = {
          ...t.lateralForm,
          cpf,
          clienteCpf: cpf,
          clienteNome: nome,
          clienteEmail: email ? [email] : [],
          clienteTelefone: telefone ? [telefone] : [],
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
    suppressAutoSelectRef.current = false;
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
    syncTicketViews();
  };

  const convMsgs = ticket ? buildRegistroThread(ticket) : [];

  return (
    <div className="app-shell" id="deskAppShell">
      <DeskQueuePanel
        queueStatuses={queueStatuses}
        activeQueue={activeQueue}
        searchQuery={searchDraft}
        collapsed={queueCollapsed}
        onSearchChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        onSelectQueue={selectQueue}
        onCollapse={() => handleQueueCollapse(true)}
        onExpand={() => handleQueueCollapse(false)}
        onCreateTicket={() => setCreateOpen(true)}
        onQueueBoxCreated={handleQueueBoxCreated}
      />

      <DeskTicketList
        queueStatuses={queueStatuses}
        activeQueue={activeQueue}
        activeTicketId={activeTabId}
        activeSort={activeSort}
        entries={entries}
        searchActive={!!appliedSearch.trim()}
        collapsed={listCollapsed}
        onSelectTicket={selectTicket}
        onSortChange={setActiveSort}
        onCollapse={() => handleListCollapse(true)}
        onExpand={() => handleListCollapse(false)}
        onReload={reload}
        refreshing={ticketsLoading}
      />

      <main className={'crm-main-content' + (createOpen ? ' crm-main-content--create' : '')} id="crmMainContent">
        {createOpen ? (
          <CreateTicketPanel
            onClose={() => setCreateOpen(false)}
            onSaved={handleCreateSaved}
          />
        ) : !ticket ? (
          <div className="crm-empty-state" id="crmEmptyMain">Selecione um ticket na lista ao lado</div>
        ) : (
          <div className="crm-ticket-view">
            <DeskTicketTabsBar
              onSelectTab={activateTicketTab}
              onCloseTab={closeTicketTabHandler}
            />
            <DeskClientProfileBar
              ticket={ticket}
              client={client}
              queueId={entry?.queueId}
              escalonar={escalonar}
              onSaveContact={handleSaveContact}
              onSelectTicket={selectTicket}
            />
            <nav className="tabs-top" aria-label="Navegação do ticket">
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
            </nav>
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
                  />
                </div>
              ) : (
                <div
                  className={'tab-panel is-active' + (mainTab === 'notas' ? ' tab-panel--notes' : '')}
                  data-panel={mainTab === 'notas' ? 'notas' : 'conversa'}
                >
                  {mainTab === 'conversa' ? (
                    <>
                      <DeskConversation
                        ticket={ticket}
                        messages={convMsgs}
                        onUseIaReply={setComposeText}
                      />
                      <DeskComposePanel
                        ticketId={ticket.id}
                        variant="full"
                        composeMode={composeMode}
                        composeText={composeText}
                        internalText={internalText}
                        onComposeModeChange={setComposeMode}
                        onComposeTextChange={setComposeText}
                        onInternalTextChange={setInternalText}
                        spellIgnoredWords={spellIgnoredWords}
                        onIgnoreSpellWord={handleIgnoreSpellWord}
                        onFlaggedErrorsChange={handleFlaggedErrorsChange}
                      />
                    </>
                  ) : (
                    <DeskInternalNotesPanel
                      ticket={ticket}
                      client={client}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {ticket && !createOpen && (
        <DeskRightPanel
          ticket={ticket}
          client={client}
          rightFields={rightFields}
          sendStatus={sendStatus}
          onFieldChange={handleFieldChange}
          onApplyTabulation={handleApplyTabulation}
          onCommitStatus={handleCommitWithStatus}
          waChatOpen={waChatOpen}
          onOpenChat={handleOpenChat}
          onCloseChat={() => setWaChatOpen(false)}
          sendDisabled={sendDisabledBySpell}
        />
      )}
    </div>
  );
}
