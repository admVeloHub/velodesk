/**
 * BacenCrmRoot — shell CRM RA (fila + lista + ticket + sidebar)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { useBcNovaDemandaModals } from '../../../hooks/useBcNovaDemandaModals';
import { BC_GROUPS } from '../../../services/especiais/bacenData';
import { loadDemandas } from '../../../services/especiais/bacenStore';
import { matchesTicketCpfSearch } from '../../../services/especiais/especiaisCrmSearch';
import { fetchBcTicketView, loadBacenTicketsFromApi } from '../../../services/especiais/bacenTicketService';
import { useEspeciaisTicketCommit } from '../shared/useEspeciaisTicketCommit';
import BcQueuePanel from './BcQueuePanel';
import BcTicketList from './BcTicketList';
import BcTicketMain from './BcTicketMain';
import BcTicketSide from './BcTicketSide';

export default function BacenCrmRoot() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeGroup, setActiveGroup] = useState(BC_GROUPS[0]?.id || 'vencendo-hoje');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [listSearchDraft, setListSearchDraft] = useState('');
  const [activeSort, setActiveSort] = useState('data');
  const [queueCollapsed, setQueueCollapsed] = useState(
    () => localStorage.getItem('velodeskBcQueueCollapsed') === '1',
  );
  const [listCollapsed, setListCollapsed] = useState(
    () => localStorage.getItem('velodeskBcListCollapsed') === '1',
  );
  const [listVersion, setListVersion] = useState(0);

  useEffect(() => {
    const refreshFromApi = () => {
      loadBacenTicketsFromApi().catch(() => {});
    };
    refreshFromApi();
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:bacen-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', refreshFromApi);
    return () => {
      window.removeEventListener('velodesk:bacen-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', refreshFromApi);
    };
  }, []);

  const { openNovaDemandaFlow, modals: demandaModals } = useBcNovaDemandaModals({ navigate });

  const [ticketLoading, setTicketLoading] = useState(true);
  const [bcItem, setBcItem] = useState(null);
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
    BC_GROUPS.forEach((g) => {
      counts[g.id] = allItems.filter((i) => i.groupKey === g.id).length;
    });
    return counts;
  }, [allItems]);

  const listItems = useMemo(() => {
    const listQuery = listSearchDraft.trim();
    let items = listQuery
      ? allItems.filter((i) => matchesTicketCpfSearch(i, listQuery, 'protocoloBacen'))
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
      setBcItem(null);
      setTicket(null);
      setTicketLoading(false);
      setRedirectTo(null);
      return;
    }

    setTicketLoading(true);
    setRedirectTo(null);
    try {
      const view = await fetchBcTicketView(id);
      if (!view?.bcItem) {
        setBcItem(null);
        setTicket(null);
        setRedirectTo('/especiais/bacen');
        return;
      }
      if (!view.bcItem.ticketId) {
        setRedirectTo(`/especiais/bacen/registro/${view.bcItem.id}`);
        return;
      }
      setBcItem(view.bcItem);
      setTicket(view.ticket);
      if (view.bcItem.groupKey) {
        setActiveGroup(view.bcItem.groupKey);
      }
    } catch {
      showNotification('Não foi possível carregar o ticket.', 'error');
      setBcItem(null);
      setTicket(null);
    } finally {
      setTicketLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    reloadTicket();
  }, [reloadTicket]);

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
    if (result.channelItem) setBcItem(result.channelItem);
    setListVersion((v) => v + 1);
  }, []);

  const handleCommitFinalized = useCallback((result) => {
    setTicket(result.ticket);
    if (result.channelItem) setBcItem(result.channelItem);
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
    channelId: 'bc',
    channelItem: bcItem,
    ticket,
    composeSession,
    onTicketSaved: handleCommitSaved,
    onFinalized: handleCommitFinalized,
    showNotification,
  });

  const handleSearchSubmit = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
  }, [searchDraft]);

  const handleSelectItem = useCallback((bcId) => {
    navigate(`/especiais/bacen/ticket/${bcId}`, { replace: true });
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
    localStorage.setItem('velodeskBcQueueCollapsed', collapsed ? '1' : '0');
    if (!collapsed) {
      setListCollapsed(false);
      localStorage.setItem('velodeskBcListCollapsed', '0');
    }
  }, []);

  const handleListCollapse = useCallback((collapsed) => {
    setListCollapsed(collapsed);
    localStorage.setItem('velodeskBcListCollapsed', collapsed ? '1' : '0');
  }, []);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="ra-crm-shell" id="bacenCrmRoot">
      <BcQueuePanel
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

      <BcTicketList
        activeGroup={activeGroup}
        activeBcId={id}
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

      <BcTicketMain
        bcItem={bcItem}
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

      <BcTicketSide
        bcItem={bcItem}
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
