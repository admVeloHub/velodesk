/**
 * Painel compacto — criar ticket draft por CPF
 * VERSION: v2.0.1 | DATE: 2026-06-23
 */
import React, { useEffect, useRef, useState } from 'react';
import { clientsApi } from '../../../api/client';
import { buildDraftTicketFromCliente } from '../../../api/adapters/clienteAdapter';
import { createDraftTicketInCache } from '../../../services/ticketsCache';
import { getAgentName } from '../../../services/clientDb';
import { maskCpfInput, normalizeCpf, isValidCpfDigits } from '../../../services/desk/utils';
import { useNotifications } from '../../../context/NotificationContext';
import RegisterClientModal from './RegisterClientModal';

export default function CreateTicketPanel({ onClose, onSaved }) {
  const { showNotification } = useNotifications();
  const cpfRef = useRef(null);
  const [cpfInput, setCpfInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pendingCpf, setPendingCpf] = useState('');

  useEffect(() => {
    cpfRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !registerOpen) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, registerOpen]);

  const openDraftForCliente = (clienteDoc) => {
    const form = buildDraftTicketFromCliente(clienteDoc, getAgentName());
    if (!form) {
      showNotification('Dados do cliente inválidos.', 'error');
      return;
    }
    const draft = createDraftTicketInCache(form);
    onSaved?.(draft.id || draft._id);
    onClose();
  };

  const handleCreate = async () => {
    const cpf = normalizeCpf(cpfInput);
    if (!isValidCpfDigits(cpf)) {
      showNotification('Informe um CPF completo (11 dígitos).', 'error');
      cpfRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const cliente = await clientsApi.getByCpf(cpf);
      openDraftForCliente(cliente);
    } catch (err) {
      if (err?.response?.status === 404) {
        setPendingCpf(cpf);
        setRegisterOpen(true);
        return;
      }
      const msg = err?.response?.data?.message || 'Não foi possível consultar o CPF.';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSaved = (clienteDoc) => {
    openDraftForCliente(clienteDoc);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCreate();
    }
  };

  return (
    <>
      <div className="crm-create-panel" id="crmCreateTicketPanel">
        <header className="crm-create-panel__header">
          <button type="button" className="crm-create-panel__back" onClick={onClose} aria-label="Voltar">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <h2 className="crm-create-panel__title">Novo ticket</h2>
            <p className="crm-create-panel__hint">Informe o CPF do cliente para abrir o atendimento.</p>
          </div>
        </header>

        <div className="crm-create-panel__body" onKeyDown={handleKeyDown}>
          <div className="crm-create-panel__field">
            <label className="crm-create-panel__label" htmlFor="crmCreateCpf">
              CPF
            </label>
            <input
              ref={cpfRef}
              id="crmCreateCpf"
              type="text"
              className="crm-create-panel__input"
              value={cpfInput}
              onChange={(event) => setCpfInput(maskCpfInput(event.target.value))}
              placeholder="000.000.000-00"
              autoComplete="off"
              inputMode="numeric"
              maxLength={14}
            />
          </div>
        </div>

        <footer className="crm-create-panel__footer">
          <button type="button" className="btn-secondary crm-create-panel__btn" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary crm-create-panel__btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Consultando…' : 'Criar ticket'}
          </button>
        </footer>
      </div>

      <RegisterClientModal
        open={registerOpen}
        cpf={pendingCpf}
        onClose={() => setRegisterOpen(false)}
        onSaved={handleRegisterSaved}
      />
    </>
  );
}
