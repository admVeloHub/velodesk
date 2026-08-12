/**
 * DeskWhatsAppChat v1.9.0 — botão de transcrição de áudio sob demanda
 * VERSION: v1.9.0 | DATE: 2026-08-12
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  formatWaTime,
  formatWaDateSeparator,
} from '../../../services/desk/utils';

function attachmentHref(url) {
  return url.startsWith('/api/') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
}

function attachmentLabel(url) {
  try {
    const raw = decodeURIComponent(String(url || '').split('/').pop() || 'Anexo');
    return raw.replace(/^[0-9a-f-]{36}-/i, '').replace(/__/g, '/').split('/').pop() || 'Anexo';
  } catch {
    return 'Anexo';
  }
}

function mediaKind(contentType, url) {
  const type = String(contentType || '').toLowerCase();
  const label = attachmentLabel(url).toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(label)) return 'image';
  if (type.startsWith('audio/') || /\.(ogg|opus|mp3|m4a|aac|amr|wav)$/i.test(label)) return 'audio';
  if (type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(label)) return 'video';
  return 'document';
}

async function fetchAuthenticatedAttachment(url) {
  const token = localStorage.getItem('velodesk_token');
  const response = await fetch(attachmentHref(url), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Anexo indisponível (HTTP ${response.status})`);
  return response;
}

function WhatsAppMediaAttachments({ attachments, contentTypes }) {
  const items = (attachments || []).map((url, index) => ({
    url: String(url || '').trim(),
    contentType: String(contentTypes?.[index] || ''),
  })).filter((item) => item.url);
  const fingerprint = items.map((item) => `${item.url}|${item.contentType}`).join(';;');
  const [inlineUrls, setInlineUrls] = useState({});
  const [errors, setErrors] = useState({});
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    let cancelled = false;
    const created = [];
    const inlineItems = items.filter((item) => mediaKind(item.contentType, item.url) !== 'document');
    Promise.all(inlineItems.map(async (item) => {
      try {
        const response = await fetchAuthenticatedAttachment(item.url);
        const objectUrl = URL.createObjectURL(await response.blob());
        created.push(objectUrl);
        if (!cancelled) {
          setInlineUrls((current) => ({ ...current, [item.url]: objectUrl }));
        }
      } catch (err) {
        if (!cancelled) {
          setErrors((current) => ({ ...current, [item.url]: err?.message || 'Anexo indisponível' }));
        }
      }
    }));
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
      setInlineUrls({});
      setErrors({});
    };
  // fingerprint representa exatamente a lista de anexos da mensagem
  }, [fingerprint]);

  const downloadDocument = async (item) => {
    setDownloading(item.url);
    setErrors((current) => ({ ...current, [item.url]: '' }));
    try {
      const response = await fetchAuthenticatedAttachment(item.url);
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = attachmentLabel(item.url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setErrors((current) => ({ ...current, [item.url]: err?.message || 'Anexo indisponível' }));
    } finally {
      setDownloading('');
    }
  };

  if (!items.length) return null;
  return (
    <div className="wa-msg__media-list">
      {items.map((item) => {
        const kind = mediaKind(item.contentType, item.url);
        const src = inlineUrls[item.url];
        const error = errors[item.url];
        return (
          <div className={`wa-msg__media wa-msg__media--${kind}`} key={item.url}>
            {kind === 'image' && src ? (
              <button
                type="button"
                className="wa-msg__image-button"
                onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
                aria-label={`Abrir imagem ${attachmentLabel(item.url)}`}
              >
                <img src={src} alt={attachmentLabel(item.url)} loading="lazy" />
              </button>
            ) : null}
            {kind === 'audio' && src ? (
              <audio className="wa-msg__audio" controls preload="metadata" src={src}>
                Seu navegador não conseguiu reproduzir este áudio.
              </audio>
            ) : null}
            {kind === 'video' && src ? (
              <video className="wa-msg__video" controls preload="metadata" src={src}>
                Seu navegador não conseguiu reproduzir este vídeo.
              </video>
            ) : null}
            {kind !== 'document' && !src && !error ? (
              <span className="wa-msg__media-loading">Carregando mídia…</span>
            ) : null}
            {kind === 'document' ? (
              <button
                type="button"
                className="wa-msg__document"
                disabled={downloading === item.url}
                onClick={() => { void downloadDocument(item); }}
              >
                <i className="ti ti-file-download" aria-hidden="true" />
                <span>{downloading === item.url ? 'Baixando…' : attachmentLabel(item.url)}</span>
              </button>
            ) : null}
            {error ? <span className="wa-msg__media-error" role="alert">{error}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function renderDeliveryChecks(msg) {
  if (msg.type !== 'agent') return null;

  const status = String(msg.deliveryStatus || 'sent').toLowerCase();
  const errorMessage = String(msg.deliveryErrorMessage || '').trim();

  if (status === 'failed' || status === 'undelivered') {
    return (
      <i
        className="ti ti-alert-circle wa-msg__checks wa-msg__checks--failed"
        aria-hidden="true"
        title={errorMessage || 'Falha na entrega'}
      />
    );
  }

  if (status === 'queued' || status === 'sending') {
    return (
      <i
        className="ti ti-clock wa-msg__checks wa-msg__checks--pending"
        aria-hidden="true"
        title="Enviando…"
      />
    );
  }

  if (status === 'sent') {
    return (
      <i
        className="ti ti-check wa-msg__checks wa-msg__checks--sent"
        aria-hidden="true"
        title="Enviada"
      />
    );
  }

  if (status === 'delivered') {
    return (
      <i
        className="ti ti-checks wa-msg__checks wa-msg__checks--delivered"
        aria-hidden="true"
        title="Entregue"
      />
    );
  }

  return (
    <i
      className="ti ti-checks wa-msg__checks wa-msg__checks--read"
      aria-hidden="true"
      title="Lida"
    />
  );
}

export default function DeskWhatsAppChat({
  ticket,
  client,
  messages,
  composeText,
  onComposeTextChange,
  onUseIaReply,
  onSend,
  onSendInitial,
  onRequestAudioTranscription,
  waUiState,
  initialSendBusy = false,
  sendBusy = false,
  iaReply = '',
  iaReplyLoading = false,
  iaWaitingMessage = '',
  iaShowBar = false,
  iaHasSuggestion = false,
  iaError = '',
}) {
  const [iaVisible, setIaVisible] = useState(true);
  const [transcriptionBusyId, setTranscriptionBusyId] = useState('');
  const inputRef = useRef(null);
  const lastIaReplyRef = useRef('');
  const prevSendBusyRef = useRef(false);
  const chatMessages = messages || [];
  const dateIso = chatMessages[0]?.timestamp || ticket.createdAt;

  const composeEnabled = waUiState?.composeEnabled !== false;
  const needsInitial = Boolean(waUiState?.needsInitial);
  const awaitingClient = Boolean(waUiState?.awaitingClient);

  useEffect(() => {
    setIaVisible(true);
    lastIaReplyRef.current = '';
  }, [ticket?.id]);

  useEffect(() => {
    if (!iaHasSuggestion || !iaReply || iaReply === lastIaReplyRef.current) return;
    setIaVisible(true);
  }, [iaReply, iaHasSuggestion]);

  // Mantém o cursor no campo após cada envio (Enter ou botão)
  useEffect(() => {
    if (prevSendBusyRef.current && !sendBusy && composeEnabled) {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    prevSendBusyRef.current = sendBusy;
  }, [sendBusy, composeEnabled]);

  // Foco inicial ao abrir conversa com texto livre liberado
  useEffect(() => {
    if (!composeEnabled) return;
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [ticket?.id, composeEnabled]);

  const displayText = iaError
    ? iaError
    : iaReplyLoading || !iaHasSuggestion
      ? (iaWaitingMessage || 'Gerando sugestão com base nos POPs…')
      : iaReply;

  const canUseReply = iaHasSuggestion && !iaReplyLoading && Boolean(iaReply) && !iaError;

  const handleUseIaReply = () => {
    if (!canUseReply) return;
    onUseIaReply(iaReply);
    lastIaReplyRef.current = iaReply;
    setIaVisible(false);
  };

  const handleEditIa = () => {
    if (!canUseReply) return;
    onUseIaReply(iaReply);
    lastIaReplyRef.current = iaReply;
    setIaVisible(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!composeEnabled || !composeText.trim() || sendBusy) return;
    const result = onSend?.();
    if (result && typeof result.then === 'function') {
      await result;
    }
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleRequestTranscription = async (msg) => {
    if (!msg?.id || !onRequestAudioTranscription || transcriptionBusyId) return;
    setTranscriptionBusyId(msg.id);
    try {
      await onRequestAudioTranscription(msg.id);
    } finally {
      setTranscriptionBusyId('');
    }
  };

  const clientLabel = String(
    client?.name
    || ticket?.clientName
    || ticket?.lateralForm?.clienteNome
    || 'cliente',
  ).trim();

  return (
    <div className="wa-chat" id="waChatView">
      <div className="conversation wa-chat__body" id="conversation">
        {needsInitial && (
          <div className="wa-chat__initial-card" role="region" aria-label="Iniciar conversa WhatsApp">
            <div className="wa-chat__initial-card-icon" aria-hidden="true">
              <i className="ti ti-brand-whatsapp" />
            </div>
            <h3 className="wa-chat__initial-card-title">Iniciar conversa WhatsApp</h3>
            <p className="wa-chat__initial-card-text">
              Para falar com <strong>{clientLabel}</strong> pela primeira vez, envie a mensagem inicial
              aprovada pela Meta (template Velotax com nome e protocolo do chamado).
            </p>
            <button
              type="button"
              className="wa-chat__initial-card-btn"
              onClick={onSendInitial}
              disabled={initialSendBusy || sendBusy}
            >
              {initialSendBusy ? 'Enviando…' : 'Enviar Mensagem Inicial'}
            </button>
          </div>
        )}

        {awaitingClient && !needsInitial && (
          <div className="wa-chat__awaiting-banner" role="status">
            Mensagem inicial enviada. Aguardando resposta de <strong>{clientLabel}</strong> para liberar o texto livre (janela 24h).
          </div>
        )}

        {dateIso && chatMessages.length > 0 && (
          <div className="wa-chat__date-sep">{formatWaDateSeparator(dateIso)}</div>
        )}

        {chatMessages.length === 0 && !needsInitial ? (
          <div className="crm-empty-state conversation-empty">
            <p>Nenhuma mensagem WhatsApp neste atendimento.</p>
          </div>
        ) : (
          chatMessages.map((msg, i) => {
            const isOut = msg.type === 'agent' || msg.type === 'internal';
            const bubbleClass = msg.type === 'internal'
              ? ' wa-msg__bubble--internal'
              : (isOut ? ' wa-msg__bubble--out' : ' wa-msg__bubble--in');
            return (
            <div
              key={msg.id || i}
              className={'wa-msg' + (isOut ? ' wa-msg--out' : ' wa-msg--in')}
            >
              <div className={'wa-msg__bubble' + bubbleClass}>
                <WhatsAppMediaAttachments
                  attachments={msg.attachments}
                  contentTypes={msg.mediaContentTypes}
                />
                <span className="wa-msg__text">{msg.text}</span>
                {msg.transcriptionStatus === 'processing' || msg.transcriptionStatus === 'pending' ? (
                  <span className="wa-msg__transcription-status">
                    <i className="ti ti-loader-2" aria-hidden="true" />
                    Transcrevendo áudio…
                  </span>
                ) : null}
                {msg.transcriptionStatus === 'available' || msg.transcriptionStatus === 'failed' ? (
                  <button
                    type="button"
                    className="wa-msg__transcription-button"
                    disabled={Boolean(transcriptionBusyId)}
                    onClick={() => { void handleRequestTranscription(msg); }}
                  >
                    <i className="ti ti-file-text-ai" aria-hidden="true" />
                    {transcriptionBusyId === msg.id
                      ? 'Solicitando…'
                      : (msg.transcriptionStatus === 'failed' ? 'Tentar transcrever novamente' : 'Transcrever áudio')}
                  </button>
                ) : null}
                <span className="wa-msg__time">
                  {formatWaTime(msg.timestamp)}
                  {renderDeliveryChecks(msg)}
                </span>
              </div>
            </div>
            );
          })
        )}

        {composeEnabled && iaVisible && iaShowBar && (
          <div className={'wa-ia-card' + (iaReplyLoading ? ' wa-ia-card--loading' : '') + (iaError ? ' wa-ia-card--error' : '')} id="iaSuggestionBar">
            <div className="wa-ia-card__head">
              <i className="ti ti-sparkles" aria-hidden="true" />
              <span className="wa-ia-card__label">SUGESTÃO</span>
            </div>
            <p className="wa-ia-card__text" id="iaReplyText">{displayText}</p>
            <div className="wa-ia-card__actions">
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--primary"
                disabled={!canUseReply}
                onClick={handleUseIaReply}
              >
                Usar resposta
              </button>
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--outline"
                disabled={!canUseReply}
                onClick={handleEditIa}
              >
                Editar
              </button>
              <button
                type="button"
                className="wa-ia-card__btn wa-ia-card__btn--outline"
                onClick={() => setIaVisible(false)}
              >
                Ignorar
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className={'wa-chat__footer' + (composeEnabled ? '' : ' wa-chat__footer--locked')}>
        {!composeEnabled && (
          <p className="wa-chat__session-hint" role="status">
            {needsInitial
              ? 'Use o botão acima para enviar a mensagem inicial. O campo de texto será liberado após a resposta do cliente.'
              : 'Aguardando resposta do cliente para continuar a conversa.'}
          </p>
        )}
        <div className="wa-chat__input-bar">
          <button type="button" className="wa-chat__input-icon" aria-label="Emoji" disabled={!composeEnabled}>
            <i className="far fa-smile" />
          </button>
          <input
            ref={inputRef}
            type="text"
            className="wa-chat__input"
            placeholder={composeEnabled ? 'Escreva uma mensagem...' : 'Disponível após resposta do cliente'}
            spellCheck
            lang="pt-BR"
            autoCorrect="on"
            autoCapitalize="sentences"
            value={composeText}
            disabled={!composeEnabled || sendBusy}
            onChange={(e) => onComposeTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button type="button" className="wa-chat__input-icon" aria-label="Anexar" disabled={!composeEnabled}>
            <i className="fas fa-paperclip" />
          </button>
        </div>
        <button
          type="button"
          className="wa-chat__send"
          aria-label="Enviar mensagem"
          disabled={!composeEnabled || sendBusy || !composeText.trim()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { void handleSend(); }}
        >
          <i className="fas fa-paper-plane" aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
