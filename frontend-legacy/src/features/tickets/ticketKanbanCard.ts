/** ticketKanbanCard v1.0.0 — contorno dos cards do kanban Meus Chamados */
import { Ticket } from '../../types';

const COLUMN_BORDER_CLASS: Record<string, string> = {
  'meus-novos': 'tickets-kanban-card--novos',
  'meus-em-aberto': 'tickets-kanban-card--em-aberto',
  'meus-em-andamento': 'tickets-kanban-card--em-andamento',
  'meus-pendente': 'tickets-kanban-card--pendente',
};

const STATUS_BORDER_CLASS: Record<string, string> = {
  novo: 'tickets-kanban-card--novos',
  'em-aberto': 'tickets-kanban-card--em-aberto',
  'em-andamento': 'tickets-kanban-card--em-andamento',
  pendente: 'tickets-kanban-card--pendente',
};

export function getKanbanCardClass(columnId: string, ticket: Ticket): string {
  const base = 'tickets-kanban-card';
  const key = COLUMN_BORDER_CLASS[columnId] ? columnId : ticket.status;
  const variant = COLUMN_BORDER_CLASS[key] ?? STATUS_BORDER_CLASS[ticket.status] ?? 'tickets-kanban-card--novos';

  if (
    ticket.slaBreached
    && (key === 'meus-em-aberto' || key === 'meus-em-andamento' || ticket.status === 'em-aberto' || ticket.status === 'em-andamento')
  ) {
    return `${base} tickets-kanban-card--sla-breach`;
  }

  return `${base} ${variant}`;
}
