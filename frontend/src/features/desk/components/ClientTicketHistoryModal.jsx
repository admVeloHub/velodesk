/**
 * ClientTicketHistoryModal v1.0.0 — histórico de tickets do cliente
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  collectClientTickets,
  getClientAnalise,
  getClientContactFields,
  getClientProducts,
  getTicketStatusLabel,
  getTicketTitle,
  normalizeCpf,
} from '../../../services/desk/utils';

function formatTableDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function ClientTicketHistoryModal({
  open,
  onClose,
  ticket,
  client,
  onSelectTicket,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !ticket) return null;

  const contact = getClientContactFields(ticket, client);
  const cpfDigits = normalizeCpf(ticket.lateralForm?.cpf || ticket.clientCPF || client?.cpf || '');
  const clientTickets = collectClientTickets(cpfDigits, contact.name);
  const tickets = clientTickets.length ? clientTickets : [ticket];
  const products = getClientProducts(ticket, client);
  const situacao = client?.situacao || 'Informe o CPF no formulário lateral';
  const risco = client?.risco || '—';
  const analise = getClientAnalise(client);

  const handleRowClick = (ticketId) => {
    onClose();
    if (onSelectTicket) onSelectTicket(ticketId);
  };

  return createPortal(
    <div
      id="ecosystemModal"
      className="modal"
      style={{ display: 'flex', zIndex: 9000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="modal-content modal-content--wide" role="dialog" aria-modal="true" aria-labelledby="clientHistoryTitle">
        <div className="modal-header">
          <h3 id="clientHistoryTitle">Cliente — {contact.name}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="modal-body">
          <div className="client360-profile">
            <div className="client360-grid">
              <div className="client360-card">
                <strong>CPF</strong>
                <span>{contact.cpf || '—'}</span>
              </div>
              <div className="client360-card">
                <strong>Situação</strong>
                <span>{situacao}</span>
              </div>
              <div className="client360-card client360-risk">
                <strong>Risco</strong>
                <span>{risco}</span>
              </div>
            </div>
            <p><strong>Produtos:</strong> {products.length ? products.join(', ') : '—'}</p>
            <p className="client360-analise"><i className="fas fa-brain" /> {analise}</p>
            <h5 className="client360-section-title">Tickets atendidos ({tickets.length})</h5>
            <div className="client360-table-wrap">
              <table className="client360-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Assunto</th>
                    <th>Canal</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="client360-row--clickable"
                      onClick={() => handleRowClick(t.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleRowClick(t.id)}
                    >
                      <td>#{t.id}</td>
                      <td>{getTicketTitle(t)}</td>
                      <td>{t.lateralForm?.canal || t.channel || t.source || '—'}</td>
                      <td>{getTicketStatusLabel(t.status)}</td>
                      <td>{formatTableDate(t.updatedAt || t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
