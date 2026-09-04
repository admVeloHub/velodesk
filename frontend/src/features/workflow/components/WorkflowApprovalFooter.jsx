/**
 * WorkflowApprovalFooter — Feito (Produtos) ou Aprovar/Reprovar (Financeiro)
 * + botão "Pendente": pede mais informação ao responsável sem decidir o workflow.
 */
import React, { useState } from 'react';

const FINANCE_ACTIONS = {
  approve: { label: 'Aprovar', icon: 'ti ti-check', className: 'wf-approval-btn wf-approval-btn--approve' },
  reject: { label: 'Reprovar', icon: 'ti ti-x', className: 'wf-approval-btn wf-approval-btn--reject' },
};

function PendingRequestForm({ busy, onCancel, onSubmit }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending || busy) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="wf-approval-footer__pending-form" onSubmit={handleSubmit}>
      <textarea
        rows={2}
        autoFocus
        value={message}
        disabled={sending || busy}
        placeholder="O que falta para decidir? A mensagem vai para o responsável do ticket…"
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="wf-approval-footer__pending-form-actions">
        <button
          type="button"
          className="wf-approval-btn wf-approval-btn--ghost wf-approval-btn--compact"
          disabled={sending}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="wf-approval-btn wf-approval-btn--pending wf-approval-btn--compact"
          disabled={sending || busy || !message.trim()}
        >
          <i className="ti ti-send" aria-hidden="true" />
          {sending ? 'Enviando…' : 'Enviar e marcar como pendente'}
        </button>
      </div>
    </form>
  );
}

export default function WorkflowApprovalFooter({
  teamId,
  awaitingDecision,
  actions = [],
  actionLabels = {},
  busy,
  onFeito,
  onApprove,
  onReject,
  onMarkPending,
}) {
  const [pendingFormOpen, setPendingFormOpen] = useState(false);
  const isProdutos = teamId === 'produtos';

  const handleMarkPending = async (message) => {
    await onMarkPending?.(message);
    setPendingFormOpen(false);
  };

  const pendingButton = onMarkPending ? (
    <button
      type="button"
      className="wf-approval-btn wf-approval-btn--pending wf-approval-btn--compact"
      disabled={busy || pendingFormOpen}
      onClick={() => setPendingFormOpen(true)}
    >
      <i className="ti ti-help-circle" aria-hidden="true" />
      Pendente
    </button>
  ) : null;

  if (isProdutos) {
    return (
      <footer className="wf-approval-footer wf-approval-footer--produtos">
        {pendingFormOpen ? (
          <PendingRequestForm busy={busy} onCancel={() => setPendingFormOpen(false)} onSubmit={handleMarkPending} />
        ) : null}
        <div className="wf-approval-footer__row">
          <div className="wf-approval-footer__actions">
            {pendingButton}
            <button
              type="button"
              className="wf-approval-btn wf-approval-btn--feito"
              disabled={busy}
              onClick={onFeito}
            >
              <i className="ti ti-check" aria-hidden="true" />
              Feito
            </button>
            <button
              type="button"
              className="wf-approval-btn wf-approval-btn--reject wf-approval-btn--compact"
              disabled={busy}
              onClick={onReject}
            >
              Reprovar
            </button>
          </div>
        </div>
      </footer>
    );
  }

  if (!awaitingDecision) return null;

  const list = (actions.length ? actions : ['approve', 'reject']).filter((id) => FINANCE_ACTIONS[id] || actionLabels[id]);

  return (
    <footer className="wf-approval-footer">
      {pendingFormOpen ? (
        <PendingRequestForm busy={busy} onCancel={() => setPendingFormOpen(false)} onSubmit={handleMarkPending} />
      ) : null}
      <div className="wf-approval-footer__row">
        <span className="wf-approval-footer__hint wf-approval-footer__hint--spacer" aria-hidden="true" />
        <div className="wf-approval-footer__actions">
          {pendingButton}
          {list.map((id) => {
            const cfg = FINANCE_ACTIONS[id] || {
              label: actionLabels[id] || id,
              icon: 'ti ti-circle',
              className: 'wf-approval-btn',
            };
            const handler = id === 'approve' ? onApprove : id === 'reject' ? onReject : null;
            if (!handler) return null;
            return (
              <button
                key={id}
                type="button"
                className={`${cfg.className} wf-approval-btn--compact`}
                disabled={busy}
                onClick={handler}
              >
                <i className={cfg.icon} aria-hidden="true" />
                {actionLabels[id] || cfg.label}
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
