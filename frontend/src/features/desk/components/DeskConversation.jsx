/**
 * DeskConversation v1.6.0 — balão de presença da conversa WhatsApp na timeline
 * VERSION: v1.6.0 | DATE: 2026-08-11
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { composeMarkupToSafeHtml, composeTextHasFormatting } from '../../../services/desk/composeFormatPreview';
import { normalizeMessageHtmlForDisplay } from '../../../services/desk/composeRichEditor';
import { shouldHideWorkflowSystemThreadMessage } from '../../../services/desk/utils';
import { normalizeMessageDisplayText } from '../../../utils/htmlText.util';

const AUDIT_MIN_DISPLAY = 70;
const AUDIT_HIGH_GREEN = 90;

function normalizeAuditScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function attachmentLabelFromUrl(url) {
  const raw = decodeURIComponent(String(url || '').split('/').pop() || 'Anexo');
  const withoutUuid = raw.replace(/^[0-9a-f-]{36}-/i, '');
  return withoutUuid.replace(/__/g, '/').split('/').pop() || 'Anexo';
}

function isBrandInlineAttachmentUrl(url) {
  const label = attachmentLabelFromUrl(url).toLowerCase();
  return label.includes('simbolo_velotax')
    || label.includes('velodesk-brand')
    || /^logo\.(png|jpe?g|gif|webp)$/i.test(label);
}

function MessageAttachments({ attachments }) {
  const items = (attachments || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((url) => !isBrandInlineAttachmentUrl(url));
  const [loadingUrl, setLoadingUrl] = useState('');
  const [errorUrl, setErrorUrl] = useState('');

  const openAttachment = useCallback(async (url) => {
    setErrorUrl('');
    setLoadingUrl(url);
    try {
      const href = url.startsWith('/api/') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
      const token = localStorage.getItem('velodesk_token');
      const res = await fetch(href, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let detail = 'Não foi possível abrir o anexo.';
        try {
          const data = await res.json();
          if (data?.message) detail = data.message;
        } catch {
          // resposta não-JSON
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      const disp = res.headers.get('content-disposition') || '';
      const match = /filename="([^"]+)"/i.exec(disp);
      if (match?.[1]) anchor.download = match[1];
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setErrorUrl(url);
      console.warn('[DeskConversation] anexo:', err?.message || err);
    } finally {
      setLoadingUrl('');
    }
  }, []);

  if (!items.length) return null;

  return (
    <ul className="msg-bubble__attachments">
      {items.map((url) => {
        const isLoading = loadingUrl === url;
        const hasError = errorUrl === url;
        return (
          <li key={url}>
            <button
              type="button"
              className={`msg-bubble__attachment-link${hasError ? ' msg-bubble__attachment-link--error' : ''}`}
              disabled={isLoading}
              onClick={() => { openAttachment(url); }}
            >
              <i className="ti ti-paperclip" aria-hidden="true" />
              {isLoading ? 'Abrindo…' : attachmentLabelFromUrl(url)}
            </button>
            {hasError ? (
              <span className="msg-bubble__attachment-error" role="alert">
                Anexo indisponível no servidor. Se o e-mail entrou por outro ambiente, o arquivo pode não ter sido sincronizado.
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function MessageBubbleText({ text, attachments }) {
  const raw = normalizeMessageDisplayText(text);
  const hasText = Boolean(String(raw || '').trim());

  return (
    <>
      {hasText ? (
        /<[a-z][\s\S]*>/i.test(raw) ? (
          <span
            className="msg-bubble__formatted msg-bubble__formatted--html"
            dangerouslySetInnerHTML={{ __html: normalizeMessageHtmlForDisplay(raw) }}
          />
        ) : !composeTextHasFormatting(raw) ? (
          <span className="msg-bubble__formatted msg-bubble__formatted--plain">{raw}</span>
        ) : (
          <span
            className="msg-bubble__formatted"
            dangerouslySetInnerHTML={{ __html: composeMarkupToSafeHtml(raw) }}
          />
        )
      ) : null}
      <MessageAttachments attachments={attachments} />
    </>
  );
}

function formatWaBalloonTime(timestamp) {
  const ts = new Date(timestamp || 0);
  if (Number.isNaN(ts.getTime()) || !timestamp) return '';
  return ts.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WhatsAppPresenceBalloon({ msg, onOpen }) {
  const preview = String(msg.lastText || '').trim();
  const time = formatWaBalloonTime(msg.timestamp);
  return (
    <div className="msg-row msg-row--wa-presence">
      <button
        type="button"
        className="wa-presence-balloon"
        onClick={onOpen}
        title="Abrir a conversa de WhatsApp"
      >
        <span className="wa-presence-balloon__icon">
          <i className="ti ti-brand-whatsapp" aria-hidden="true" />
        </span>
        <span className="wa-presence-balloon__body">
          <span className="wa-presence-balloon__title">
            Conversa de WhatsApp
            <span className="wa-presence-balloon__count">
              {msg.count} {msg.count === 1 ? 'mensagem' : 'mensagens'}
            </span>
          </span>
          {preview ? (
            <span className="wa-presence-balloon__preview">
              {msg.lastType === 'client' ? 'Cliente: ' : 'Agente: '}
              {preview.length > 80 ? `${preview.slice(0, 80)}…` : preview}
            </span>
          ) : null}
          <span className="wa-presence-balloon__hint">
            {time ? `Última mensagem ${time} · ` : ''}Clique para abrir a conversa
          </span>
        </span>
        <i className="ti ti-chevron-right wa-presence-balloon__chevron" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function DeskConversation({
  ticket,
  messages,
  onUseIaReply,
  iaReply = '',
  iaReplyLoading = false,
  iaWaitingMessage = '',
  iaShowBar = false,
  iaHasSuggestion = false,
  iaError = '',
  iaAuditScore = null,
  onRequestRevision,
  onOpenWhatsAppChat,
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const lastIaReplyRef = useRef('');
  const thread = messages || [];

  useEffect(() => {
    setIaVisible(true);
    lastIaReplyRef.current = '';
  }, [ticket?.id]);

  useEffect(() => {
    if (!iaHasSuggestion || !iaReply || iaReply === lastIaReplyRef.current) return;
    setIaVisible(true);
  }, [iaReply, iaHasSuggestion]);

  const displayText = iaError
    ? iaError
    : iaReplyLoading || !iaHasSuggestion
      ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
      : iaReply;

  const canUseReply = iaHasSuggestion && !iaReplyLoading && Boolean(iaReply) && !iaError;
  const showFooter = !iaError;
  const auditScoreValue = normalizeAuditScore(iaAuditScore);
  const hasAuditScore = auditScoreValue !== null;
  const showCompliance = showFooter && iaHasSuggestion && !iaReplyLoading
    && hasAuditScore && auditScoreValue >= AUDIT_MIN_DISPLAY;
  const complianceTone = hasAuditScore && auditScoreValue >= AUDIT_HIGH_GREEN ? 'high' : 'mid';

  const handleUseIaReply = () => {
    if (!canUseReply) return;
    onUseIaReply(iaReply);
    lastIaReplyRef.current = iaReply;
    setIaVisible(false);
  };

  return (
    <div className="conversation" id="conversation">
      {thread.length === 0 ? (
        <div className="crm-empty-state conversation-empty">
          <p>Nenhuma mensagem pública neste atendimento.</p>
        </div>
      ) : (
        thread.map((msg, i) => {
          if (msg.type === 'whatsapp-thread') {
            return (
              <WhatsAppPresenceBalloon key={i} msg={msg} onOpen={onOpenWhatsAppChat} />
            );
          }
          if (msg.type === 'system') {
            if (shouldHideWorkflowSystemThreadMessage(msg.text)) {
              return null;
            }
            return (
              <div key={i} className="msg-row msg-row--system">
                <div className="msg-body msg-body--system">
                  <div className="msg-bubble msg-bubble--system">
                    <MessageBubbleText text={msg.text} attachments={msg.attachments} />
                  </div>
                  {msg.meta ? <div className="msg-meta">{msg.meta}</div> : null}
                </div>
              </div>
            );
          }
          const isRight = msg.type === 'agent' || msg.type === 'internal';
          return (
          <div key={i} className={'msg-row' + (isRight ? ' msg-row--agent' : '')}>
            <div className={'msg-avatar msg-avatar--' + (msg.type === 'internal' ? 'agent' : msg.type)}>{msg.initials || '?'}</div>
            <div className="msg-body">
              <div className={'msg-bubble msg-bubble--' + msg.type}>
                <MessageBubbleText text={msg.text} attachments={msg.attachments} />
              </div>
              <div className="msg-meta">{msg.meta}</div>
            </div>
          </div>
          );
        })
      )}
      {iaVisible && iaShowBar && (
        <div className={'ia-suggestion-bar' + (iaReplyLoading ? ' ia-suggestion-bar--loading' : '') + (iaError ? ' ia-suggestion-bar--error' : '')} id="iaSuggestionBar">
          <div className="ia-suggestion-bar__content">
            <span className="ia-suggestion-bar__text" id="iaReplyText">{displayText}</span>
          </div>
          {showFooter && (
            <>
              <div className="ia-suggestion-bar__divider" role="separator" aria-hidden="true" />
              <div className="ia-suggestion-bar__footer">
                {showCompliance && (
                  <span
                    className={'ia-suggestion-bar__compliance container-secondary ia-suggestion-bar__compliance--' + complianceTone}
                    title="Conformidade da auditoria"
                  >
                    {auditScoreValue}%
                  </span>
                )}
                <div className="ia-suggestion-bar__actions">
                  <button
                    type="button"
                    className="ia-suggestion-bar__btn ia-suggestion-bar__btn--use container-secondary"
                    disabled={!canUseReply}
                    onClick={handleUseIaReply}
                  >
                    Usar resposta
                  </button>
                  {onRequestRevision && (
                    <button
                      type="button"
                      className="ia-suggestion-bar__btn ia-suggestion-bar__btn--revise container-secondary"
                      disabled={iaReplyLoading || !iaHasSuggestion}
                      onClick={onRequestRevision}
                    >
                      Revisar
                    </button>
                  )}
                  <button
                    type="button"
                    className="ia-suggestion-bar__btn ia-suggestion-bar__btn--dismiss container-secondary"
                    onClick={() => setIaVisible(false)}
                  >
                    Não usar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
