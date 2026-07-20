/**
 * ReclameAquiCrmRoot — shell CRM RA (fila + lista + ticket + sidebar)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { RA_GROUPS } from '../../../services/especiais/reclameAquiData';
import { loadReclamacoes } from '../../../services/especiais/reclameAquiStore';
import { fetchRaTicketView } from '../../../services/especiais/reclameAquiTicketService';
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
  const [activeSort, setActiveSort] = useState('data');
  const [queueCollapsed, setQueueCollapsed] = useState(
    () => localStorage.getItem('velodeskRaQueueCollapsed') === '1',
  );
  const [listCollapsed, setListCollapsed] = useState(
    () => localStorage.getItem('velodeskRaListCollapsed') === '1',
  );
  const [listVersion, setListVersion] = useState(0);

  const [ticketLoading, setTicketLoading] = useState(true);
  const [raItem, setRaItem] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  const [waChatOpen, setWaChatOpen] = useState(false);
  const [waComposeText, setWaComposeText] = useState('');

  const allItems = useMemo(
    () => loadReclamacoes({ search: appliedSearch }),
    [appliedSearch, listVersion],
  );

  const groupCounts = useMemo(() => {
    const counts = {};
    RA_GROUPS.forEach((g) => {
      counts[g.id] = allItems.filter((i) => i.groupKey === g.id).length;
    });
    return counts;
  }, [allItems]);

  const listItems = useMemo(() => {
    let items = allItems.filter((i) => i.groupKey === activeGroup);
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
  }, [allItems, activeGroup, activeSort]);

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
        setRaItem(null);
        setTicket(null);
        setRedirectTo('/especiais/reclame-aqui');
        return;
      }
      if (!view.raItem.ticketId) {
        setRedirectTo(`/especiais/reclame-aqui/registro/${view.raItem.id}`);
        return;
      }
      setRaItem(view.raItem);
      setTicket(view.ticket);
      if (view.raItem.groupKey) {
        setActiveGroup(view.raItem.groupKey);
      }
    } catch {
      showNotification('Não foi possível carregar o ticket.', 'error');
      setRaItem(null);
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
  }, [id]);

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
      />

      <RaTicketList
        activeGroup={activeGroup}
        activeRaId={id}
        activeSort={activeSort}
        items={listItems}
        searchActive={!!appliedSearch.trim()}
        collapsed={listCollapsed}
        onSelectItem={handleSelectItem}
        onSortChange={setActiveSort}
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
      />

      <RaTicketSide
        raItem={raItem}
        ticket={ticket}
        waChatOpen={waChatOpen}
        onOpenChat={handleOpenChat}
        onCloseChat={handleCloseChat}
      />
    </div>
  );
}
