/**
 * Modal — cadastro cliente b2c_cadastros.clientes
 * VERSION: v1.2.0 | DATE: 2026-08-06
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clientsApi } from '../../../api/client';
import { buildClienteCreateBody } from '../../../api/adapters/clienteAdapter';
import { formatCpf } from '../../../services/desk/utils';
import { useNotifications } from '../../../context/NotificationContext';
import ClientContactFieldsEditor, { validateClientContactDraft } from './ClientContactFieldsEditor';

export default function RegisterClientModal({ open, cpf, onClose, onSaved }) {
  const { showNotification } = useNotifications();
  const [nome, setNome] = useState('');
  const [emails, setEmails] = useState(['']);
  const [replyEmail, setReplyEmail] = useState('');
  const [phones, setPhones] = useState(['']);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [emailErrors, setEmailErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setNome('');
    setEmails(['']);
    setReplyEmail('');
    setPhones(['']);
    setWhatsappPhone('');
    setEmailErrors({});
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    const validation = validateClientContactDraft({
      name: nome,
      emails,
      replyEmail,
      phones,
      whatsappPhone,
    });
    if (!validation.ok) {
      if (validation.emailIndex != null) {
        setEmailErrors({ [validation.emailIndex]: true });
      }
      showNotification(validation.message, 'error');
      return;
    }
    setSaving(true);
    try {
      const body = buildClienteCreateBody({
        cpf,
        nome: validation.nome,
        emails: validation.emailList,
        phones: validation.phoneList,
        whatsappPhone: validation.whatsappPhone,
        replyEmail: validation.replyEmail,
      });
      const cliente = await clientsApi.create(body);
      showNotification('Cliente cadastrado.', 'success');
      onSaved?.(cliente);
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Não foi possível cadastrar o cliente.';
      showNotification(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        className="queue-box-modal__backdrop"
        aria-label="Fechar cadastro de cliente"
        onClick={onClose}
      />
      <div
        className="queue-box-modal queue-box-modal--wide register-client-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registerClientModalTitle"
      >
        <header className="queue-box-modal__header">
          <div className="queue-box-modal__head-main">
            <span className="queue-box-modal__icon" aria-hidden="true">
              <i className="ti ti-user-plus" />
            </span>
            <div>
              <h2 className="queue-box-modal__title" id="registerClientModalTitle">
                Cadastrar cliente
              </h2>
              <p className="queue-box-modal__subtitle">
                CPF não encontrado. Preencha os dados para continuar.
              </p>
            </div>
          </div>
          <button type="button" className="queue-box-modal__close" onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" />
          </button>
        </header>
        <div className="queue-box-modal__body">
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="registerClientCpf">CPF</label>
            <input
              id="registerClientCpf"
              type="text"
              className="queue-box-modal__input"
              value={formatCpf(cpf)}
              readOnly
            />
          </div>
          <ClientContactFieldsEditor
            idPrefix="registerClient"
            name={nome}
            onNameChange={setNome}
            emails={emails}
            onEmailsChange={setEmails}
            replyEmail={replyEmail}
            onReplyEmailChange={setReplyEmail}
            phones={phones}
            onPhonesChange={setPhones}
            whatsappPhone={whatsappPhone}
            onWhatsappPhoneChange={setWhatsappPhone}
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
        <footer className="queue-box-modal__footer">
          <button type="button" className="btn-secondary queue-box-modal__btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn-primary queue-box-modal__btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar cliente'}
          </button>
        </footer>
      </div>
    </>,
    document.body
  );
}
