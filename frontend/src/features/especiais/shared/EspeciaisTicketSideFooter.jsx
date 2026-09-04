/**
 * EspeciaisTicketSideFooter — Abrir conversa, Salvar ticket e Finalizar
 */
import React from 'react';

export default function EspeciaisTicketSideFooter({
  waChatOpen = false,
  onOpenChat,
  onCloseChat,
  onSave,
  onFinalize,
  saving = false,
  disabled = false,
  finalized = false,
  initialMessagePrompt = null,
}) {
  const actionsDisabled = disabled || saving;

  return (
    <div className="ra-ticket__side-footer">
      {initialMessagePrompt ? (
        <div className="especiais-initial-message-prompt" role="group" aria-label="Enviar mensagem inicial ao cliente">
          <span className="especiais-initial-message-prompt__label">Enviar Mensagem:</span>
          <div className="especiais-initial-message-prompt__options">
            <button
              type="button"
              className="especiais-initial-message-prompt__btn especiais-initial-message-prompt__btn--yes"
              disabled={initialMessagePrompt.busy}
              onClick={() => initialMessagePrompt.onChoose?.('yes')}
            >
              Sim
            </button>
            <button
              type="button"
              className="especiais-initial-message-prompt__btn especiais-initial-message-prompt__btn--no"
              disabled={initialMessagePrompt.busy}
              onClick={() => initialMessagePrompt.onChoose?.('no')}
            >
              Não
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`rp-footer-btn rp-footer-btn--secondary${waChatOpen ? ' is-active' : ''}`}
        id="btnOpenChat"
        onClick={waChatOpen ? onCloseChat : onOpenChat}
      >
        <i className="ti ti-message-circle" aria-hidden="true" />
        {waChatOpen ? 'Fechar conversa' : 'Abrir conversa'}
      </button>
      <button
        type="button"
        className="ra-ticket__save-btn"
        onClick={onSave}
        disabled={actionsDisabled}
      >
        <i className="ti ti-device-floppy" aria-hidden="true" />
        {saving ? 'Salvando…' : 'Salvar ticket'}
      </button>
      <button
        type="button"
        className="ra-ticket__finalize-btn"
        onClick={onFinalize}
        disabled={actionsDisabled || finalized}
      >
        <i className="ti ti-circle-check" aria-hidden="true" />
        {saving ? 'Processando…' : 'Finalizar'}
      </button>
    </div>
  );
}
