/**
 * Painel compacto — criar ticket (Desk CRM)
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { searchClients, getAgentName } from '../../../services/clientDb';
import { createTicketViaApi } from '../../../services/ticketsCache';
import { buildCreatePayload } from '../../../api/adapters/ticketAdapter';
import { useNotifications } from '../../../context/NotificationContext';

const CHANNELS = ['WhatsApp', 'Telefone', 'E-mail'];
const CHANNEL_STORAGE_KEY = 'velodeskCreateTicketChannel';

function readDefaultChannel() {
  const saved = sessionStorage.getItem(CHANNEL_STORAGE_KEY);
  return CHANNELS.includes(saved) ? saved : 'WhatsApp';
}

export default function CreateTicketPanel({ onClose, onSaved }) {
  const agent = getAgentName();
  const { showNotification } = useNotifications();
  const assuntoRef = useRef(null);
  const [clientQuery, setClientQuery] = useState('');
  const [matchedClient, setMatchedClient] = useState(null);
  const [assunto, setAssunto] = useState('');
  const [assuntoError, setAssuntoError] = useState(false);
  const [channel, setChannel] = useState(readDefaultChannel);
  const [saving, setSaving] = useState(false);

  const resolveClient = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMatchedClient(null);
      return;
    }
    const results = searchClients(trimmed);
    setMatchedClient(results[0] || null);
  }, []);

  useEffect(() => {
    assuntoRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => resolveClient(clientQuery), 280);
    return () => window.clearTimeout(timer);
  }, [clientQuery, resolveClient]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!assunto.trim()) {
      setAssuntoError(true);
      showNotification('Informe o assunto do ticket.', 'error');
      assuntoRef.current?.focus();
      return;
    }
    setAssuntoError(false);
    setSaving(true);
    sessionStorage.setItem(CHANNEL_STORAGE_KEY, channel);

    const payload = buildCreatePayload({
      assunto,
      descricao: assunto,
      channel,
      tipo: 'Solicitação',
      produto: 'Internet Fibra',
      motivo: 'Outros',
      atribuir: `${agent} (eu)`,
      clientName: matchedClient?.name || clientQuery.trim() || 'Cliente',
      clientCPF: matchedClient?.cpf || '',
    });

    try {
      const created = await createTicketViaApi(payload);
      if (!created) {
        showNotification('Não foi possível criar o ticket. Verifique sua conexão ou autenticação.', 'error');
        return;
      }
      onSaved?.(created.id || created._id);
      onClose();
    } catch {
      showNotification('Erro ao criar ticket.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && (event.ctrlKey || event.target.id === 'crmCreateAssunto')) {
      event.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="crm-create-panel" id="crmCreateTicketPanel">
      <header className="crm-create-panel__header">
        <button type="button" className="crm-create-panel__back" onClick={onClose} aria-label="Voltar">
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div>
          <h2 className="crm-create-panel__title">Novo ticket</h2>
          <p className="crm-create-panel__hint">Preencha os campos essenciais para abrir o atendimento.</p>
        </div>
      </header>

      <div className="crm-create-panel__body" onKeyDown={handleKeyDown}>
        <div className="crm-create-panel__field">
          <label className="crm-create-panel__label" htmlFor="crmCreateClient">
            Cliente
          </label>
          <input
            id="crmCreateClient"
            type="text"
            className="crm-create-panel__input"
            value={clientQuery}
            onChange={(event) => setClientQuery(event.target.value)}
            placeholder="CPF, nome ou e-mail"
            autoComplete="off"
          />
          {matchedClient ? (
            <span className="crm-create-panel__client-match">
              <i className="ti ti-user-check" aria-hidden="true" />
              {matchedClient.name}
              {matchedClient.cpf ? ` · ${matchedClient.cpf}` : ''}
            </span>
          ) : null}
        </div>

        <div className="crm-create-panel__field">
          <label className="crm-create-panel__label" htmlFor="crmCreateAssunto">
            Assunto <span className="crm-create-panel__req">*</span>
          </label>
          <input
            ref={assuntoRef}
            id="crmCreateAssunto"
            type="text"
            className={'crm-create-panel__input' + (assuntoError ? ' crm-create-panel__input--error' : '')}
            value={assunto}
            onChange={(event) => {
              setAssunto(event.target.value);
              if (assuntoError) setAssuntoError(false);
            }}
            placeholder="Resumo do atendimento"
          />
        </div>

        <div className="crm-create-panel__field">
          <label className="crm-create-panel__label" htmlFor="crmCreateChannel">
            Canal
          </label>
          <select
            id="crmCreateChannel"
            className="crm-create-panel__select"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <footer className="crm-create-panel__footer">
        <button type="button" className="btn-secondary crm-create-panel__btn" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn-primary crm-create-panel__btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Criando…' : 'Criar ticket'}
        </button>
      </footer>
    </div>
  );
}
