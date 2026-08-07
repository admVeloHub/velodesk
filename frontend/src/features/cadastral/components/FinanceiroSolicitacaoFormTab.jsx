/**
 * FinanceiroSolicitacaoFormTab — solicitações ao time Financeiro (canais especiais)
 */
import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { getAgentName } from '../../../services/desk/utils';
import { getFinanceiroCategoriaTitulo, FINANCEIRO_TIPO_OPTIONS } from '../../../services/cadastral/solicitacoesFinanceiroData';
import { useProdSolicTicketPrefill, validateCpfTicket } from './useProdSolicTicketPrefill';

const EMPTY_FORM = {
  cpf: '',
  ticketId: '',
  categoria: 'estorno',
  descricao: '',
  urgente: false,
};

export default function FinanceiroSolicitacaoFormTab({
  initialCategoria = 'estorno',
  onSubmitted,
  onTeamForward,
  ticketOverride,
  clientOverride,
}) {
  const { showNotification } = useNotifications();
  const { prefill, formatCpf } = useProdSolicTicketPrefill({ ticketOverride, clientOverride });
  const [form, setForm] = useState({ ...EMPTY_FORM, categoria: initialCategoria });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      cpf: prefill.cpf || prev.cpf,
      ticketId: prefill.ticketId || prev.ticketId,
      categoria: initialCategoria || prev.categoria,
    }));
  }, [prefill, initialCategoria]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateCpfTicket(form, showNotification)) return;
    if (!String(form.descricao || '').trim()) {
      showNotification('Descreva a solicitação financeira.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const categoria = form.categoria === 'cobranca' ? 'estorno' : form.categoria;
      const request = {
        categoria,
        cpf: form.cpf,
        ticketId: form.ticketId,
        descricao: form.descricao.trim(),
        observacoes: form.descricao.trim(),
        urgente: form.urgente,
        colaborador: getAgentName() || '',
        createdAt: new Date().toISOString(),
        titulo: `${String(form.cpf || '').replace(/\D/g, '')} - ${getFinanceiroCategoriaTitulo(categoria)}`,
      };

      if (!onTeamForward) {
        showNotification('Encaminhamento financeiro disponível apenas no contexto do ticket.', 'error');
        return;
      }

      await onTeamForward(request);
      setForm({
        ...EMPTY_FORM,
        cpf: form.cpf,
        ticketId: form.ticketId,
        categoria: initialCategoria,
      });
      onSubmitted?.();
    } catch (err) {
      showNotification(err?.message || 'Não foi possível enviar a solicitação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="prod-solic-form prod-solic-form--financeiro" onSubmit={handleSubmit}>
      <div className="prod-solic-form__row prod-solic-form__row--2">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">CPF *</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.cpf}
            onChange={(e) => setForm((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }))}
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

      <label className="prod-solic-form__field">
        <span className="prod-solic-form__label">Tipo de solicitação</span>
        <select
          className="prod-solic-form__input"
          value={form.categoria}
          onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
        >
          {FINANCEIRO_TIPO_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label className="prod-solic-form__field">
        <span className="prod-solic-form__label">Descrição *</span>
        <textarea
          className="prod-solic-form__textarea"
          rows={4}
          value={form.descricao}
          onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
        />
      </label>

      <div className="prod-solic-form__actions">
        <button
          type="button"
          className={'prod-solic-form__urgent' + (form.urgente ? ' is-active' : '')}
          onClick={() => setForm((prev) => ({ ...prev, urgente: !prev.urgente }))}
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
