/**
 * Modal — cadastro cliente b2c_cadastros.clientes
 * VERSION: v1.0.1 | DATE: 2026-06-23
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clientsApi } from '../../../api/client';
import { buildClienteCreateBody } from '../../../api/adapters/clienteAdapter';
import { formatCpf, isValidEmailFormat } from '../../../services/desk/utils';
import { useNotifications } from '../../../context/NotificationContext';

export default function RegisterClientModal({ open, cpf, onClose, onSaved }) {
  const { showNotification } = useNotifications();
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [nomeError, setNomeError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setNome('');
    setEmail('');
    setTelefone('');
    setNomeError(false);
    setEmailError(false);
    setSaving(false);
    nameRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    const emailTrim = email.trim();
    if (!nome.trim()) {
      setNomeError(true);
      showNotification('Informe o nome do cliente.', 'error');
      nameRef.current?.focus();
      return;
    }
    if (emailTrim && !isValidEmailFormat(emailTrim)) {
      setEmailError(true);
      showNotification('Informe um e-mail válido (ex.: nome@dominio.com).', 'error');
      emailRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = buildClienteCreateBody({ cpf, nome, email: emailTrim, telefone });
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
        className="queue-box-modal"
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
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="registerClientNome">
              Nome <span className="queue-box-modal__req">*</span>
            </label>
            <input
              ref={nameRef}
              id="registerClientNome"
              type="text"
              className={'queue-box-modal__input' + (nomeError ? ' queue-box-modal__input--error' : '')}
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (nomeError) setNomeError(false);
              }}
              autoComplete="name"
            />
          </div>
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="registerClientEmail">E-mail</label>
            <input
              ref={emailRef}
              id="registerClientEmail"
              type="email"
              className={'queue-box-modal__input' + (emailError ? ' queue-box-modal__input--error' : '')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(false);
              }}
              onBlur={() => {
                const v = email.trim();
                if (v && !isValidEmailFormat(v)) setEmailError(true);
              }}
              placeholder="nome@dominio.com"
              autoComplete="email"
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              title="Formato: nome@dominio.com"
            />
          </div>
          <div className="queue-box-modal__field">
            <label className="queue-box-modal__label" htmlFor="registerClientPhone">Telefone</label>
            <input
              id="registerClientPhone"
              type="tel"
              className="queue-box-modal__input"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              autoComplete="tel"
            />
          </div>
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
