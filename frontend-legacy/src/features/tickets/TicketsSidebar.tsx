/** TicketsSidebar v1.2.0 — painel lateral esquerdo (filas + listas personalizadas) */
import AddIcon from '@mui/icons-material/Add';
import { Stack, Typography } from '@mui/material';
import { CustomList, DEFAULT_QUEUES, QueueId } from './ticketQueues';

interface TicketsSidebarProps {
  activeQueue: QueueId;
  onQueueChange: (queueId: QueueId) => void;
  customLists: CustomList[];
  onAddCustomList: (name: string) => void;
}

export default function TicketsSidebar({
  activeQueue,
  onQueueChange,
  customLists,
  onAddCustomList,
}: TicketsSidebarProps) {
  const handleAddCustomList = () => {
    const name = window.prompt('Nome da lista personalizada');
    if (!name?.trim()) return;
    onAddCustomList(name.trim());
  };

  const queueClass = (id: QueueId) =>
    `tickets-sidebar__item${activeQueue === id ? ' active' : ''}`;

  return (
    <aside className="tickets-sidebar" aria-label="Painel lateral de chamados">
      <section className="tickets-sidebar__section">
        <Typography variant="caption" className="tickets-sidebar__section-label tickets-sidebar__section-label--filas">
          Filas
        </Typography>

        <Stack spacing={0.75} component="nav" aria-label="Filas padrão">
          {DEFAULT_QUEUES.map((queue) => (
            <button
              key={queue.id}
              type="button"
              className={queueClass(queue.id)}
              onClick={() => onQueueChange(queue.id)}
            >
              {queue.label}
            </button>
          ))}
        </Stack>

        <div className="tickets-sidebar__divider-row">
          <span className="tickets-sidebar__divider-line" aria-hidden="true" />
          <button
            type="button"
            className="tickets-sidebar__add-list"
            onClick={handleAddCustomList}
            title="Criar lista personalizada"
            aria-label="Criar lista personalizada"
          >
            <AddIcon className="tickets-sidebar__add-list-icon" fontSize="small" />
          </button>
        </div>

        <div className="tickets-sidebar__custom-lists">
          {customLists.length === 0 ? (
            <Typography variant="caption" className="tickets-sidebar__custom-empty">
              Listas personalizadas aparecerão aqui
            </Typography>
          ) : (
            <Stack spacing={0.75} component="nav" aria-label="Listas personalizadas">
              {customLists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  className={queueClass(list.id)}
                  onClick={() => onQueueChange(list.id)}
                >
                  {list.label}
                </button>
              ))}
            </Stack>
          )}
        </div>
      </section>
    </aside>
  );
}
