/**
 * ReclameAquiCrmRoot — shell CRM RA (fila + lista + ticket + sidebar)
 * VERSION: v1.1.0 | DATE: 2026-08-18
 * — Busca rápida dual (chamados_n1 + chamados_reclamacoes)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { useRaNovaReclamacaoModals } from '../../../hooks/useRaNovaReclamacaoModals';
import { RA_GROUPS } from '../../../services/especiais/reclameAquiData';
import { loadReclamacoes, searchReclamacoesFromApi } from '../../../services/especiais/reclameAquiStore';
import { fetchRaTicketView, loadReclameAquiTicketsFromApi } from '../../../services/especiais/reclameAquiTicketService';
import { useEspeciaisTicketCommit } from '../shared/useEspeciaisTicketCommit';
import { useEspeciaisDualSearch } from '../shared/useEspeciaisDualSearch';
import RaQueuePanel from './RaQueuePanel';
import RaTicketList from './RaTicketList';
import RaTicketMain from './RaTicketMain';
import RaTicketSide from './RaTicketSide';

export default function ReclameAquiCrmRoot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeGroup, setActiveGroup] = useState(RA_GROUPS[0]?.id || 'vencendo-hoje');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [listSearchDraft, setListSearchDraft] = useState('');
  const [activeSort, setActiveSort] = useState('data');
  const [queueCollapsed, setQueueCollapsed] = useState(
    () => localStorage.getItem('velodeskRaQueueCollapsed') === '1',
  );
  const [listCollapsed, setListCollapsed] = useState(
    () => localStorage.getItem('velodeskRaListCollapsed') === '1',
  );
  const [listVersion, setListVersion] = useState(0);
  const syncedOnceRef = useRef(false);

  const searchFn = useCallback((q) => searchReclamacoesFromApi(q), []);
  const { remoteItems, isRemoteSearch } = useEspeciaisDualSearch({
    queueQuery: appliedSearch,
    listQuery: listSearchDraft,
    searchFn,
  });

  useEffect(() => {
    const refreshFromApi = () => {
      loadReclameAquiTicketsFromApi().catch(() => {}).finally(() => {
        syncedOnceRef.current = true;
      });
    };
    refreshFromApi();
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:ra-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', refreshFromApi);
    return () => {
      window.removeEventListener('velodesk:ra-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', refreshFromApi);
    };
  }, []);

  const { openNovaFlow, modals: novaModals } = useRaNovaReclamacaoModals({
    navigate,
    onImported: () => setListVersion((v) => v + 1),
  });

  const [ticketLoading, setTicketLoading] = useState(true);
  const [raItem, setRaItem] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  const [waChatOpen, setWaChatOpen] = useState(false);
  const [waComposeText, setWaComposeText] = useState('');
  const [composeMode, setComposeMode] = useState('public');
  const [composeText, setComposeText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [composeAttachments, setComposeAttachments] = useState([]);

  const allItems = useMemo(() => {
    if (isRemoteSearch && remoteItems) return remoteItems;
    return loadReclamacoes({});
  }, [isRemoteSearch, remoteItems, listVersion]);

  const groupCounts = useMemo(() => {
    const counts = {};
    const base = isRemoteSearch && remoteItems ? remoteItems : loadReclamacoes({});
    RA_GROUPS.forEach((g) => {
      counts[g.id] = base.filter((i) => i.groupKey === g.id).length;
    });
    return counts;
  }, [isRemoteSearch, remoteItems, listVersion]);

  const listItems = useMemo(() => {
    const listQuery = listSearchDraft.trim();
    let items = (listQuery || isRemoteSearch)
      ? allItems
      : allItems.filter((i) => i.groupKey === activeGroup);
    if (activeSort === 'sla') {
      items = [...items].sort(
        (a, b) => new Date(a.prazoRa || 0).getTime() - new Date(b.prazoRa || 0).getTime(),
      );
    } else {
      items = [...items].sort(
        (a, b) => new Date(b.dataReclamacao || 0).getTime() - new Date(a.dataReclamacao || 0).getTime(),
      );
    }
    return items;
  }, [allItems, activeGroup, activeSort, listSearchDraft, isRemoteSearch]);

  const reloadTicket = useCallback(async () => {
    if (!id) {
      setRaItem(null);
      setTicket(null);
      setTicketLoading(false);
      setRedirectTo(null);
      return;
    }

    setTicketLoading(true);
    setRedirectTo(null);
    try {
      const view = await fetchRaTicketView(id);
      if (!view?.raItem) {
        if (!syncedOnceRef.current) {
          // ainda sincronizando com a API — mantém o loading e tenta de novo quando os dados chegarem
          return;
        }
        setRaItem(null);
        setTicket(null);
        setTicketLoading(false);
        setRedirectTo('/especiais/reclame-aqui');
        return;
      }
      if (!view.raItem.ticketId) {
        setTicketLoading(false);
        setRedirectTo(`/especiais/reclame-aqui/registro/${view.raItem.id}`);
        return;
      }
      setRaItem(view.raItem);
      setTicket(view.ticket);
      if (view.raItem.groupKey) {
        setActiveGroup(view.raItem.groupKey);
      }
      setTicketLoading(false);
    } catch {
      showNotification('Não foi possível carregar o ticket.', 'error');
      setRaItem(null);
      setTicket(null);
      setTicketLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    reloadTicket();
  }, [reloadTicket, listVersion]);

  useEffect(() => {
    setWaChatOpen(false);
    setWaComposeText('');
    setComposeMode('public');
    setComposeText('');
    setInternalText('');
    setComposeAttachments([]);
  }, [id]);

  const composeSession = useMemo(() => ({
    composeText,
    internalText,
    composeAttachments,
    clearCompose: (fields = {}) => {
      if (fields.composeText) setComposeText('');
      if (fields.internalText) setInternalText('');
      if (fields.composeAttachments) setComposeAttachments([]);
    },
  }), [composeText, internalText, composeAttachments]);

  const handleCommitSaved = useCallback((result) => {
    setTicket(result.ticket);
    if (result.channelItem) setRaItem(result.channelItem);
    setListVersion((v) => v + 1);
  }, []);

  const handleCommitFinalized = useCallback((result) => {
    setTicket(result.ticket);
    if (result.channelItem) setRaItem(result.channelItem);
    setActiveGroup('finalizadas');
    setListVersion((v) => v + 1);
  }, []);

  const {
    committing,
    handleSaveTicket,
    handleFinalizeTicket,
    finalized,
    readOnly,
  } = useEspeciaisTicketCommit({
    channelId: 'ra',
    channelItem: raItem,
    ticket,
    composeSession,
    onTicketSaved: handleCommitSaved,
    onFinalized: handleCommitFinalized,
    showNotification,
  });

  const handleSearchSubmit = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
  }, [searchDraft]);

  const handleSelectItem = useCallback((raId) => {
    navigate(`/especiais/reclame-aqui/ticket/${raId}`, { replace: true });
  }, [navigate]);

  const handleTicketUpdated = useCallback((updatedTicket) => {
    setTicket(updatedTicket);
    setListVersion((v) => v + 1);
  }, []);

  const handleOpenChat = useCallback(() => {
    setWaChatOpen(true);
  }, []);

  const handleCloseChat = useCallback(() => {
    setWaChatOpen(false);
  }, []);

  const handleQueueCollapse = useCallback((collapsed) => {
    setQueueCollapsed(collapsed);
    localStorage.setItem('velodeskRaQueueCollapsed', collapsed ? '1' : '0');
    if (!collapsed) {
      setListCollapsed(false);
      localStorage.setItem('velodeskRaListCollapsed', '0');
    }
  }, []);

  const handleListCollapse = useCallback((collapsed) => {
    setListCollapsed(collapsed);
    localStorage.setItem('velodeskRaListCollapsed', collapsed ? '1' : '0');
  }, []);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="ra-crm-shell" id="reclameAquiCrmRoot">
      <RaQueuePanel
        activeGroup={activeGroup}
        searchQuery={searchDraft}
        collapsed={queueCollapsed}
        groupCounts={groupCounts}
        onSearchChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        onSelectGroup={setActiveGroup}
        onCollapse={() => handleQueueCollapse(true)}
        onExpand={() => handleQueueCollapse(false)}
        onNovaReclamacao={openNovaFlow}
      />

      <RaTicketList
        activeGroup={activeGroup}
        activeRaId={id}
        activeSort={activeSort}
        items={listItems}
        searchActive={!!appliedSearch.trim() || isRemoteSearch}
        listSearchQuery={listSearchDraft}
        collapsed={listCollapsed}
        onSelectItem={handleSelectItem}
        onSortChange={setActiveSort}
        onListSearchChange={setListSearchDraft}
        onListSearchSubmit={() => setListSearchDraft((v) => v.trim())}
        onCollapse={() => handleListCollapse(true)}
        onExpand={() => handleListCollapse(false)}
        onReload={() => setListVersion((v) => v + 1)}
      />

      <RaTicketMain
        raItem={raItem}
        ticket={ticket}
        loading={ticketLoading}
        waChatOpen={waChatOpen}
        waComposeText={waComposeText}
        onWaComposeTextChange={setWaComposeText}
        onTicketUpdated={handleTicketUpdated}
        composeMode={composeMode}
        onComposeModeChange={setComposeMode}
        composeText={composeText}
        onComposeTextChange={setComposeText}
        internalText={internalText}
        onInternalTextChange={setInternalText}
        composeAttachments={composeAttachments}
        onComposeAttachmentsChange={setComposeAttachments}
      />

      <RaTicketSide
        raItem={raItem}
        ticket={ticket}
        waChatOpen={waChatOpen}
        onOpenChat={handleOpenChat}
        onCloseChat={handleCloseChat}
        onTicketUpdated={handleTicketUpdated}
        onSave={handleSaveTicket}
        onFinalize={handleFinalizeTicket}
        saving={committing}
        disabled={readOnly || finalized}
        finalized={finalized}
      />

      {novaModals}
    </div>
  );
}
