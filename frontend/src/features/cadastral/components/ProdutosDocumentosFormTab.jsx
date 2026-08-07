/**
 * ProdutosDocumentosFormTab — solicitação de documentos ao time de Produtos
 */
import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { saveCadastralRequest } from '../../../services/cadastral/cadastralRequestStore';
import { useProdSolicTicketPrefill, validateCpfTicket } from './useProdSolicTicketPrefill';

const EMPTY_FORM = {
  cpf: '',
  ticketId: '',
  documentosSolicitados: '',
  descricao: '',
  urgente: false,
};

export default function ProdutosDocumentosFormTab({
  onSubmitted,
  onTeamForward,
  ticketOverride,
  clientOverride,
}) {
  const { showNotification } = useNotifications();
  const { prefill, formatCpf } = useProdSolicTicketPrefill({ ticketOverride, clientOverride });
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
    if (!String(form.descricao || '').trim()) {
      showNotification('Descreva a solicitação de documentos.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const request = saveCadastralRequest({
        categoria: 'documentos',
        cpf: form.cpf,
        ticketId: form.ticketId,
        documentosSolicitados: String(form.documentosSolicitados || '').trim(),
        dadoNovo: form.descricao.trim(),
        observacoes: form.descricao.trim(),
        urgente: form.urgente,
      });

      if (!onTeamForward) {
        showNotification('Encaminhamento disponível apenas no contexto do ticket.', 'error');
        return;
      }

      await onTeamForward(request);
      setForm({ ...EMPTY_FORM, cpf: form.cpf, ticketId: form.ticketId });
      onSubmitted?.();
    } catch (err) {
      showNotification(err?.message || 'Não foi possível enviar a solicitação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="prod-solic-form prod-solic-form--documentos" onSubmit={handleSubmit}>
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
        <span className="prod-solic-form__label">Documentos solicitados</span>
        <textarea
          className="prod-solic-form__textarea"
          rows={3}
          value={form.documentosSolicitados}
          onChange={(e) => setForm((prev) => ({ ...prev, documentosSolicitados: e.target.value }))}
          placeholder="Ex.: comprovante de pagamento, extrato, fatura…"
        />
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
