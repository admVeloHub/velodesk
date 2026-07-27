/**
 * DeskClientProfileBar v1.6.0 — múltiplos e-mails/telefones + WhatsApp
 * VERSION: v1.6.0 | DATE: 2026-07-27
 */
import React, { useEffect, useState } from 'react';
import { getClientContactFields, getClientActiveProducts, getProductTagClass, getTicketProtocolLabel, isTicketInWorkflow } from '../../../services/desk/utils';
import { useNotifications } from '../../../context/NotificationContext';
import TicketWorkflowStepper from './TicketWorkflowStepper';
import ClientContactFieldsEditor, {
  buildContactDraftFromFields,
  validateClientContactDraft,
} from './ClientContactFieldsEditor';

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
  onOpenHistory,
  onAdvanceWorkflow,
  advancingWorkflow = false,
  canAdvanceWorkflow = false,
}) {
  const { showNotification } = useNotifications();
  const [editOpen, setEditOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    emails: [''],
    phones: [''],
    whatsappPhone: '',
  });
  const [emailErrors, setEmailErrors] = useState({});
  const contact = getClientContactFields(ticket, client);
  const activeProducts = getClientActiveProducts(ticket, client);
  const protocolLabel = resolveProtocolLabel(ticket);
  const inWorkflow = isTicketInWorkflow(ticket);

  const openEdit = () => {
    setDraft(buildContactDraftFromFields(contact));
    setEmailErrors({});
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!onSaveContact || savingContact) return;
    const validation = validateClientContactDraft(draft);
    if (!validation.ok) {
      if (validation.emailIndex != null) {
        setEmailErrors({ [validation.emailIndex]: true });
      }
      showNotification(validation.message, 'error');
      return;
    }
    setSavingContact(true);
    try {
      await onSaveContact({
        name: validation.nome,
        emails: validation.emailList,
        phones: validation.phoneList,
        whatsappPhone: validation.whatsappPhone,
      });
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
    <div className={'crm-client-profile-bar' + (inWorkflow ? ' crm-client-profile-bar--with-workflow' : '')}>
      <section
        className={
          'ticket-client-profile ticket-client-profile--compact ticket-client-profile--header-grid'
          + (inWorkflow ? ' ticket-client-profile--header-grid--with-workflow' : '')
        }
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
              <div className="crm-client-edit-popover crm-client-edit-popover--wide" id="clientEditPopover" role="dialog" aria-labelledby="clientEditPopoverTitle">
                <button type="button" className="crm-client-edit-popover__close" id="btnCloseClientEdit" title="Fechar" aria-label="Fechar" onClick={() => setEditOpen(false)}>
                  <i className="ti ti-x" />
                </button>
                <h3 className="crm-client-edit-popover__title" id="clientEditPopoverTitle">Editar contato</h3>
                <div className="crm-client-edit-popover__fields">
                  <ClientContactFieldsEditor
                    idPrefix="editClient"
                    name={draft.name}
                    onNameChange={(value) => setDraft((d) => ({ ...d, name: value }))}
                    emails={draft.emails}
                    onEmailsChange={(emails) => setDraft((d) => ({ ...d, emails }))}
                    phones={draft.phones}
                    onPhonesChange={(phones) => setDraft((d) => ({ ...d, phones }))}
                    whatsappPhone={draft.whatsappPhone}
                    onWhatsappPhoneChange={(whatsappPhone) => setDraft((d) => ({ ...d, whatsappPhone }))}
                    emailErrors={emailErrors}
                    onEmailBlur={(index, value) => {
                      const trimmed = String(value || '').trim();
                      setEmailErrors((prev) => {
                        const next = { ...prev };
                        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next[index] = true;
                        else delete next[index];
                        return next;
                      });
                    }}
                  />
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
          {inWorkflow ? (
            <div className="ticket-client-profile__client-actions">
              <TicketWorkflowStepper ticket={ticket} />
              {canAdvanceWorkflow ? (
                <button
                  type="button"
                  className="btn-primary btn-sm desk-workflow-advance-btn ticket-client-advance-btn"
                  onClick={onAdvanceWorkflow}
                  disabled={advancingWorkflow}
                >
                  {advancingWorkflow ? 'Avançando…' : 'Avançar'}
                </button>
              ) : null}
            </div>
          ) : null}
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
          <div className="ticket-client-profile__protocol-actions">
            <button
              type="button"
              className="btn-secondary btn-sm ticket-client-history-btn"
              id="btnClientHistory"
              onClick={onOpenHistory}
            >
              <i className="fas fa-history" /> Histórico
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
