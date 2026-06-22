/**
 * Desk CRM — raiz 5 colunas (layout referência)
 * VERSION: v3.1.0 | DATE: 2026-06-19
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  filterTickets,
  resolveDeskSearchEntries,
  pickDefaultTicket,
  buildConversationMessages,
  normalizeTicketForDeskV2,
  getAgentName,
  applySendStatus,
} from '../../services/desk/utils';
import { findTicketEntry, updateTicketInKanban, sendTicketMessage } from '../../services/kanbanStorage';
import { lookupClient } from '../../services/clientDb';
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
import DeskComposePanel, { DeskComposeFooter } from './components/DeskComposePanel';
import DeskRightPanel from './components/DeskRightPanel';
import DeskInternalNotesPanel from './components/DeskInternalNotesPanel';

function buildDefaultSessionFromTicket(ticket) {
  const lf = ticket.lateralForm || {};
  return {
    mainTab: 'conversa',
    composeMode: 'public',
    composeText: '',
    internalText: '',
    sendStatus: 'em-andamento',
    rightFields: {
      responsavel: lf.responsavel || ticket.responsibleAgent || getAgentName(),
      canal: lf.canal || ticket.channel || 'WhatsApp',
      tipo: lf.classificacaoTipo || 'Solicitação',
      produto: lf.produto || 'Internet Fibra',
      motivo: lf.motivo || 'Lentidão',
    },
    escalonar: lf.escalonar || null,
    waChatOpen: false,
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
    setActiveTabId,
  } = useTickets();
  const { showNotification } = useNotifications();

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
    };
  }, [mainTab, composeMode, composeText, internalText, sendStatus, rightFields, escalonar, waChatOpen]);

  const restoreTabSession = useCallback((ticketId) => {
    const ticketEntry = findTicketEntry(ticketId);
    if (!ticketEntry) return;
    const t = ticketEntry.ticket;
    normalizeTicketForDeskV2(t);
    const defaults = buildDefaultSessionFromTicket(t);
    const saved = tabSessionsRef.current[String(ticketId)];
    const session = saved || defaults;
    setMainTab(session.mainTab);
    setComposeMode(session.composeMode);
    setComposeText(session.composeText);
    setInternalText(session.internalText);
    setSendStatus(session.sendStatus);
    setRightFields(session.rightFields || defaults.rightFields);
    setEscalonar(session.escalonar ?? defaults.escalonar);
    setWaChatOpen(session.waChatOpen);
  }, []);

  useEffect(() => {
    restoreCustomKanbanBoxes();
    setQueueStatuses(getAllQueueStatuses());
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
    persistTabSession(activeTabId);
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

  const handleQueueCollapse = (collapsed) => {
    localStorage.setItem('velodeskCrmQueueCollapsed', collapsed ? '1' : '0');
    setQueueCollapsed(collapsed);
  };

  const handleListCollapse = (collapsed) => {
    localStorage.setItem('velodeskCrmTicketListCollapsed', collapsed ? '1' : '0');
    setListCollapsed(collapsed);
  };

  const handleSaveTicket = async () => {
    if (!ticket) return;
    try {
      await updateTicketInKanban(ticket.id, (t) => {
        const prevLf = t.lateralForm || {};
        const nextLf = {
          ...prevLf,
          ...rightFields,
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
      });
      showNotification('Ticket salvo.', 'success');
      syncTicketViews();
    } catch {
      showNotification('Erro ao salvar ticket.', 'error');
    }
  };

  const handleSend = async (statusId) => {
    if (!ticket || !entry) return;
    if (composeMode !== 'public') {
      showNotification('Envio disponível apenas em resposta pública.', 'warning');
      return;
    }
    const text = composeText.trim();
    if (!text) {
      showNotification('Digite uma resposta antes de enviar.', 'warning');
      return;
    }
    try {
      await sendTicketMessage(ticket.id, text, getAgentName());
      await updateTicketInKanban(ticket.id, (t) => {
        applySendStatus({ ticket: t, boxId: entry.boxId }, statusId || sendStatus);
        return t;
      });
      setComposeText('');
      setSendStatus(statusId || sendStatus);
      showNotification('Resposta enviada.', 'success');
      syncTicketViews();
    } catch {
      showNotification('Erro ao enviar mensagem.', 'error');
    }
  };

  const handleApplyTabulation = () => {
    setRightFields((f) => ({
      ...f,
      tipo: ticket?.lateralForm?.classificacaoTipo || f.tipo,
      produto: ticket?.lateralForm?.produto || f.produto,
      motivo: ticket?.lateralForm?.motivo || f.motivo,
    }));
    showNotification('Tabulação sugerida pela IA aplicada.', 'success');
  };

  const handleSaveContact = async (draft) => {
    if (!ticket) return;
    await updateTicketInKanban(ticket.id, (t) => {
      t.clientName = draft.name;
      t.solicitante = draft.name;
      t.clientEmail = draft.email;
      t.clientPhone = draft.phone;
      return t;
    });
    showNotification('Contato atualizado.', 'success');
    syncTicketViews();
  };

  const handleCloseTicket = async () => {
    if (!ticket || !entry) return;
    if (entry.queueId === 'resolvidos' || ticket.status === 'resolvido') {
      showNotification('Este ticket já está finalizado.', 'info');
      return;
    }
    try {
      await updateTicketInKanban(ticket.id, (t) => {
        t.lateralForm = {
          ...t.lateralForm,
          ...rightFields,
          escalonar,
        };
        t.responsibleAgent = rightFields.responsavel;
        t.channel = rightFields.canal;
        t.updatedAt = new Date().toISOString();
        t.resolvedAt = new Date().toISOString();
        applySendStatus({ ticket: t, boxId: entry.boxId }, 'resolvidos');
        return t;
      });
      suppressAutoSelectRef.current = true;
      delete tabSessionsRef.current[String(ticket.id)];
      closeTicketTab(ticket.id);
      showNotification('Ticket finalizado.', 'success');
      syncTicketViews();
    } catch {
      showNotification('Erro ao finalizar ticket.', 'error');
    }
  };

  const handleOpenChat = () => {
    setMainTab('conversa');
    setComposeMode('public');
    setWaChatOpen(true);
  };

  const handleCreateSaved = (id) => {
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

  const convMsgs = ticket ? buildConversationMessages(ticket) : [];

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
                    onSend={() => handleSend(sendStatus)}
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
                        composeMode={composeMode}
                        composeText={composeText}
                        internalText={internalText}
                        onComposeModeChange={setComposeMode}
                        onComposeTextChange={setComposeText}
                        onInternalTextChange={setInternalText}
                        onOpenAi={() => window.dispatchEvent(new CustomEvent('velodesk:open-ai'))}
                      />
                      <DeskComposeFooter
                        sendStatus={sendStatus}
                        onSendStatusChange={setSendStatus}
                        onSend={handleSend}
                      />
                    </>
                  ) : (
                    <DeskInternalNotesPanel
                      ticket={ticket}
                      client={client}
                      onNotify={showNotification}
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
          escalonar={escalonar}
          onFieldChange={(key, value) => setRightFields((f) => ({ ...f, [key]: value }))}
          onEscalonarChange={setEscalonar}
          onApplyTabulation={handleApplyTabulation}
          onSave={handleSaveTicket}
          onCloseTicket={handleCloseTicket}
          waChatOpen={waChatOpen}
          onOpenChat={handleOpenChat}
          onCloseChat={() => setWaChatOpen(false)}
        />
      )}
    </div>
  );
}
