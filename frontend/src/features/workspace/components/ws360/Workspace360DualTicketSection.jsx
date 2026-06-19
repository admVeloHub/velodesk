import React from 'react';
import Workspace360TicketSection from './Workspace360TicketSection';

export default function Workspace360DualTicketSection({
  leftSection,
  rightSection,
  onOpenTicket,
  onSeeAll,
}) {
  return (
    <div className="ws360-sections-row">
      {leftSection ? (
        <Workspace360TicketSection
          section={leftSection}
          onOpenTicket={onOpenTicket}
          onSeeAll={onSeeAll}
        />
      ) : null}
      {rightSection ? (
        <Workspace360TicketSection
          section={rightSection}
          onOpenTicket={onOpenTicket}
          onSeeAll={onSeeAll}
        />
      ) : null}
    </div>
  );
}
