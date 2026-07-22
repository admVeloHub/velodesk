/**
 * SolicitacoesFormTab — formulário principal (Alteração de Dados Cadastrais)
 */
import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import {
  persistSolicitacaoProdutosOnTicket,
  saveCadastralRequest,
} from '../../../services/cadastral/cadastralRequestStore';
import { findTicketEntry } from '../../../services/ticketsStorage';
import {
  TIPO_INFORMACAO_OPTIONS,
  TIPO_SOLICITACAO_OPTIONS,
} from '../../../services/cadastral/solicitacoesProdutosData';
import { useProdSolicTicketPrefill, validateCpfTicket } from './useProdSolicTicketPrefill';

const EMPTY_FORM = {
  cpf: '',
  ticketId: '',
  tipoSolicitacao: 'alteracao-dados-cadastrais',
  tipoInformacao: 'telefone',
  fotosVerificadas: false,
  dadoAntigo: '',
  dadoNovo: '',
  observacoes: '',
  urgente: false,
};

export default function SolicitacoesFormTab({
  onSaved,
  onSubmitted,
  ticketOverride,
  clientOverride,
}) {
  const { showNotification } = useNotifications();
  const { prefill, activeTabId, formatCpf } = useProdSolicTicketPrefill({ ticketOverride, clientOverride });
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      cpf: prefill.cpf || prev.cpf,
      ticketId: prefill.ticketId || prev.ticketId,
    }));
  }, [prefill]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateCpfTicket(form, showNotification)) return;
    if (!String(form.dadoAntigo || '').trim() || !String(form.dadoNovo || '').trim()) {
      showNotification('Informe o dado antigo e o dado novo.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const request = saveCadastralRequest({
        categoria: 'solicitacoes',
        cpf: form.cpf,
        ticketId: form.ticketId,
        tipoSolicitacao: form.tipoSolicitacao,
        tipoInformacao: form.tipoInformacao,
        fotosVerificadas: form.fotosVerificadas,
        dadoAntigo: form.dadoAntigo.trim(),
        dadoNovo: form.dadoNovo.trim(),
        observacoes: form.observacoes.trim(),
        urgente: form.urgente,
      });

      const ticketRef = ticketOverride?.id
        || findTicketEntry(activeTabId)?.ticket?.id
        || findTicketEntry(form.ticketId)?.ticket?.id;

      if (ticketRef) {
        await persistSolicitacaoProdutosOnTicket(ticketRef, request);
      }

      showNotification('Solicitação enviada ao time de Produtos.', 'success');
      setForm({
        ...EMPTY_FORM,
        cpf: form.cpf,
        ticketId: form.ticketId,
      });
      onSaved?.();
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUrgente = () => {
    setForm((prev) => ({ ...prev, urgente: !prev.urgente }));
    showNotification(
      form.urgente ? 'Prioridade normal.' : 'Solicitação marcada como urgente.',
      'info',
    );
  };

  return (
    <form className="prod-solic-form" onSubmit={handleSubmit}>
      <div className="prod-solic-form__row prod-solic-form__row--2">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">CPF *</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.cpf}
            onChange={(e) => setForm((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }))}
            autoComplete="off"
          />
        </label>
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Ticket *</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.ticketId}
            onChange={(e) => setForm((prev) => ({ ...prev, ticketId: e.target.value }))}
          />
        </label>
      </div>

      <div className="prod-solic-form__box">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Tipo de Solicitação</span>
          <select
            className="prod-solic-form__input"
            value={form.tipoSolicitacao}
            onChange={(e) => setForm((prev) => ({ ...prev, tipoSolicitacao: e.target.value }))}
          >
            {TIPO_SOLICITACAO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>

        <div className="prod-solic-form__row prod-solic-form__row--info">
          <label className="prod-solic-form__field">
            <span className="prod-solic-form__label">Tipo de informação</span>
            <select
              className="prod-solic-form__input"
              value={form.tipoInformacao}
              onChange={(e) => setForm((prev) => ({ ...prev, tipoInformacao: e.target.value }))}
            >
              {TIPO_INFORMACAO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="prod-solic-form__check prod-solic-form__check--inline">
            <input
              type="checkbox"
              checked={form.fotosVerificadas}
              onChange={(e) => setForm((prev) => ({ ...prev, fotosVerificadas: e.target.checked }))}
            />
            <span>Fotos verificadas</span>
          </label>
        </div>

        <div className="prod-solic-form__row prod-solic-form__row--2">
          <label className="prod-solic-form__field">
            <span className="prod-solic-form__label">Dado antigo</span>
            <input
              type="text"
              className="prod-solic-form__input"
              value={form.dadoAntigo}
              onChange={(e) => setForm((prev) => ({ ...prev, dadoAntigo: e.target.value }))}
            />
          </label>
          <label className="prod-solic-form__field">
            <span className="prod-solic-form__label">Dado novo</span>
            <input
              type="text"
              className="prod-solic-form__input"
              value={form.dadoNovo}
              onChange={(e) => setForm((prev) => ({ ...prev, dadoNovo: e.target.value }))}
            />
          </label>
        </div>
      </div>

      <label className="prod-solic-form__field">
        <span className="prod-solic-form__label">Observações</span>
        <textarea
          className="prod-solic-form__textarea"
          rows={4}
          value={form.observacoes}
          onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
        />
      </label>

      <div className="prod-solic-form__actions">
        <button
          type="button"
          className={'prod-solic-form__urgent' + (form.urgente ? ' is-active' : '')}
          onClick={toggleUrgente}
        >
          Solicitação Urgente
        </button>
        <button type="submit" className="prod-solic-form__submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar Solicitação'}
        </button>
      </div>
    </form>
  );
}
