/** TicketsRetractableLayout v1.2.1 — tab vertical no topo da linha divisória */
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { ReactNode } from 'react';
import { useRetractableSidebar } from '../../hooks/useRetractableSidebar';
import TicketsSidebar from './TicketsSidebar';
import { CustomList, QueueId } from './ticketQueues';

interface TicketsRetractableLayoutProps {
  children: ReactNode;
  activeQueue: QueueId;
  onQueueChange: (queueId: QueueId) => void;
  customLists: CustomList[];
  onAddCustomList: (name: string) => void;
}

export default function TicketsRetractableLayout({
  children,
  activeQueue,
  onQueueChange,
  customLists,
  onAddCustomList,
}: TicketsRetractableLayoutProps) {
  const { isSidebarVisible, toggleSidebar } = useRetractableSidebar(true);

  const layoutClass = [
    'tickets-layout',
    isSidebarVisible ? 'tickets-layout--sidebar-visible' : 'tickets-layout--sidebar-retracted',
  ].join(' ');

  return (
    <div className={layoutClass}>
      <div className="tickets-layout__sidebar-area">
        <TicketsSidebar
          activeQueue={activeQueue}
          onQueueChange={onQueueChange}
          customLists={customLists}
          onAddCustomList={onAddCustomList}
        />
      </div>

      <div className="tickets-layout__splitter">
        <span className="tickets-layout__splitter-line" aria-hidden="true" />
        <button
          type="button"
          className="tickets-layout__collapse-tab"
          onClick={() => toggleSidebar()}
          title={isSidebarVisible ? 'Recolher painel lateral' : 'Expandir painel lateral'}
          aria-label={isSidebarVisible ? 'Recolher painel lateral' : 'Expandir painel lateral'}
          aria-expanded={isSidebarVisible}
        >
          {isSidebarVisible ? (
            <KeyboardArrowLeftIcon className="tickets-layout__collapse-icon" fontSize="small" />
          ) : (
            <KeyboardArrowRightIcon className="tickets-layout__collapse-icon" fontSize="small" />
          )}
        </button>
      </div>

      <div className="tickets-layout__main">{children}</div>
    </div>
  );
}
