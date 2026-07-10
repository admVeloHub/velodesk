/**
 * DeskComposePanel v1.12.4 — status de envio por perfil (agente/supervisor)
 * VERSION: v1.12.4 | DATE: 2026-07-10
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPOSE_SPELLCHECK_ENABLED, getSendStatusOptions } from '../../../services/desk/constants';
import { useComposeSpellCheck } from '../../../hooks/useComposeSpellCheck';
import { useProfile } from '../../../context/ProfileContext';
import { readAuthDeskRole } from '../../../services/desk/responsavelSegmentation';
import { useTabulation } from '../../../context/TabulationContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { htmlToPlainText, normalizeComposePlain, normalizePlainToHtml } from '../../../services/desk/composeRichEditor';
import SpellSuggestionBar, { SpellErrorsPanel } from './SpellSuggestionBar';
import ComposeRichEditor from './ComposeRichEditor';
import ComposeFormatToolbar, { useComposeFormat } from './ComposeFormatToolbar';
import ComposeRefinarModal from './ComposeRefinarModal';

export function DeskStatusCommitButton({
  sendStatus,
  onCommitStatus,
  variant = 'compose',
  disabled = false,
  disabledTitle,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { profileId } = useProfile();
  const sendRole = readAuthDeskRole() || profileId;
  const sendStatusOptions = useMemo(() => getSendStatusOptions(sendRole), [sendRole]);
  const currentStatus = sendStatusOptions.find((o) => o.id === sendStatus) || sendStatusOptions[0];

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
        title={disabled ? (disabledTitle || 'Envio indisponível') : undefined}
        onClick={() => {
          if (disabled) return;
          setMenuOpen((v) => !v);
        }}
      >
        {isPanel ? (
          <>
            <i className="ti ti-send" />
            {currentStatus.label}
            <i className="ti ti-chevron-down" />
          </>
        ) : (
          <>
            {currentStatus.label} <i className="ti ti-chevron-down" />
          </>
        )}
      </button>
      <div className="crm-send-status__menu" id="crmStatusMenu" role="listbox" hidden={!menuOpen || disabled}>
        {sendStatusOptions.map((opt) => (
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
  onOpenRefinar,
  aiReviewPending = false,
}) {
  return (
    <div className="crm-compose-bottom-bar ticket-response-actions" role="group" aria-label="Ferramentas do compose">
      {formatToolbar}
      {onOpenRefinar ? (
        <>
          <span className="crm-compose-bottom-bar__sep" aria-hidden="true" />
          <div className="crm-compose-bottom-bar__tools">
            <button
              type="button"
              className={'btn-secondary crm-compose-bottom-bar__ai' + (aiReviewPending ? ' crm-compose-bottom-bar__ai--required' : '')}
              id="btnCrmAiAssistant"
              title={aiReviewPending ? 'Use a sugestão de resposta da IA ou a Revisão de texto antes de enviar' : undefined}
              onClick={onOpenRefinar}
            >
              <i className="fas fa-robot" /> Revisão de texto
              {aiReviewPending ? <span className="crm-compose-bottom-bar__ai-badge" aria-hidden="true">*</span> : null}
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
  extraWhitelistTerms,
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
    extraWhitelistTerms,
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
    if (!COMPOSE_SPELLCHECK_ENABLED) return;
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
    <div className={'response-form internal-form crm-notes-compose__form' + (COMPOSE_SPELLCHECK_ENABLED ? ' spell-compose-wrap' : '')}>
      <div className="crm-notes-compose__header">
        <i className="fas fa-lock" aria-hidden="true" />
        <span>Anotação interna — não será enviada ao cliente</span>
      </div>
      {COMPOSE_SPELLCHECK_ENABLED ? (
        <SpellSuggestionBar
          suggestion={spell.activeSuggestion}
          loading={spell.spellLoading}
          loadError={spell.spellLoadError}
          onApply={spell.applySuggestion}
          onDismiss={spell.dismissSuggestion}
          onIgnore={spell.dismissSuggestion}
          onAddToVocabulary={spell.ignoreWord}
        />
      ) : null}
      <ComposeRichEditor
        ref={internalEditorRef}
        id={'internalResponse-' + tid}
        className="response-textarea crm-notes-compose__textarea"
        placeholder="Digite uma anotação interna..."
        value={internalText}
        hasSpellErrors={COMPOSE_SPELLCHECK_ENABLED && spell.flaggedErrors.length > 0}
        onFormatStateChange={internalFormat.handleFormatStateChange}
        onChange={handleInternalChange}
        onKeyDown={handleInternalKeyDown}
        onBlur={COMPOSE_SPELLCHECK_ENABLED ? spell.handleBlur : undefined}
        onSelect={COMPOSE_SPELLCHECK_ENABLED ? spell.handleSelect : undefined}
        onClick={COMPOSE_SPELLCHECK_ENABLED ? spell.handleClick : undefined}
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
  onComposeAiReviewed,
  aiReviewPending = false,
  clientDisplayName = '',
  variant = 'full',
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

  const nomeOperador = useMemo(() => {
    const full = String(user?.name || colaborador?.nome || colaborador?.name || '').trim();
    return full.split(/\s+/)[0] || '';
  }, [user, colaborador]);

  const spellExtraNames = useMemo(() => (
    [
      user?.name,
      colaborador?.nome || colaborador?.name,
      clientDisplayName,
    ].map((item) => String(item || '').trim()).filter(Boolean)
  ), [user, colaborador, clientDisplayName]);

  const handlePublicReplace = useCallback((startIndex, deleteCount, insertText) => {
    publicEditorRef.current?.replacePlainRange(startIndex, deleteCount, insertText);
  }, []);

  const spell = useComposeSpellCheck({
    text: composePlainText,
    onTextChange: onComposeTextChange,
    onReplaceRange: handlePublicReplace,
    tabulationConfig,
    ignoredWords: spellIgnoredWords,
    extraWhitelistTerms: spellExtraNames,
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
    if (!COMPOSE_SPELLCHECK_ENABLED) return;
    spell.handleKeyDown({
      ...event,
      target: {
        ...event.target,
        selectionStart: publicEditorRef.current?.getCursor?.() ?? composePlainText.length,
        value: composePlainText,
      },
    });
  };

  const handleOpenRefinar = () => {
    const texto = composePlainText.trim();
    if (!texto) {
      showNotification('Digite um rascunho antes de usar a Revisão de texto.', 'warning');
      return;
    }
    setRefinarDraft(texto);
    setRefinarOpen(true);
  };

  const handleApplyRefinar = useCallback((plainText) => {
    const trimmed = normalizeComposePlain(plainText);
    const html = normalizePlainToHtml(trimmed);
    onComposeTextChange(html);
    onComposeAiReviewed?.(normalizeComposePlain(html));
  }, [onComposeTextChange, onComposeAiReviewed]);

  const handleReviewComplete = useCallback((draftPlainText) => {
    onComposeAiReviewed?.(String(draftPlainText || '').trim());
  }, [onComposeAiReviewed]);

  const spellPanelErrors = useMemo(() => {
    if (!spell.activeSuggestion) return spell.flaggedErrors;
    return spell.flaggedErrors.filter(
      (error) => error.startIndex !== spell.activeSuggestion.startIndex,
    );
  }, [spell.flaggedErrors, spell.activeSuggestion]);

  return (
    <div className={'crm-ticket-compose' + (variant === 'internal-only' ? ' crm-ticket-compose--notes' : '')}>
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
                <div className={'response-form' + (COMPOSE_SPELLCHECK_ENABLED ? ' spell-compose-wrap' : '')}>
                  {COMPOSE_SPELLCHECK_ENABLED ? (
                    <>
                      <SpellErrorsPanel
                        errors={spellPanelErrors}
                        totalCount={spell.flaggedErrors.length}
                        onApplyFix={spell.applyErrorFix}
                        onIgnoreWord={spell.ignoreWord}
                      />
                      <SpellSuggestionBar
                        suggestion={spell.activeSuggestion}
                        loading={spell.spellLoading}
                        loadError={spell.spellLoadError}
                        onApply={spell.applySuggestion}
                        onDismiss={spell.dismissSuggestion}
                        onIgnore={spell.dismissSuggestion}
                        onAddToVocabulary={spell.ignoreWord}
                      />
                    </>
                  ) : null}
                  <ComposeRichEditor
                    ref={publicEditorRef}
                    id={'publicResponse-' + tid}
                    className="response-textarea"
                    placeholder="Digite sua resposta ao cliente..."
                    value={composeText}
                    hasSpellErrors={COMPOSE_SPELLCHECK_ENABLED && spell.flaggedErrors.length > 0}
                    onFormatStateChange={publicFormat.handleFormatStateChange}
                    onChange={handlePublicChange}
                    onKeyDown={handlePublicKeyDown}
                    onBlur={COMPOSE_SPELLCHECK_ENABLED ? spell.handleBlur : undefined}
                    onSelect={COMPOSE_SPELLCHECK_ENABLED ? spell.handleSelect : undefined}
                    onClick={COMPOSE_SPELLCHECK_ENABLED ? spell.handleClick : undefined}
                  />
                  <ComposeBottomBar
                    onOpenRefinar={handleOpenRefinar}
                    aiReviewPending={aiReviewPending}
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
                    onReviewComplete={handleReviewComplete}
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
                  extraWhitelistTerms={spellExtraNames}
                />
              </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
