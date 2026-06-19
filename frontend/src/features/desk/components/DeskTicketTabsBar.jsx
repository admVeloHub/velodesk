/**
 * DeskTicketTabsBar v1.0.0 — abas de tickets abertos (Desk CRM col 4)
 */
import React from 'react';
import { useTickets } from '../../../context/TicketsContext';

export default function DeskTicketTabsBar({ onSelectTab, onCloseTab }) {
  const { openTabs, activeTabId } = useTickets();

  if (!openTabs.length) return null;

  const handleSelect = (tabId) => {
    if (onSelectTab) onSelectTab(tabId);
  };

  const handleClose = (e, tabId) => {
    e.stopPropagation();
    if (onCloseTab) onCloseTab(tabId);
  };

  return (
    <div className="crm-ticket-tabs-bar" role="tablist" aria-label="Tickets abertos">
      {openTabs.map((tab) => {
        const isActive = String(activeTabId) === String(tab.id);
        const label = tab.clientName
          ? `${tab.clientName} · ${tab.ticketLabel || '#' + String(tab.id).slice(-6)}`
          : tab.title || `Ticket #${tab.id}`;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={'crm-ticket-tab' + (isActive ? ' is-active' : '')}
            onClick={() => handleSelect(tab.id)}
          >
            <span className="crm-ticket-tab__label">{label}</span>
            <span
              className="crm-ticket-tab__close"
              role="button"
              tabIndex={0}
              aria-label={`Fechar ${label}`}
              onClick={(e) => handleClose(e, tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClose(e, tab.id);
                }
              }}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
