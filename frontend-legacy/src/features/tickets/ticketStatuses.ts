/** ticketStatuses v1.0.2 — menu Salvar: sequência e cores de fonte atualizadas */

export interface TicketStatusOption {
  value: string;
  label: string;
  color?: string;
}

/** Todos os status conhecidos (kanban / backend). */
export const TICKET_STATUS_OPTIONS: TicketStatusOption[] = [
  { value: 'novo', label: 'Novos' },
  { value: 'em-aberto', label: 'Em aberto', color: '#D32F2F' },
  { value: 'em-andamento', label: 'Em Andamento', color: '#006AB9' },
  { value: 'em-espera', label: 'Em espera', color: '#1694FF' },
  { value: 'pendente', label: 'Pendente', color: '#FCC200' },
  { value: 'resolvido', label: 'Resolvido', color: '#15A237' },
  { value: 'cancelado', label: 'Cancelado', color: '#757575' },
];

/** Menu Salvar — ordem fixa; Novo e Em espera não entram. */
export const SAVE_STATUS_OPTIONS: TicketStatusOption[] = [
  { value: 'em-aberto', label: 'Em aberto', color: '#D32F2F' },
  { value: 'em-andamento', label: 'Em Andamento', color: '#006AB9' },
  { value: 'pendente', label: 'Pendente', color: '#FCC200' },
  { value: 'resolvido', label: 'Resolvido', color: '#15A237' },
  { value: 'cancelado', label: 'Cancelado', color: '#757575' },
];
