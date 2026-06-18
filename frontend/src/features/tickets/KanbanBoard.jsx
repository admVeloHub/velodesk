/**
 * Kanban de tickets (modo clássico)
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getKanbanColumns } from '../../services/kanbanStorage';
import { useTickets } from '../../context/TicketsContext';
import TicketLateralForm from './TicketLateralForm';

export default function KanbanBoard() {
  const { refreshKey, openTicket } = useTickets();
  const columns = getKanbanColumns();
  const [selected, setSelected] = useState(null);
  void refreshKey;

  return (
    <div id="tickets" className="page active">
      <div className="page-header">
        <h2>Tickets</h2>
        <div className="header-actions">
          <Link to="/tickets?desk=v2" className="btn-primary">Abrir Desk CRM</Link>
        </div>
      </div>
      <div className="tickets-layout">
        <aside className="boxes-sidebar">
          <div className="boxes-header"><h3>Caixas</h3></div>
          <div className="boxes-list" id="boxesList">
            {columns.map((col) => (
              <div key={col.id} className="box-item" data-box-id={col.id}>
                <div className="box-header">
                  <h3>{col.name}</h3>
                  <span className="ticket-count">{(col.tickets || []).length}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="kanban-board" style={{ display: 'flex', gap: 16, overflow: 'auto', padding: 16, flex: 1 }}>
          {columns.map((col) => (
            <div key={col.id} className="kanban-column" style={{ minWidth: 260, background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <h3>{col.name}</h3>
              {(col.tickets || []).map((t) => (
                <div
                  key={t.id}
                  className="kanban-card"
                  style={{ background: '#fff', padding: 12, marginTop: 8, borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,.08)', cursor: 'pointer' }}
                  onClick={() => { setSelected(t); openTicket(t.id); }}
                  role="button"
                  tabIndex={0}
                >
                  <strong>{t.clientName || t.title}</strong>
                  <p style={{ fontSize: 13, margin: '4px 0 0' }}>{t.title}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {selected && <TicketLateralForm ticket={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
