/**
 * TicketPresenceAvatars v1.0.0 — avatares dos agentes vendo/com este ticket aberto
 * Verde: agente está com foco neste ticket agora. Amarelo: ticket aberto numa aba adicional.
 */
import React from 'react';
import { getInitials } from '../services/desk/utils';
import { useTicketPresence } from '../context/TicketPresenceContext';

export default function TicketPresenceAvatars({ ticketId }) {
  const agents = useTicketPresence(ticketId);

  if (!agents.length) return null;

  return (
    <div className="ticket-presence-avatars" aria-label="Outros agentes neste ticket">
      {agents.map((agent) => (
        <span
          key={agent.key}
          className={'ticket-presence-avatar ticket-presence-avatar--' + agent.state}
          title={agent.state === 'focused'
            ? `${agent.name} está vendo este ticket agora`
            : `${agent.name} tem este ticket aberto em uma aba`}
        >
          {getInitials(agent.name)}
        </span>
      ))}
    </div>
  );
}
