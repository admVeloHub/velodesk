/**
 * ProconCrmRoot — shell CRM RA (fila + lista + ticket + sidebar)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { usePcNovaDemandaModals } from '../../../hooks/usePcNovaDemandaModals';
import { PC_GROUPS } from '../../../services/especiais/proconData';
import { loadDemandas } from '../../../services/especiais/proconStore';
import { matchesTicketCpfSearch } from '../../../services/especiais/especiaisCrmSearch';
import { fetchPcTicketView, loadProconTicketsFromApi } from '../../../services/especiais/proconTicketService';
import { useEspeciaisTicketCommit } from '../shared/useEspeciaisTicketCommit';
import PcQueuePanel from './PcQueuePanel';
import PcTicketList from './PcTicketList';
import PcTicketMain from './PcTicketMain';
import PcTicketSide from './PcTicketSide';

export default function ProconCrmRoot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeGroup, setActiveGroup] = useState(PC_GROUPS[0]?.id || 'vencendo-hoje');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [listSearchDraft, setListSearchDraft] = useState('');
  const [activeSort, setActiveSort] = useState('data');
  const [queueCollapsed, setQueueCollapsed] = useState(
    () => localStorage.getItem('velodeskPcQueueCollapsed') === '1',
  );
  const [listCollapsed, setListCollapsed] = useState(
    () => localStorage.getItem('velodeskPcListCollapsed') === '1',
  );
  const [listVersion, setListVersion] = useState(0);
  const syncedOnceRef = useRef(false);

  useEffect(() => {
    const refreshFromApi = () => {
      loadProconTicketsFromApi().catch(() => {}).finally(() => {
        syncedOnceRef.current = true;
      });
    };
    refreshFromApi();
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:procon-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', refreshFromApi);
    return () => {
      window.removeEventListener('velodesk:procon-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', refreshFromApi);
    };
  }, []);

  const { openNovaDemandaFlow, modals: demandaModals } = usePcNovaDemandaModals({ navigate });

  const [ticketLoading, setTicketLoading] = useState(true);
  const [pcItem, setPcItem] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  const [waChatOpen, setWaChatOpen] = useState(false);
  const [waComposeText, setWaComposeText] = useState('');
  const [composeMode, setComposeMode] = useState('public');
  const [composeText, setComposeText] = useState('');
  const [internalText, setInternalText] = useState('');
  const [composeAttachments, setComposeAttachments] = useState([]);

  const allItems = useMemo(
    () => loadDemandas({ search: appliedSearch }),
    [appliedSearch, listVersion],
  );

  const groupCounts = useMemo(() => {
    const counts = {};
    PC_GROUPS.forEach((g) => {
      counts[g.id] = allItems.filter((i) => i.groupKey === g.id).length;
    });
    return counts;
  }, [allItems]);

  const listItems = useMemo(() => {
    const listQuery = listSearchDraft.trim();
    let items = listQuery
      ? allItems.filter((i) => matchesTicketCpfSearch(i, listQuery, 'protocoloProcon'))
      : allItems.filter((i) => i.groupKey === activeGroup);
    if (activeSort === 'sla') {
      items = [...items].sort(
        (a, b) => new Date(a.prazoLegal || 0).getTime() - new Date(b.prazoLegal || 0).getTime(),
      );
    } else {
      items = [...items].sort(
        (a, b) => new Date(b.dataDemanda || 0).getTime() - new Date(a.dataDemanda || 0).getTime(),
      );
    }
    return items;
  }, [allItems, activeGroup, activeSort, listSearchDraft]);

  const reloadTicket = useCallback(async () => {
    if (!id) {
      setPcItem(null);
      setTicket(null);
      setTicketLoading(false);
      setRedirectTo(null);
      return;
    }

    setTicketLoading(true);
    setRedirectTo(null);
    try {
      const view = await fetchPcTicketView(id);
      if (!view?.pcItem) {
        if (!syncedOnceRef.current) {
          // ainda sincronizando com a API — mantém o loading e tenta de novo quando os dados chegarem
          return;
        }
        setPcItem(null);
        setTicket(null);
        setTicketLoading(false);
        setRedirectTo('/especiais/procon');
        return;
      }
      if (!view.pcItem.ticketId) {
        setTicketLoading(false);
        setRedirectTo(`/especiais/procon/registro/${view.pcItem.id}`);
        return;
      }
      setPcItem(view.pcItem);
      setTicket(view.ticket);
      if (view.pcItem.groupKey) {
        setActiveGroup(view.pcItem.groupKey);
      }
      setTicketLoading(false);
    } catch {
      showNotification('Não foi possível carregar o ticket.', 'error');
      setPcItem(null);
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
    if (result.channelItem) setPcItem(result.channelItem);
    setListVersion((v) => v + 1);
  }, []);

  const handleCommitFinalized = useCallback((result) => {
    setTicket(result.ticket);
    if (result.channelItem) setPcItem(result.channelItem);
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
    channelId: 'pc',
    channelItem: pcItem,
    ticket,
    composeSession,
    onTicketSaved: handleCommitSaved,
    onFinalized: handleCommitFinalized,
    showNotification,
  });

  const handleSearchSubmit = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
  }, [searchDraft]);

  const handleSelectItem = useCallback((pcId) => {
    navigate(`/especiais/procon/ticket/${pcId}`, { replace: true });
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
    localStorage.setItem('velodeskPcQueueCollapsed', collapsed ? '1' : '0');
    if (!collapsed) {
      setListCollapsed(false);
      localStorage.setItem('velodeskPcListCollapsed', '0');
    }
  }, []);

  const handleListCollapse = useCallback((collapsed) => {
    setListCollapsed(collapsed);
    localStorage.setItem('velodeskPcListCollapsed', collapsed ? '1' : '0');
  }, []);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="ra-crm-shell" id="proconCrmRoot">
      <PcQueuePanel
        activeGroup={activeGroup}
        searchQuery={searchDraft}
        collapsed={queueCollapsed}
        groupCounts={groupCounts}
        onSearchChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        onSelectGroup={setActiveGroup}
        onCollapse={() => handleQueueCollapse(true)}
        onExpand={() => handleQueueCollapse(false)}
        onNovaReclamacao={openNovaDemandaFlow}
      />

      <PcTicketList
        activeGroup={activeGroup}
        activePcId={id}
        activeSort={activeSort}
        items={listItems}
        searchActive={!!appliedSearch.trim()}
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

      <PcTicketMain
        pcItem={pcItem}
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

      <PcTicketSide
        pcItem={pcItem}
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

      {demandaModals}
    </div>
  );
}
