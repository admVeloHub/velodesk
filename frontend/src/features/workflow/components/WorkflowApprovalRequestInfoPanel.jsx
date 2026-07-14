import React, { useEffect, useRef, useState } from 'react';

export default function WorkflowApprovalRequestInfoPanel({
  open,
  busy,
  responsibleAgent,
  requestedBy,
  onSubmit,
  onCancel,
}) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMessage('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <form className="wf-approval-info-panel" onSubmit={handleSubmit}>
      <div className="wf-approval-info-panel__head">
        <h4>Solicitar informação ao responsável</h4>
        <p>
          A solicitação será enviada como notificação na área de workflow do agente
          {' '}
          <strong>{responsibleAgent || 'responsável pelo ticket'}</strong>.
        </p>
      </div>

      <label className="wf-approval-info-panel__label" htmlFor="wf-info-message">
        O que você precisa saber?
      </label>
      <textarea
        id="wf-info-message"
        ref={textareaRef}
        className="wf-approval-info-panel__textarea"
        rows={4}
        placeholder="Ex.: Confirmar se o comprovante de pagamento foi anexado ao ticket."
        value={message}
        disabled={busy}
        onChange={(e) => setMessage(e.target.value)}
      />

      <p className="wf-approval-info-panel__hint">
        Solicitado por <strong>{requestedBy || 'Operador Workflow'}</strong>
      </p>

      <div className="wf-approval-info-panel__actions">
        <button
          type="button"
          className="wf-approval-info-panel__btn wf-approval-info-panel__btn--ghost"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="wf-approval-info-panel__btn wf-approval-info-panel__btn--primary"
          disabled={busy || !message.trim()}
        >
          <i className="ti ti-send" aria-hidden="true" />
          Enviar solicitação
        </button>
      </div>
    </form>
  );
}
