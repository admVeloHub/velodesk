/** TicketsPage v1.8.0 — Novo cria rascunho local; persistência no Salvar/status */
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, CircularProgress, Typography,
} from '@mui/material';
import { boxesApi, ticketsApi } from '../../api/client';
import { KanbanColumn, Ticket } from '../../types';
import ConfirmDiscardDraftDialog from './ConfirmDiscardDraftDialog';
import { createDraftTicket, isDraftTicket } from './draftTicket';
import TicketDetail from './TicketDetail';
import TicketsKanbanBoard from './TicketsKanbanBoard';
import TicketsOpenTabs from './TicketsOpenTabs';
import TicketsRetractableLayout from './TicketsRetractableLayout';
import {
  CustomList,
  getQueueLabel,
  MEUS_CHAMADOS_FILA_PARAM,
  MEUS_CHAMADOS_QUEUE_ID,
  QueueId,
} from './ticketQueues';

import type { TicketUpdateMeta } from './ticketUpdateMeta';

export default function TicketsPage() {
  const qc = useQueryClient();
  const [openTabs, setOpenTabs] = useState<Ticket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<QueueId>(MEUS_CHAMADOS_QUEUE_ID);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [discardDraftId, setDiscardDraftId] = useState<string | null>(null);

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['boxes', activeQueue],
    queryFn: () =>
      boxesApi.list(
        activeQueue === MEUS_CHAMADOS_QUEUE_ID ? { fila: MEUS_CHAMADOS_FILA_PARAM } : undefined
      ),
  });

  const openTicket = useCallback((ticket: Ticket) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t._id === ticket._id)) return prev;
      return [...prev, ticket];
    });
    setActiveTicketId(ticket._id);
  }, []);

  const findTicketByProtocolo = useCallback((protocolo: string, tabs: Ticket[], kanbanColumns: KanbanColumn[]) => {
    const normalized = protocolo.trim();
    if (!normalized) return undefined;

    const matchesProtocolo = (ticket: Ticket) => ticket.chamadoProtocolo?.trim() === normalized;
    const inTab = tabs.find(matchesProtocolo);
    if (inTab) return inTab;

    for (const column of kanbanColumns) {
      const inColumn = (column.tickets || []).find(matchesProtocolo);
      if (inColumn) return inColumn;
    }

    return undefined;
  }, []);

  const handleSearchProtocol = useCallback(async (raw: string) => {
    const protocolo = raw.trim();
    if (!protocolo) return;

    const localTicket = findTicketByProtocolo(protocolo, openTabs, columns);
    if (localTicket) {
      openTicket(localTicket);
      return;
    }

    const ticket = await ticketsApi.getByProtocol(protocolo);
    openTicket(ticket);
  }, [columns, findTicketByProtocolo, openTabs, openTicket]);

  const handleCreateNew = useCallback(() => {
    openTicket(createDraftTicket());
  }, [openTicket]);

  const removeTab = useCallback((id: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t._id !== id);
      if (activeTicketId === id) {
        if (next.length === 0) {
          setActiveTicketId(null);
        } else {
          const closedIndex = prev.findIndex((t) => t._id === id);
          const nextIndex = Math.min(closedIndex, next.length - 1);
          setActiveTicketId(next[nextIndex]._id);
        }
      }
      return next;
    });
  }, [activeTicketId]);

  const closeTab = useCallback((id: string) => {
    const tab = openTabs.find((t) => t._id === id);
    if (tab && isDraftTicket(tab)) {
      setDiscardDraftId(id);
      return;
    }
    removeTab(id);
  }, [openTabs, removeTab]);

  const updateTicket = useCallback((updated: Ticket, meta?: TicketUpdateMeta) => {
    const sourceId = meta?.fromDraftId ?? updated._id;
    setOpenTabs((prev) => prev.map((t) => (t._id === sourceId ? updated : t)));
    if (meta?.fromDraftId && activeTicketId === meta.fromDraftId) {
      setActiveTicketId(updated._id);
    }
    if (!isDraftTicket(updated)) {
      qc.invalidateQueries({ queryKey: ['boxes'] });
    }
  }, [activeTicketId, qc]);

  const handleAddCustomList = (name: string) => {
    const list: CustomList = {
      id: `custom-${Date.now()}`,
      label: name,
    };
    setCustomLists((prev) => [...prev, list]);
    setActiveQueue(list.id);
    setActiveTicketId(null);
  };

  const handleQueueChange = (queueId: QueueId) => {
    if (queueId === activeQueue && queueId === MEUS_CHAMADOS_QUEUE_ID) {
      setActiveTicketId(null);
      return;
    }

    setActiveQueue(queueId);
    setActiveTicketId(null);
  };

  if (isLoading) return <CircularProgress />;

  const isMeusChamados = activeQueue === MEUS_CHAMADOS_QUEUE_ID;
  const activeTicket = openTabs.find((t) => t._id === activeTicketId) ?? null;
  const showKanban = !activeTicket;
  const draftToDiscard = openTabs.find((t) => t._id === discardDraftId);

  return (
    <Box className="tickets-page">
      <ConfirmDiscardDraftDialog
        open={Boolean(discardDraftId)}
        protocolo={draftToDiscard?.chamadoProtocolo}
        onCancel={() => setDiscardDraftId(null)}
        onConfirm={() => {
          if (discardDraftId) removeTab(discardDraftId);
          setDiscardDraftId(null);
        }}
      />
      <TicketsRetractableLayout
        activeQueue={activeQueue}
        onQueueChange={handleQueueChange}
        customLists={customLists}
        onAddCustomList={handleAddCustomList}
      >
        {isMeusChamados ? (
          <Box className="tickets-main-panel">
            <TicketsOpenTabs
              tabs={openTabs}
              activeId={activeTicketId}
              onSelect={setActiveTicketId}
              onClose={closeTab}
              onSearchProtocol={handleSearchProtocol}
              onCreateNew={handleCreateNew}
            />
            {showKanban ? (
              <Box className="tickets-workspace tickets-workspace--kanban">
                <TicketsKanbanBoard columns={columns} onOpenTicket={openTicket} />
              </Box>
            ) : (
              <Box className="tickets-workspace tickets-workspace--detail">
                {activeTicket && (
                  <TicketDetail
                    ticket={activeTicket}
                    onUpdate={updateTicket}
                  />
                )}
              </Box>
            )}
          </Box>
        ) : (
          <Box className="tickets-workspace tickets-workspace--placeholder">
            <Typography variant="body2" color="text.secondary">
              Conteúdo da fila <strong>{getQueueLabel(activeQueue, customLists)}</strong> em desenvolvimento.
            </Typography>
          </Box>
        )}
      </TicketsRetractableLayout>
    </Box>
  );
}
