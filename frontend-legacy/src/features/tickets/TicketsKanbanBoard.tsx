/** TicketsKanbanBoard v1.2.1 — kanban em grid + contorno por status/SLA */
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { KanbanColumn, Ticket } from '../../types';
import { getKanbanCardClass } from './ticketKanbanCard';

interface Props {
  columns: KanbanColumn[];
  onOpenTicket: (ticket: Ticket) => void;
}

export default function TicketsKanbanBoard({ columns, onOpenTicket }: Props) {
  return (
    <Box className="tickets-kanban">
      {columns.map((col) => (
        <Box key={col.id} className="tickets-kanban__column">
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{col.name}</Typography>
          <Stack spacing={1}>
            {(col.tickets || []).map((ticket) => (
              <Card
                key={ticket._id}
                className={getKanbanCardClass(col.id, ticket)}
                elevation={0}
                sx={{
                  cursor: 'pointer',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none', transform: 'none' },
                }}
                onClick={() => onOpenTicket(ticket)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{ticket.title}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Chip size="small" label={ticket.priority} color={ticket.priority === 'alta' ? 'error' : 'default'} />
                    {ticket.channel && <Chip size="small" label={ticket.channel} variant="outlined" />}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
