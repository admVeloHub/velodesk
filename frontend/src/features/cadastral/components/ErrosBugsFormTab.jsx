/**
 * ErrosBugsFormTab — solicitação de erros/bugs ao time de Produtos
 */
import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { saveCadastralRequest } from '../../../services/cadastral/cadastralRequestStore';
import { ERROS_BUGS_TIPO_OPTIONS } from '../../../services/cadastral/solicitacoesProdutosData';
import { useProdSolicTicketPrefill, validateCpfTicket } from './useProdSolicTicketPrefill';
import ProdSolicAttachments, {
  revokeAttachmentPreviews,
  stripAttachmentsForSave,
} from './ProdSolicAttachments';

const EMPTY_FORM = {
  cpf: '',
  ticketId: '',
  tipoErro: 'app',
  descricaoErro: '',
  marca: '',
  modelo: '',
  urgente: false,
};

const EMPTY_ATTACHMENTS = {
  imagens: [],
  videos: [],
  recusouEvidencias: false,
};

export default function ErrosBugsFormTab({
  onSaved,
  onSubmitted,
  ticketOverride,
  clientOverride,
}) {
  const { showNotification } = useNotifications();
  const { prefill, formatCpf } = useProdSolicTicketPrefill({ ticketOverride, clientOverride });
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState(EMPTY_ATTACHMENTS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      cpf: prefill.cpf || prev.cpf,
      ticketId: prefill.ticketId || prev.ticketId,
    }));
  }, [prefill]);

  useEffect(() => () => {
    revokeAttachmentPreviews(attachments.imagens, attachments.videos);
  }, [attachments.imagens, attachments.videos]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateCpfTicket(form, showNotification)) return;
    if (!String(form.descricaoErro || '').trim()) {
      showNotification('Descreva o erro ou bug.', 'error');
      return;
    }

    const hasAnexos = attachments.imagens.length > 0 || attachments.videos.length > 0;
    if (!hasAnexos && !attachments.recusouEvidencias) {
      showNotification('Anexe evidências ou marque "Cliente Recusou Evidencias".', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { anexosImagens, anexosVideos } = stripAttachmentsForSave(
        attachments.imagens,
        attachments.videos,
      );

      saveCadastralRequest({
        categoria: 'erros-bugs',
        cpf: form.cpf,
        ticketId: form.ticketId,
        tipoErro: form.tipoErro,
        dadoNovo: form.descricaoErro.trim(),
        observacoes: form.descricaoErro.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        clienteRecusouEvidencias: attachments.recusouEvidencias,
        anexosImagens,
        anexosVideos,
        urgente: form.urgente,
      });

      revokeAttachmentPreviews(attachments.imagens, attachments.videos);
      showNotification('Erro/bug registrado e enviado ao time de Produtos.', 'success');
      setForm({ ...EMPTY_FORM, cpf: form.cpf, ticketId: form.ticketId });
      setAttachments(EMPTY_ATTACHMENTS);
      onSaved?.();
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="prod-solic-form prod-solic-form--erros-bugs" onSubmit={handleSubmit}>
      <label className="prod-solic-form__field prod-solic-form__field--ticket-first">
        <span className="prod-solic-form__label">Ticket</span>
        <input
          type="text"
          className="prod-solic-form__input"
          value={form.ticketId}
          onChange={(e) => setForm((prev) => ({ ...prev, ticketId: e.target.value }))}
        />
      </label>

      <div className="prod-solic-form__row prod-solic-form__row--2">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">CPF</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.cpf}
            onChange={(e) => setForm((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }))}
          />
        </label>
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Tipo</span>
          <select
            className="prod-solic-form__input"
            value={form.tipoErro}
            onChange={(e) => setForm((prev) => ({ ...prev, tipoErro: e.target.value }))}
          >
            {ERROS_BUGS_TIPO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="prod-solic-form__field">
        <span className="prod-solic-form__label">Descrição</span>
        <textarea
          className="prod-solic-form__textarea prod-solic-form__textarea--tall"
          rows={6}
          value={form.descricaoErro}
          onChange={(e) => setForm((prev) => ({ ...prev, descricaoErro: e.target.value }))}
          placeholder="Descreva o comportamento incorreto, tela ou fluxo afetado…"
        />
      </label>

      <div className="prod-solic-form__row prod-solic-form__row--2">
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Marca</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.marca}
            onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))}
          />
        </label>
        <label className="prod-solic-form__field">
          <span className="prod-solic-form__label">Modelo</span>
          <input
            type="text"
            className="prod-solic-form__input"
            value={form.modelo}
            onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))}
          />
        </label>
      </div>

      <ProdSolicAttachments
        imagens={attachments.imagens}
        videos={attachments.videos}
        recusouEvidencias={attachments.recusouEvidencias}
        onChange={setAttachments}
      />

      <div className="prod-solic-form__actions">
        <button
          type="button"
          className={'prod-solic-form__urgent' + (form.urgente ? ' is-active' : '')}
          onClick={() => setForm((prev) => ({ ...prev, urgente: !prev.urgente }))}
        >
          Solicitação Urgente
        </button>
        <button type="submit" className="prod-solic-form__submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}
