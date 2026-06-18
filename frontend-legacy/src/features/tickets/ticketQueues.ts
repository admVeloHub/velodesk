/** ticketQueues v1.0.1 — filas padrão e listas personalizadas (Tickets) */
export const DEFAULT_QUEUES = [
  { id: 'meus-chamados', label: 'Meus Chamados' },
  { id: 'novos', label: 'Novos' },
  { id: 'em-aberto', label: 'Em Aberto' },
  { id: 'em-processamento', label: 'Em Processamento' },
] as const;

export type DefaultQueueId = (typeof DEFAULT_QUEUES)[number]['id'];
export type QueueId = DefaultQueueId | string;

export interface CustomList {
  id: string;
  label: string;
}

export function getQueueLabel(queueId: QueueId, customLists: CustomList[]): string {
  const defaultQueue = DEFAULT_QUEUES.find((queue) => queue.id === queueId);
  if (defaultQueue) return defaultQueue.label;
  return customLists.find((list) => list.id === queueId)?.label ?? 'Fila';
}

export const MEUS_CHAMADOS_QUEUE_ID: DefaultQueueId = 'meus-chamados';
export const MEUS_CHAMADOS_FILA_PARAM = 'meus-chamados';
