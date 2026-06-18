/** TicketDetail v1.2.0 — rascunho local em cache; protocolo no cabeçalho */
import { Box, Stack, Typography } from '@mui/material';
import { Ticket } from '../../types';
import { ticketsApi } from '../../api/client';
import { isDraftTicket } from './draftTicket';
import LateralForm from './LateralForm';
import MessageComposer from './MessageComposer';
import type { TicketUpdateMeta } from './ticketUpdateMeta';

const COLUMN_MAIN_SX = { flex: 3, minWidth: 0, minHeight: 0 };
const COLUMN_LATERAL_SX = { flex: 1, minWidth: 0, minHeight: 0 };

interface Props {
  ticket: Ticket;
  onUpdate: (t: Ticket, meta?: TicketUpdateMeta) => void;
}

function applyLateralCache(ticket: Ticket, lateralPayload: Record<string, unknown>): Ticket {
  return {
    ...ticket,
    lateralForm: lateralPayload,
    clientName: String(lateralPayload.clienteNome ?? ticket.clientName ?? ''),
    clientCPF: String(lateralPayload.clienteCpf ?? lateralPayload.cpf ?? ticket.clientCPF ?? ''),
    responsibleAgent: String(lateralPayload.responsavel ?? ticket.responsibleAgent ?? ''),
    chamadoTitulo: String(lateralPayload.motivo ?? ticket.chamadoTitulo ?? ''),
    title: String(lateralPayload.motivo ?? ticket.title ?? ticket.chamadoProtocolo ?? ''),
  };
}

export default function TicketDetail({ ticket, onUpdate }: Props) {
  const saveLateral = async (lateralPayload: Record<string, unknown>) => {
    if (isDraftTicket(ticket)) {
      onUpdate(applyLateralCache(ticket, lateralPayload));
      return;
    }

    const updated = await ticketsApi.update(ticket._id, { lateralForm: lateralPayload });
    onUpdate(updated);
  };

  const headerTitle = ticket.chamadoTitulo?.trim() || ticket.title?.trim() || 'Novo chamado';

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ height: '100%', minHeight: 0, alignItems: 'stretch' }}
    >
      <Box sx={{ ...COLUMN_MAIN_SX, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ mb: 2, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {headerTitle}
          </Typography>
          {ticket.chamadoProtocolo && (
            <Typography variant="body2" color="text.secondary">
              {ticket.chamadoProtocolo}
              {isDraftTicket(ticket) ? ' · rascunho' : ''}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MessageComposer ticket={ticket} onUpdate={onUpdate} />
        </Box>
      </Box>
      <Box sx={{ ...COLUMN_LATERAL_SX, overflow: 'auto' }}>
        <LateralForm ticket={ticket} onChange={saveLateral} />
      </Box>
    </Stack>
  );
}
