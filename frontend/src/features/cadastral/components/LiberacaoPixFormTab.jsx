/**
 * LiberacaoPixFormTab — liberação de chave pix ao time de Produtos
 */
import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { saveCadastralRequest } from '../../../services/cadastral/cadastralRequestStore';
import { PIX_KEY_TYPE_OPTIONS } from '../../../services/cadastral/solicitacoesProdutosData';
import { useProdSolicTicketPrefill, validateCpfTicket } from './useProdSolicTicketPrefill';

const EMPTY_FORM = {
  cpf: '',
  ticketId: '',
  chavePix: '',
  tipoChave: 'cpf',
  observacoes: '',
  urgente: false,
};

export default function LiberacaoPixFormTab({
  onSaved,
  onSubmitted,
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

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateCpfTicket(form, showNotification)) return;
    if (!String(form.chavePix || '').trim()) {
      showNotification('Informe a chave pix.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      saveCadastralRequest({
        categoria: 'liberacao-pix',
        cpf: form.cpf,
        ticketId: form.ticketId,
        tipoInformacao: form.tipoChave,
        dadoAntigo: '',
        dadoNovo: form.chavePix.trim(),
        observacoes: form.observacoes.trim(),
        urgente: form.urgente,
      });
      showNotification('Solicitação de liberação pix enviada ao time de Produtos.', 'success');
      setForm({ ...EMPTY_FORM, cpf: form.cpf, ticketId: form.ticketId });
      onSaved?.();
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
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

      <div className="prod-solic-form__row prod-solic-form__row--2">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Tipo de chave</span>
          <select
            className="prod-solic-form__input"
            value={form.tipoChave}
            onChange={(e) => setForm((prev) => ({ ...prev, tipoChave: e.target.value }))}
          >
            {PIX_KEY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Chave pix</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.chavePix}
            onChange={(e) => setForm((prev) => ({ ...prev, chavePix: e.target.value }))}
            placeholder="Informe a chave para liberação"
          />
        </label>
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
