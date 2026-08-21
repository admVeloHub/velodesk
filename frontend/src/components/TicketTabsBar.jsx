/**
 * Abas de tickets abertos
 * VERSION: v2.2.0 | DATE: 2026-08-21
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '../context/TicketsContext';
import { useProfile } from '../context/ProfileContext';

export default function TicketTabsBar() {
  const navigate = useNavigate();
  const { openTabs, activeTabId, closeTicketTab, setActiveTabId } = useTickets();
  const { profileId } = useProfile();

  if (profileId === 'workflow' || !openTabs.length) return null;

  return (
    <div className="ticket-tabs-bar" id="ticketTabsBar">
      {openTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={'ticket-tab' + (String(activeTabId) === String(tab.id) ? ' active' : '')}
          onClick={() => { setActiveTabId(tab.id); navigate('/tickets?desk=v2'); }}
        >
          <span className="ticket-tab__title">{tab.title}</span>
          <span
            className="ticket-tab__close"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('velodesk:desk-tab-close', { detail: { id: tab.id } }));
              closeTicketTab(tab.id);
            }}
            role="button"
            tabIndex={0}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
