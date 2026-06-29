/**
 * DeskComposePanel v1.4.1 — resposta pública / anotação interna + corretor ortográfico
 * VERSION: v1.4.1 | DATE: 2026-06-26
 */
import React, { useEffect, useRef, useState } from 'react';
import { SEND_STATUS_OPTIONS } from '../../../services/desk/constants';
import { useComposeSpellCheck } from '../../../hooks/useComposeSpellCheck';
import { useTabulation } from '../../../context/TabulationContext';
import SpellSuggestionBar, { SpellErrorsPanel } from './SpellSuggestionBar';
import SpellComposeTextarea from './SpellComposeTextarea';

const MACROS = [
  { value: 'F1', label: 'F1 — Saudação padrão', text: 'Olá! Obrigado por entrar em contato. Como posso ajudá-lo(a) hoje?' },
  { value: 'F2', label: 'F2 — Aguardar retorno', text: 'Estamos analisando sua solicitação e retornaremos em breve.' },
  { value: 'F3', label: 'F3 — Escalonamento', text: 'Encaminhei sua solicitação para a equipe especializada.' },
  { value: 'F4', label: 'F4 — Encerramento NPS', text: 'Agradecemos o contato. Por favor, avalie nosso atendimento.' },
];

export function DeskStatusCommitButton({ sendStatus, onCommitStatus, variant = 'compose', disabled = false }) {
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

  useEffect(() => {
    if (disabled) setMenuOpen(false);
  }, [disabled]);

  const isPanel = variant === 'panel';

  return (
    <div
      className={'crm-send-status' + (isPanel ? ' crm-send-status--panel' : '') + (disabled ? ' crm-send-status--disabled' : '')}
      id="crmSendStatus"
      ref={menuRef}
    >
      <button
        type="button"
        className={
          (isPanel
            ? 'rp-footer-btn rp-footer-btn--primary crm-send-status__trigger-panel'
            : 'crm-send-status__trigger crm-send-status__trigger--' + currentStatus.cls)
          + (disabled ? ' is-disabled' : '')
        }
        id="crmStatusDropdown"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-disabled={disabled}
        disabled={disabled}
        title={disabled ? 'Corrija os erros ortográficos antes de enviar' : undefined}
        onClick={() => {
          if (disabled) return;
          setMenuOpen((v) => !v);
        }}
      >
        {isPanel ? (
          <>
            <i className="ti ti-send" />
            Enviar como
            <i className="ti ti-chevron-down" />
          </>
        ) : (
          <>
            {currentStatus.label} <i className="ti ti-chevron-down" />
          </>
        )}
      </button>
      <div className="crm-send-status__menu" id="crmStatusMenu" role="listbox" hidden={!menuOpen || disabled}>
        {SEND_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={'crm-send-status__option crm-send-status__option--' + opt.cls}
            role="option"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setMenuOpen(false);
              onCommitStatus(opt.id);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** @deprecated use DeskStatusCommitButton */
export const DeskComposeFooter = DeskStatusCommitButton;

function InternalNoteFields({
  ticketId,
  internalText,
  onInternalTextChange,
  tabulationConfig,
  spellIgnoredWords,
  onIgnoreSpellWord,
}) {
  const tid = String(ticketId);
  const spell = useComposeSpellCheck({
    text: internalText,
    onTextChange: onInternalTextChange,
    tabulationConfig,
    ignoredWords: spellIgnoredWords,
    onIgnoreWord: onIgnoreSpellWord,
    trackFlaggedErrors: false,
  });

  return (
    <div className="response-form internal-form crm-notes-compose__form spell-compose-wrap">
      <div className="crm-notes-compose__header">
        <i className="fas fa-lock" aria-hidden="true" />
        <span>Anotação interna — não será enviada ao cliente</span>
      </div>
      <SpellSuggestionBar
        suggestion={spell.activeSuggestion}
        loading={spell.spellLoading}
        loadError={spell.spellLoadError}
        onApply={spell.applySuggestion}
        onDismiss={spell.dismissSuggestion}
        onIgnore={spell.ignoreSuggestion}
      />
      <SpellComposeTextarea
        id={'internalResponse-' + tid}
        className="response-textarea crm-notes-compose__textarea"
        placeholder="Digite uma anotação interna..."
        rows={5}
        value={internalText}
        flaggedErrors={spell.flaggedErrors}
        activeErrorStartIndex={spell.activeErrorStartIndex}
        onChange={spell.handleChange}
        onKeyDown={spell.handleKeyDown}
        onBlur={spell.handleBlur}
        onSelect={spell.handleSelect}
        onClick={spell.handleClick}
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
  spellIgnoredWords,
  onIgnoreSpellWord,
  onFlaggedErrorsChange,
}) {
  const tid = String(ticketId);
  const { config: tabulationConfig } = useTabulation();

  const spell = useComposeSpellCheck({
    text: composeText,
    onTextChange: onComposeTextChange,
    tabulationConfig,
    ignoredWords: spellIgnoredWords,
    onIgnoreWord: onIgnoreSpellWord,
    onFlaggedErrorsChange,
    trackFlaggedErrors: true,
  });

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
                <div className="response-form spell-compose-wrap">
                  <SpellErrorsPanel
                    errors={spell.flaggedErrors}
                    onApplyFix={spell.applyErrorFix}
                  />
                  <SpellSuggestionBar
                    suggestion={spell.activeSuggestion}
                    loading={spell.spellLoading}
                    loadError={spell.spellLoadError}
                    onApply={spell.applySuggestion}
                    onDismiss={spell.dismissSuggestion}
                    onIgnore={spell.ignoreSuggestion}
                  />
                  <SpellComposeTextarea
                    id={'publicResponse-' + tid}
                    className="response-textarea"
                    placeholder="Digite sua resposta ao cliente..."
                    rows={5}
                    value={composeText}
                    flaggedErrors={spell.flaggedErrors}
                    activeErrorStartIndex={spell.activeErrorStartIndex}
                    onChange={spell.handleChange}
                    onKeyDown={spell.handleKeyDown}
                    onBlur={spell.handleBlur}
                    onSelect={spell.handleSelect}
                    onClick={spell.handleClick}
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
                  tabulationConfig={tabulationConfig}
                  spellIgnoredWords={spellIgnoredWords}
                  onIgnoreSpellWord={onIgnoreSpellWord}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
