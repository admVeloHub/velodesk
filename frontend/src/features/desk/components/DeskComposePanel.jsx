/**
 * DeskComposePanel v1.9.2 — remove avatar ao lado do compose
 * VERSION: v1.9.2 | DATE: 2026-07-03
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SEND_STATUS_OPTIONS } from '../../../services/desk/constants';
import { useComposeSpellCheck } from '../../../hooks/useComposeSpellCheck';
import { useTabulation } from '../../../context/TabulationContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { htmlToPlainText, normalizePlainToHtml } from '../../../services/desk/composeRichEditor';
import SpellSuggestionBar, { SpellErrorsPanel } from './SpellSuggestionBar';
import ComposeRichEditor from './ComposeRichEditor';
import ComposeFormatToolbar, { useComposeFormat } from './ComposeFormatToolbar';
import ComposeRefinarModal from './ComposeRefinarModal';

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

function ComposeBottomBar({
  formatToolbar,
  showMacros = false,
  onMacroSelect,
  onOpenRefinar,
}) {
  return (
    <div className="crm-compose-bottom-bar ticket-response-actions" role="group" aria-label="Ferramentas do compose">
      {formatToolbar}
      {showMacros ? (
        <>
          <span className="crm-compose-bottom-bar__sep" aria-hidden="true" />
          <div className="crm-compose-bottom-bar__tools">
            <div className="ticket-macro-hub crm-compose-bottom-bar__macros">
              <select
                className="ticket-macro-select"
                aria-label="Central de opções de resposta"
                value=""
                onChange={(e) => onMacroSelect?.(e.target.value)}
              >
                <option value="">Central de opções</option>
                {MACROS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-secondary crm-compose-bottom-bar__ai" id="btnCrmAiAssistant" onClick={onOpenRefinar}>
              <i className="fas fa-robot" /> Assistente IA
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function InternalNoteFields({
  ticketId,
  internalText,
  onInternalTextChange,
  tabulationConfig,
  spellIgnoredWords,
  onIgnoreSpellWord,
  placeholder = 'Digite uma anotação interna...',
}) {
  const tid = String(ticketId);
  const internalEditorRef = useRef(null);
  const internalPlainText = useMemo(() => htmlToPlainText(internalText), [internalText]);

  const handleInternalReplace = useCallback((startIndex, deleteCount, insertText) => {
    internalEditorRef.current?.replacePlainRange(startIndex, deleteCount, insertText);
  }, []);

  const spell = useComposeSpellCheck({
    text: internalPlainText,
    onTextChange: onInternalTextChange,
    onReplaceRange: handleInternalReplace,
    tabulationConfig,
    ignoredWords: spellIgnoredWords,
    onIgnoreWord: onIgnoreSpellWord,
    trackFlaggedErrors: false,
  });

  const internalFormat = useComposeFormat({
    richEditorRef: internalEditorRef,
    mode: 'rich',
  });

  const handleInternalChange = useCallback(({ html }) => {
    onInternalTextChange(html);
  }, [onInternalTextChange]);

  const handleInternalKeyDown = (event) => {
    if (internalFormat.handleKeyDown(event)) return;
    spell.handleKeyDown({
      ...event,
      target: {
        ...event.target,
        selectionStart: internalEditorRef.current?.getCursor?.() ?? internalPlainText.length,
        value: internalPlainText,
      },
    });
  };

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
      <ComposeRichEditor
        ref={internalEditorRef}
        id={'internalResponse-' + tid}
        className="response-textarea crm-notes-compose__textarea"
        placeholder={placeholder}
        value={internalText}
        hasSpellErrors={spell.flaggedErrors.length > 0}
        onFormatStateChange={internalFormat.handleFormatStateChange}
        onChange={handleInternalChange}
        onKeyDown={handleInternalKeyDown}
        onBlur={spell.handleBlur}
        onSelect={spell.handleSelect}
        onClick={spell.handleClick}
      />
      <ComposeBottomBar
        formatToolbar={(
          <ComposeFormatToolbar
            applyAction={internalFormat.applyAction}
            activeFormats={internalFormat.activeFormats}
            variant="internal"
            embedded
          />
        )}
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
  spellIgnoredWords,
  onIgnoreSpellWord,
  onFlaggedErrorsChange,
  variant = 'full',
  workflowLocked = false,
  workflowTeamLabel = '',
}) {
  const tid = String(ticketId);
  const publicEditorRef = useRef(null);
  const composePlainText = useMemo(() => htmlToPlainText(composeText), [composeText]);
  const { config: tabulationConfig } = useTabulation();
  const { user, colaborador } = useAuth();
  const { showNotification } = useNotifications();
  const [refinarOpen, setRefinarOpen] = useState(false);
  const [refinarDraft, setRefinarDraft] = useState('');
  const showPublic = variant === 'full' || variant === 'public-only';
  const showInternal = variant === 'full' || variant === 'internal-only';
  const publicLocked = workflowLocked && composeMode === 'public';
  const internalPlaceholder = workflowLocked
    ? `Aguardando ${workflowTeamLabel || 'equipe'} • Você pode adicionar uma nota interna...`
    : 'Digite uma anotação interna...';
  const publicPlaceholder = workflowLocked
    ? `Aguardando ${workflowTeamLabel || 'equipe'} • resposta pública indisponível`
    : 'Digite sua resposta ao cliente...';

  const nomeOperador = useMemo(() => {
    const full = String(user?.name || colaborador?.nome || colaborador?.name || '').trim();
    return full.split(/\s+/)[0] || '';
  }, [user, colaborador]);

  const handlePublicReplace = useCallback((startIndex, deleteCount, insertText) => {
    publicEditorRef.current?.replacePlainRange(startIndex, deleteCount, insertText);
  }, []);

  const spell = useComposeSpellCheck({
    text: composePlainText,
    onTextChange: onComposeTextChange,
    onReplaceRange: handlePublicReplace,
    tabulationConfig,
    ignoredWords: spellIgnoredWords,
    onIgnoreWord: onIgnoreSpellWord,
    onFlaggedErrorsChange,
    trackFlaggedErrors: true,
  });

  const publicFormat = useComposeFormat({
    richEditorRef: publicEditorRef,
    mode: 'rich',
  });

  const handlePublicChange = useCallback(({ html }) => {
    onComposeTextChange(html);
  }, [onComposeTextChange]);

  const handlePublicKeyDown = (event) => {
    if (publicFormat.handleKeyDown(event)) return;
    spell.handleKeyDown({
      ...event,
      target: {
        ...event.target,
        selectionStart: publicEditorRef.current?.getCursor?.() ?? composePlainText.length,
        value: composePlainText,
      },
    });
  };

  const applyMacro = (value) => {
    const macro = MACROS.find((m) => m.value === value);
    if (macro) publicEditorRef.current?.insertPlainText(macro.text);
  };

  const handleOpenRefinar = () => {
    const texto = composePlainText.trim();
    if (!texto) {
      showNotification('Digite um rascunho antes de usar o Assistente IA.', 'warning');
      return;
    }
    setRefinarDraft(texto);
    setRefinarOpen(true);
  };

  const handleApplyRefinar = useCallback((plainText) => {
    onComposeTextChange(normalizePlainToHtml(plainText));
  }, [onComposeTextChange]);

  return (
    <div className={
      'crm-ticket-compose'
      + (variant === 'internal-only' ? ' crm-ticket-compose--notes' : '')
      + (workflowLocked ? ' crm-ticket-compose--workflow-locked' : '')
    }>
      <div className="ticket-response octa-comment-panel crm-ticket-response">
        <div className="octa-comment-panel-row">
          <div className="octa-panel-box">
            {variant === 'full' ? (
            <div className="response-tabs octa-nav-tabs">
              <button
                type="button"
                className={'response-tab octa-nav-tab octa-tab-public' + (composeMode === 'public' ? ' active' : '')}
                data-compose="public"
                onClick={() => onComposeModeChange('public')}
                disabled={workflowLocked}
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
            ) : null}
            <div className="response-content octa-response-panel-body">
              {showPublic ? (
              <div className={'response-tab-content' + (variant === 'full' && composeMode !== 'public' ? '' : ' active')} id={'public-' + tid}>
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
                  <ComposeRichEditor
                    ref={publicEditorRef}
                    id={'publicResponse-' + tid}
                    className="response-textarea"
                    placeholder={publicPlaceholder}
                    value={composeText}
                    hasSpellErrors={spell.flaggedErrors.length > 0}
                    expandable
                    onFormatStateChange={publicFormat.handleFormatStateChange}
                    onChange={handlePublicChange}
                    onKeyDown={handlePublicKeyDown}
                    onBlur={spell.handleBlur}
                    onSelect={spell.handleSelect}
                    onClick={spell.handleClick}
                  />
                  <ComposeBottomBar
                    showMacros
                    onMacroSelect={applyMacro}
                    onOpenRefinar={handleOpenRefinar}
                    formatToolbar={(
                      <ComposeFormatToolbar
                        applyAction={publicFormat.applyAction}
                        activeFormats={publicFormat.activeFormats}
                        variant="public"
                        embedded
                      />
                    )}
                  />
                  <ComposeRefinarModal
                    open={refinarOpen}
                    onClose={() => setRefinarOpen(false)}
                    draftText={refinarDraft}
                    nomeOperador={nomeOperador}
                    onApply={handleApplyRefinar}
                  />
                </div>
              </div>
              ) : null}
              {showInternal ? (
              <div className={'response-tab-content' + (variant === 'full' && composeMode !== 'internal' ? '' : ' active')} id={'internal-' + tid}>
                <InternalNoteFields
                  ticketId={ticketId}
                  internalText={internalText}
                  onInternalTextChange={onInternalTextChange}
                  tabulationConfig={tabulationConfig}
                  spellIgnoredWords={spellIgnoredWords}
                  onIgnoreSpellWord={onIgnoreSpellWord}
                  placeholder={internalPlaceholder}
                />
              </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {workflowLocked ? (
        <div className="desk-workflow-compose-lock" role="status">
          <i className="ti ti-lock" aria-hidden="true" />
          <span>Workflow ativo • aprovação pendente</span>
        </div>
      ) : null}
    </div>
  );
}
