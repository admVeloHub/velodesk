/**
 * DeskClientProfileBar v1.0.0 — cabeçalho do cliente no ticket
 */
import React, { useState } from 'react';
import {
  getClientContactFields,
  getClientProducts,
  getProductTagClass,
  getTicketOperationAreaLabel,
} from '../../../services/desk/utils';
import ClientTicketHistoryModal from './ClientTicketHistoryModal';

export default function DeskClientProfileBar({ ticket, client, onSaveContact, onSelectTicket }) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });
  const contact = getClientContactFields(ticket, client);
  const products = getClientProducts(ticket, client);
  const operationArea = getTicketOperationAreaLabel(ticket);

  const openEdit = () => {
    setDraft({ name: contact.name, email: contact.email, phone: contact.phone });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (onSaveContact) onSaveContact(draft);
    setEditOpen(false);
  };

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
          <span className="ticket-client-profile__contact"><i className="fas fa-envelope" /> <span id="profileEmail">{contact.email || '—'}</span></span>
          <span className="ticket-client-profile__contact"><i className="fas fa-phone" /> <span id="profilePhone">{contact.phone || '—'}</span></span>
          <span className="ticket-client-profile__ticket-id" id="profileTicketId">Ticket #{ticket.id}</span>
        </div>
        <div className="ticket-client-profile__row ticket-client-profile__row--bottom">
          <span className="ticket-client-profile__cpf">
            <span className="ticket-client-profile__label">CPF</span> <span id="profileCpf">{contact.cpf || '—'}</span>
          </span>
          <span className="ticket-client-profile__products" id="profileProducts">
            {products.length ? products.map((p) => (
              <span key={p} className={'velo-product-tag ' + getProductTagClass(p)}>{p}</span>
            )) : <span className="ticket-client-profile__empty">—</span>}
          </span>
        </div>
        <div className="ticket-client-profile__footer">
          <button
            type="button"
            className="btn-secondary btn-sm ticket-client-history-btn"
            id="btnClientHistory"
            onClick={() => setHistoryOpen(true)}
          >
            <i className="fas fa-history" /> Histórico de tickets
          </button>
          <div
            className="container-secondary ticket-client-profile__operation-status"
            id="profileOperationStatus"
            aria-label={'Área operacional: ' + operationArea}
          >
            <span className="ticket-client-profile__operation-status-label">Status</span>
            <strong className="ticket-client-profile__operation-status-value">{operationArea}</strong>
          </div>
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
