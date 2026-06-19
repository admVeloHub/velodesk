/**
 * DeskComposePanel v1.1.0 — resposta pública / anotação interna + enviar
 */
import React, { useEffect, useRef, useState } from 'react';
import { SEND_STATUS_OPTIONS } from '../../../services/desk/constants';

const MACROS = [
  { value: 'F1', label: 'F1 — Saudação padrão', text: 'Olá! Obrigado por entrar em contato. Como posso ajudá-lo(a) hoje?' },
  { value: 'F2', label: 'F2 — Aguardar retorno', text: 'Estamos analisando sua solicitação e retornaremos em breve.' },
  { value: 'F3', label: 'F3 — Escalonamento', text: 'Encaminhei sua solicitação para a equipe especializada.' },
  { value: 'F4', label: 'F4 — Encerramento NPS', text: 'Agradecemos o contato. Por favor, avalie nosso atendimento.' },
];

export function DeskComposeFooter({ sendStatus, onSendStatusChange, onSend }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentStatus = SEND_STATUS_OPTIONS.find((o) => o.id === sendStatus) || SEND_STATUS_OPTIONS[0];

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="crm-ticket-compose-footer">
      <div className="compose-actions">
        <div className="crm-send-status" id="crmSendStatus" ref={menuRef}>
          <button
            type="button"
            className={'crm-send-status__trigger crm-send-status__trigger--' + currentStatus.cls}
            id="crmStatusDropdown"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {currentStatus.label} <i className="ti ti-chevron-down" />
          </button>
          <div className="crm-send-status__menu" id="crmStatusMenu" role="listbox" hidden={!menuOpen}>
            {SEND_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={'crm-send-status__option crm-send-status__option--' + opt.cls}
                role="option"
                onClick={() => { onSendStatusChange(opt.id); setMenuOpen(false); onSend(opt.id); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InternalNoteFields({ ticketId, internalText, onInternalTextChange }) {
  const tid = String(ticketId);
  return (
    <div className="response-form internal-form crm-notes-compose__form">
      <div className="crm-notes-compose__header">
        <i className="fas fa-lock" aria-hidden="true" />
        <span>Anotação interna — não será enviada ao cliente</span>
      </div>
      <textarea
        className="response-textarea crm-notes-compose__textarea"
        id={'internalResponse-' + tid}
        data-ai-skip="true"
        placeholder="Digite uma anotação interna..."
        rows={5}
        value={internalText}
        onChange={(e) => onInternalTextChange(e.target.value)}
      />
    </div>
  );
}

export default function DeskComposePanel({
  ticketId,
  composeMode,
  composeText,
  internalText,
  onComposeModeChange,
  onComposeTextChange,
  onInternalTextChange,
  onOpenAi,
}) {
  const tid = String(ticketId);

  const applyMacro = (value) => {
    const macro = MACROS.find((m) => m.value === value);
    if (macro) onComposeTextChange(macro.text);
  };

  return (
    <div className="crm-ticket-compose">
      <div className="ticket-response octa-comment-panel crm-ticket-response">
        <div className="octa-comment-panel-row">
          <div className="octa-panel-avatar" aria-hidden="true"><i className="fas fa-user" /></div>
          <div className="octa-panel-box">
            <div className="response-tabs octa-nav-tabs">
              <button
                type="button"
                className={'response-tab octa-nav-tab octa-tab-public' + (composeMode === 'public' ? ' active' : '')}
                data-compose="public"
                onClick={() => onComposeModeChange('public')}
              >
                <i className="fas fa-envelope" /> Resposta pública
              </button>
              <button
                type="button"
                className={'response-tab octa-nav-tab octa-tab-internal' + (composeMode === 'internal' ? ' active' : '')}
                data-compose="internal"
                onClick={() => onComposeModeChange('internal')}
              >
                <i className="fas fa-edit" /> Anotação interna
              </button>
            </div>
            <div className="response-content octa-response-panel-body">
              <div className={'response-tab-content' + (composeMode === 'public' ? ' active' : '')} id={'public-' + tid}>
                <div className="response-form">
                  <textarea
                    className="response-textarea"
                    id={'publicResponse-' + tid}
                    data-ai-skip="true"
                    placeholder="Digite sua resposta ao cliente..."
                    rows={5}
                    value={composeText}
                    onChange={(e) => onComposeTextChange(e.target.value)}
                  />
                  <div className="response-actions ticket-response-actions">
                    <div className="ticket-macro-hub">
                      <select
                        className="ticket-macro-select"
                        aria-label="Central de opções de resposta"
                        value=""
                        onChange={(e) => applyMacro(e.target.value)}
                      >
                        <option value="">Central de opções</option>
                        {MACROS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="btn-secondary" id="btnCrmAiAssistant" onClick={onOpenAi}>
                      <i className="fas fa-robot" /> Assistente IA
                    </button>
                  </div>
                </div>
              </div>
              <div className={'response-tab-content' + (composeMode === 'internal' ? ' active' : '')} id={'internal-' + tid}>
                <InternalNoteFields
                  ticketId={ticketId}
                  internalText={internalText}
                  onInternalTextChange={onInternalTextChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
