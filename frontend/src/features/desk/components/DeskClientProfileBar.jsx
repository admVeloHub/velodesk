/**
 * DeskClientProfileBar v1.1.0 — cabeçalho do cliente no ticket
 * VERSION: v1.1.0 | DATE: 2026-06-24
 */
import React, { useEffect, useState } from 'react';
import {
  getClientContactFields,
  getClientProducts,
  getProductTagClass,
} from '../../../services/desk/utils';
import ClientTicketHistoryModal from './ClientTicketHistoryModal';
import TicketOperationProgress from './TicketOperationProgress';

export default function DeskClientProfileBar({
  ticket,
  client,
  queueId,
  escalonar,
  onSaveContact,
  onSelectTicket,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });
  const contact = getClientContactFields(ticket, client);
  const products = getClientProducts(ticket, client);
  const openEdit = () => {
    setDraft({ name: contact.name, email: contact.email, phone: contact.phone });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (onSaveContact) onSaveContact(draft);
    setEditOpen(false);
  };

  useEffect(() => {
    if (!infoOpen) return undefined;

    const handlePointer = (e) => {
      if (e.target.closest?.('#btnClientContactInfo')) return;
      if (e.target.closest?.('#clientContactInfoPopover')) return;
      setInfoOpen(false);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') setInfoOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [infoOpen]);

  return (
    <div className="crm-client-profile-bar">
      <section className="ticket-client-profile ticket-client-profile--compact" id="ticketClientProfile" aria-label="Perfil do cliente">
        <div className="ticket-client-profile__row ticket-client-profile__row--top">
          <span className="ticket-client-profile__name-wrap" id="headerInfo">
            <strong className="ticket-client-profile__name" id="profileName">{contact.name}</strong>
            <button
              type="button"
              className={'crm-edit-client-btn' + (editOpen ? ' is-active' : '')}
              id="btnEditClient"
              title="Editar contato"
              aria-expanded={editOpen}
              aria-controls="clientEditPopover"
              onClick={openEdit}
            >
              <i className="ti ti-pencil" />
            </button>
            {editOpen && (
              <div className="crm-client-edit-popover" id="clientEditPopover" role="dialog" aria-labelledby="clientEditPopoverTitle">
                <button type="button" className="crm-client-edit-popover__close" id="btnCloseClientEdit" title="Fechar" aria-label="Fechar" onClick={() => setEditOpen(false)}>
                  <i className="ti ti-x" />
                </button>
                <h3 className="crm-client-edit-popover__title" id="clientEditPopoverTitle">Editar contato</h3>
                <div className="crm-client-edit-popover__fields">
                  <label className="crm-client-edit-popover__label" htmlFor="editClientName">Nome</label>
                  <input type="text" className="crm-client-edit-popover__input" id="editClientName" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} autoComplete="name" />
                  <label className="crm-client-edit-popover__label" htmlFor="editClientEmail">E-mail</label>
                  <input type="email" className="crm-client-edit-popover__input" id="editClientEmail" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} autoComplete="email" />
                  <label className="crm-client-edit-popover__label" htmlFor="editClientPhone">Telefone</label>
                  <input type="tel" className="crm-client-edit-popover__input" id="editClientPhone" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} autoComplete="tel" />
                </div>
                <div className="crm-client-edit-popover__footer">
                  <button type="button" className="crm-client-edit-popover__save" id="btnSaveClientEdit" onClick={saveEdit}>Salvar</button>
                </div>
              </div>
            )}
          </span>
          <span className="ticket-client-profile__info-wrap">
            <button
              type="button"
              className={'crm-client-info-btn' + (infoOpen ? ' is-active' : '')}
              id="btnClientContactInfo"
              title="E-mail e telefone"
              aria-label="Ver e-mail e telefone"
              aria-expanded={infoOpen}
              aria-controls="clientContactInfoPopover"
              onClick={() => setInfoOpen((open) => !open)}
            >
              <i className="ti ti-info-circle" aria-hidden="true" />
            </button>
            {infoOpen && (
              <div
                className="crm-client-contact-popover"
                id="clientContactInfoPopover"
                role="dialog"
                aria-label="Contato do cliente"
              >
                <button
                  type="button"
                  className="crm-client-contact-popover__close"
                  id="btnCloseClientContactInfo"
                  title="Fechar"
                  aria-label="Fechar"
                  onClick={() => setInfoOpen(false)}
                >
                  <i className="ti ti-x" />
                </button>
                <div className="crm-client-contact-popover__row">
                  <i className="fas fa-envelope" aria-hidden="true" />
                  <div className="crm-client-contact-popover__field">
                    <span className="crm-client-contact-popover__label">E-mail</span>
                    <span className="crm-client-contact-popover__value" id="profileEmail">{contact.email || '—'}</span>
                  </div>
                </div>
                <div className="crm-client-contact-popover__row">
                  <i className="fas fa-phone" aria-hidden="true" />
                  <div className="crm-client-contact-popover__field">
                    <span className="crm-client-contact-popover__label">Telefone</span>
                    <span className="crm-client-contact-popover__value" id="profilePhone">{contact.phone || '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </span>
          <span className="ticket-client-profile__cpf">
            <span className="ticket-client-profile__label">CPF</span> <span id="profileCpf">{contact.cpf || '—'}</span>
          </span>
          <span className="ticket-client-profile__products" id="profileProducts">
            {products.length ? products.map((p) => (
              <span key={p} className={'velo-product-tag ' + getProductTagClass(p)}>{p}</span>
            )) : <span className="ticket-client-profile__empty">—</span>}
          </span>
          <span className="ticket-client-profile__ticket-meta">
            <button
              type="button"
              className="btn-secondary btn-sm ticket-client-history-btn"
              id="btnClientHistory"
              onClick={() => setHistoryOpen(true)}
            >
              <i className="fas fa-history" /> Histórico de tickets
            </button>
            <TicketOperationProgress
              ticket={ticket}
              queueId={queueId}
              escalonar={escalonar}
            />
            <span className="ticket-client-profile__ticket-id" id="profileTicketId">Ticket #{ticket.id}</span>
          </span>
        </div>
      </section>
      <ClientTicketHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        ticket={ticket}
        client={client}
        onSelectTicket={onSelectTicket}
      />
    </div>
  );
}
