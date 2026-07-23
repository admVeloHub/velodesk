/**
 * ClientTicketHistoryModal v1.2.0 — mesclagem de tickets duplicados (Client360)
 * VERSION: v1.2.0 | DATE: 2026-07-23
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectClientTickets,
  getClientAnalise,
  getClientContactFields,
  getClientProducts,
  getTicketProtocolLabel,
  getTicketStatusLabel,
  getTicketTitle,
  normalizeCpf,
} from '../../../services/desk/utils';
import { getClient360WorkflowIconMeta } from '../../../services/workflow/workflowTeamQueues';
import { canSelectTicketForMerge } from '../../../services/desk/ticketMergeService';

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
  sourceTicketId,
  onMergeTickets,
  merging = false,
}) {
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const mergeEnabled = Boolean(onMergeTickets && sourceTicketId);

  useEffect(() => {
    if (!open) {
      setSelectedTargetId(null);
    }
  }, [open]);

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
  const cpfDigits = normalizeCpf(
    ticket.lateralForm?.clienteCpf
    || ticket.lateralForm?.cpf
    || ticket.clientCPF
    || client?.cpf
    || contact.cpf
    || '',
  );
  const mergeContext = { clientCpfDigits: cpfDigits, clientName: contact.name };
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

  const handleToggleMergeTarget = (ticketId, eligible) => {
    if (!eligible || merging) return;
    setSelectedTargetId((prev) => (prev === ticketId ? null : ticketId));
  };

  const handleMergeClick = () => {
    if (!selectedTargetId || merging || !onMergeTickets) return;
    const target = tickets.find((t) => String(t.id || t._id) === String(selectedTargetId));
    const sourceProto = getTicketProtocolLabel(ticket) || sourceTicketId;
    const targetProto = target ? (getTicketProtocolLabel(target) || selectedTargetId) : selectedTargetId;
    const confirmed = window.confirm(
      `Mesclar o ticket #${sourceProto} ao chamado #${targetProto}?\n\n`
      + 'O ticket atual será encerrado como resolvido e o chamado em andamento permanecerá ativo.',
    );
    if (!confirmed) return;
    onMergeTickets(selectedTargetId);
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
            {mergeEnabled ? (
              <p className="client360-merge-hint">
                Selecione o chamado em andamento para mesclar o ticket atual.
              </p>
            ) : null}
            <div className="client360-table-wrap">
              <table className="client360-table">
                <thead>
                  <tr>
                    {mergeEnabled ? <th className="client360-table__th-check" aria-label="Mesclar" /> : null}
                    <th>Ticket</th>
                    <th>Assunto</th>
                    <th>Canal</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const ticketId = String(t.id || t._id);
                    const workflowIcon = getClient360WorkflowIconMeta(t);
                    const mergeEligible = mergeEnabled
                      && canSelectTicketForMerge(ticket, t, sourceTicketId, mergeContext);
                    const isMergeSelected = selectedTargetId === ticketId;
                    return (
                      <tr
                        key={ticketId}
                        className={
                          'client360-row--clickable'
                          + (isMergeSelected ? ' client360-row--merge-selected' : '')
                        }
                        onClick={() => handleRowClick(ticketId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleRowClick(ticketId)}
                      >
                        {mergeEnabled ? (
                          <td
                            className="client360-table__td-check"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="client360-merge-check"
                              checked={isMergeSelected}
                              disabled={!mergeEligible || merging}
                              onChange={() => handleToggleMergeTarget(ticketId, mergeEligible)}
                              aria-label={
                                mergeEligible
                                  ? `Mesclar ticket atual em #${getTicketProtocolLabel(t) || ticketId}`
                                  : 'Indisponível para mesclagem'
                              }
                            />
                          </td>
                        ) : null}
                        <td>
                          <span className="client360-ticket-cell">
                            #{getTicketProtocolLabel(t) || t.id}
                            {workflowIcon ? (
                              <span
                                className={`client360-workflow-icon client360-workflow-icon--${workflowIcon.modifier}`}
                                title={workflowIcon.title}
                                aria-label={workflowIcon.title}
                              >
                                <i className={`ti ${workflowIcon.icon}`} aria-hidden="true" />
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td>{getTicketTitle(t)}</td>
                        <td>{t.lateralForm?.canal || t.channel || t.source || '—'}</td>
                        <td>{getTicketStatusLabel(t.status)}</td>
                        <td>{formatTableDate(t.updatedAt || t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="modal-footer client360-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={merging}>
            Fechar
          </button>
          {mergeEnabled ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleMergeClick}
              disabled={!selectedTargetId || merging}
            >
              {merging ? 'Mesclando…' : 'Mesclar tickets'}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
