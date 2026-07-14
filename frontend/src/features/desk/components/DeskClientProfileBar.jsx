/**
 * DeskClientProfileBar v1.4.1 — termômetro à esquerda de status/histórico
 * VERSION: v1.4.1 | DATE: 2026-07-03
 */
import React, { useEffect, useState } from 'react';
import { getClientContactFields, getClientActiveProducts, getProductTagClass, getTicketProtocolLabel } from '../../../services/desk/utils';
import ClientTicketHistoryModal from './ClientTicketHistoryModal';
import TicketWorkflowStepper from './TicketWorkflowStepper';
import TicketWorkflowActions from './TicketWorkflowActions';
import { isTicketInWorkflow } from '../../../services/desk/utils';

function resolveProtocolLabel(ticket) {
  const protocol = getTicketProtocolLabel(ticket);
  if (protocol) return protocol;
  if (ticket?.isDraft || String(ticket?.id || '').startsWith('draft-')) return 'Rascunho';
  return '—';
}

export default function DeskClientProfileBar({
  ticket,
  client,
  onSaveContact,
  onSelectTicket,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });
  const contact = getClientContactFields(ticket, client);
  const activeProducts = getClientActiveProducts(ticket, client);
  const protocolLabel = resolveProtocolLabel(ticket);
  const inWorkflow = isTicketInWorkflow(ticket);

  const openEdit = () => {
    setDraft({ name: contact.name, email: contact.email, phone: contact.phone });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!onSaveContact || savingContact) return;
    setSavingContact(true);
    try {
      await onSaveContact(draft);
      setEditOpen(false);
    } catch {
      // notificação tratada no DeskV2Root
    } finally {
      setSavingContact(false);
    }
  };

  useEffect(() => {
    if (!editOpen) return undefined;

    const handleKey = (e) => {
      if (e.key === 'Escape') setEditOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editOpen]);

  return (
    <div className="crm-client-profile-bar">
      <section
        className="ticket-client-profile ticket-client-profile--compact ticket-client-profile--header-grid"
        id="ticketClientProfile"
        aria-label="Perfil do cliente"
      >
        <div className="ticket-client-profile__client-main ticket-client-profile__cell-client" id="headerInfo">
          <span className="ticket-client-profile__field ticket-client-profile__field--name" id="profileName">
            {contact.name || '—'}
          </span>
          <span className="ticket-client-profile__sep" aria-hidden="true">–</span>
          <span className="ticket-client-profile__field ticket-client-profile__field--cpf" id="profileCpf">
            {contact.cpf || '—'}
          </span>
          <span className="ticket-client-profile__sep" aria-hidden="true">–</span>
          <span className="ticket-client-profile__field ticket-client-profile__field--phone" id="profilePhone">
            {contact.phone || '—'}
          </span>
          <span className="ticket-client-profile__sep" aria-hidden="true">–</span>
          <div className="ticket-client-profile__contact-stack">
            <span className="ticket-client-profile__field ticket-client-profile__field--email" id="profileEmail">
              {contact.email || '—'}
            </span>
          </div>
          <span className="ticket-client-profile__edit-wrap">
            <button
              type="button"
              className={'crm-edit-client-btn' + (editOpen ? ' is-active' : '')}
              id="btnEditClient"
              title="Editar cadastro"
              aria-label="Editar cadastro"
              aria-expanded={editOpen}
              aria-controls="clientEditPopover"
              onClick={openEdit}
            >
              <i className="ti ti-pencil" aria-hidden="true" />
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
                  <button
                    type="button"
                    className="crm-client-edit-popover__save"
                    id="btnSaveClientEdit"
                    onClick={saveEdit}
                    disabled={savingContact}
                  >
                    {savingContact ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </span>
        </div>

        <div className="ticket-client-profile__protocol-row ticket-client-profile__cell-protocol">
          <span className="ticket-client-profile__protocol" id="profileProtocol">
            {protocolLabel}
          </span>
          {activeProducts.length ? (
            <div
              className="ticket-client-profile__products ticket-client-profile__products--protocol"
              id="profileProducts"
              aria-label="Produtos ativos do cliente"
            >
              {activeProducts.map((produto) => (
                <span
                  key={produto}
                  className={'velo-product-tag velo-tag ' + getProductTagClass(produto)}
                  title={`Produto ativo: ${produto}`}
                >
                  {produto}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <div className="crm-client-profile-bar__history">
        <button
          type="button"
          className="btn-secondary btn-sm ticket-client-history-btn"
          id="btnClientHistory"
          onClick={() => setHistoryOpen(true)}
        >
          <i className="fas fa-history" /> Histórico
        </button>
      </div>
      {inWorkflow ? (
        <div className="crm-client-profile-bar__workflow">
          <TicketWorkflowStepper ticket={ticket} />
          <TicketWorkflowActions ticket={ticket} />
        </div>
      ) : null}
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
