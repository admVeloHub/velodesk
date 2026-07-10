/**
 * useTicketAiSuggestions v1.1.1 — resolve nome do cliente para prompt IA
 * VERSION: v1.1.1 | DATE: 2026-07-10
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketAiApi } from '../api/client';
import { htmlToPlainText } from '../services/desk/composeRichEditor';
import { getClientContactFields, getAgentName } from '../services/desk/utils';

export const TICKET_AI_INTERNAL_NOTE_MIN_CHARS = 80;
const PUBLIC_DEBOUNCE_MS = 2000;
const INTERNAL_DEBOUNCE_MS = 1500;
const LOG_PREFIX = '[ticket-ai-desk]';

function logTicketAi(level, message, detail) {
  const line = `${LOG_PREFIX} ${message}`;
  if (level === 'error') {
    console.error(line, detail !== undefined ? detail : '');
    return;
  }
  if (level === 'warn') {
    console.warn(line, detail !== undefined ? detail : '');
    return;
  }
  console.info(line, detail !== undefined ? detail : '');
}

function resolveCanal(ticket, rightFields) {
  return String(
    rightFields?.canal || ticket?.lateralForm?.canal || ticket?.channel || ''
  ).trim();
}

function isPhoneChannel(canal) {
  return /^telefone$/i.test(String(canal || '').trim());
}

function mapConvMsgsToApi(messages) {
  return (messages || [])
    .map((m) => ({
      role: m.type === 'client' ? 'cliente' : 'agente',
      text: String(m.text || '').trim(),
    }))
    .filter((m) => m.text.length > 0);
}

function hasClientMessage(messages) {
  return (messages || []).some((m) => m.type === 'client');
}

function buildContextHash({ ticketId, contextSource, messages, internalPlain, produtoHint }) {
  const msgKey = (messages || [])
    .map((m) => `${m.type}:${m.text}`)
    .join('|');
  return [
    ticketId || '',
    contextSource,
    msgKey,
    internalPlain || '',
    produtoHint || '',
  ].join('::');
}

function resolveAgentFirstName() {
  const full = String(getAgentName() || '').trim();
  if (!full) return '';
  return full.split(/\s+/)[0] || full;
}

function resolveClientName(ticket) {
  const lf = ticket?.lateralForm || {};
  const fromLf = lf.clienteNome;
  const lfName = Array.isArray(fromLf)
    ? fromLf[0]
    : (typeof fromLf === 'object' && fromLf?.lista?.[0] ? fromLf.lista[0] : fromLf);
  return String(
    ticket?.clientName
    || ticket?.solicitante
    || lfName
    || lf.clienteNome
    || '',
  ).trim();
}

function buildPayload({ ticket, rightFields, convMsgs, internalPlain, contextSource }) {
  const apiMessages = mapConvMsgsToApi(convMsgs);
  const canal = resolveCanal(ticket, rightFields);
  const nomeOperador = resolveAgentFirstName();
  const contact = getClientContactFields(ticket);
  const contactNameRaw = contact.name;
  const contactName = Array.isArray(contactNameRaw)
    ? contactNameRaw[0]
    : (typeof contactNameRaw === 'object' && contactNameRaw?.lista?.[0]
      ? contactNameRaw.lista[0]
      : contactNameRaw);
  const clientName = resolveClientName(ticket) || String(contactName || '').trim() || '';
  const base = {
    ticketId: ticket?.id || ticket?._id,
    protocolo: ticket?.chamadoProtocolo || ticket?.protocol,
    titulo: ticket?.title || ticket?.chamadoTitulo,
    canal,
    clientName: clientName || undefined,
    nomeOperador: nomeOperador || undefined,
    produtoHint: String(rightFields?.produto || '').trim() || undefined,
  };

  if (contextSource === 'internal') {
    return {
      ...base,
      contextSource: 'internal',
      internalNote: internalPlain,
    };
  }

  return {
    ...base,
    contextSource: 'public',
    messages: apiMessages,
  };
}

function formatConfigError(statusData) {
  const missing = Array.isArray(statusData?.missing) ? statusData.missing : [];
  if (missing.length) {
    return `Sugestão IA indisponível: configure no servidor (${missing.join(', ')}).`;
  }
  return 'Sugestão IA indisponível: serviço OpenAI não configurado no servidor.';
}

function formatSuggestError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data || {};
  const missing = Array.isArray(data.missing) ? data.missing : [];
  if (status === 503) {
    if (missing.length) {
      return `Sugestão IA indisponível: configure no servidor (${missing.join(', ')}).`;
    }
    return data.error || 'Sugestão IA indisponível: serviço OpenAI não configurado no servidor.';
  }
  return data.error || err?.message || 'Falha ao gerar sugestão da IA.';
}

/**
 * @param {object|null} ticket
 * @param {object} rightFields
 * @param {Array} convMsgs — thread pública (buildRegistroThread)
 * @param {string} internalText — HTML da anotação interna
 */
export function useTicketAiSuggestions(ticket, rightFields, convMsgs, internalText) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [respostaSugerida, setRespostaSugerida] = useState('');
  const [tabulacao, setTabulacao] = useState(null);
  const [tabulacaoDisplay, setTabulacaoDisplay] = useState('');
  const [waitingReason, setWaitingReason] = useState(null);
  const [serviceConfigured, setServiceConfigured] = useState(true);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const serviceUnavailableRef = useRef(false);
  const statusCheckedRef = useRef(false);

  const canal = useMemo(() => resolveCanal(ticket, rightFields), [ticket, rightFields]);
  const isPhone = isPhoneChannel(canal);
  const internalPlain = useMemo(() => htmlToPlainText(internalText || '').trim(), [internalText]);
  const contextSource = isPhone ? 'internal' : 'public';

  const canFetch = useMemo(() => {
    if (!ticket) return false;
    if (isPhone) {
      return internalPlain.length >= TICKET_AI_INTERNAL_NOTE_MIN_CHARS;
    }
    return hasClientMessage(convMsgs);
  }, [ticket, isPhone, internalPlain, convMsgs]);

  const contextHash = useMemo(() => {
    if (!ticket || !canFetch) return '';
    return buildContextHash({
      ticketId: ticket.id || ticket._id,
      contextSource,
      messages: convMsgs,
      internalPlain,
      produtoHint: rightFields?.produto,
    });
  }, [ticket, canFetch, contextSource, convMsgs, internalPlain, rightFields?.produto]);

  const waitingMessage = useMemo(() => {
    if (error) return error;
    if (loading) return 'Gerando sugestão com base nos POPs…';
    if (waitingReason === 'awaiting_client_message') {
      return 'Aguardando mensagem do cliente';
    }
    if (waitingReason === 'awaiting_internal_note') {
      return 'Registre a anotação interna do atendimento para gerar sugestões';
    }
    if (waitingReason === 'service_unconfigured') {
      return error || 'Sugestão IA indisponível no servidor.';
    }
    return '';
  }, [loading, waitingReason, error]);

  useEffect(() => {
    if (statusCheckedRef.current) return undefined;
    statusCheckedRef.current = true;
    logTicketAi('info', 'Verificando configuração do serviço (/ticket-ai/status)…');
    ticketAiApi.status()
      .then((data) => {
        const configured = Boolean(data?.configured);
        setServiceConfigured(configured);
        if (configured) {
          logTicketAi('info', 'Serviço configurado.', { model: data?.model });
          return;
        }
        serviceUnavailableRef.current = true;
        const msg = formatConfigError(data);
        setError(msg);
        setWaitingReason('service_unconfigured');
        logTicketAi('warn', 'Serviço NÃO configurado no servidor.', {
          missing: data?.missing,
          model: data?.model,
        });
      })
      .catch((err) => {
        logTicketAi('warn', 'Não foi possível consultar /ticket-ai/status — tentará sugestão mesmo assim.', {
          status: err?.response?.status,
          message: err?.response?.data?.error || err?.message,
        });
      });
    return undefined;
  }, []);

  const fetchSuggestions = useCallback(async (hash, payload) => {
    if (serviceUnavailableRef.current) {
      logTicketAi('warn', 'Fetch ignorado — serviço marcado como indisponível (503).');
      return;
    }

    const cached = cacheRef.current.get(hash);
    if (cached) {
      logTicketAi('info', 'Sugestão servida do cache local.', {
        ticketId: payload.ticketId,
        respostaChars: cached.respostaSugerida?.length || 0,
      });
      setRespostaSugerida(cached.respostaSugerida || '');
      setTabulacao(cached.tabulacao || null);
      setTabulacaoDisplay(cached.tabulacaoDisplay || '');
      setError(null);
      setWaitingReason(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setWaitingReason(null);

    logTicketAi('info', 'Iniciando POST /ticket-ai/suggest…', {
      ticketId: payload.ticketId,
      contextSource: payload.contextSource,
      canal: payload.canal,
      messages: payload.messages?.length,
      internalNoteChars: payload.internalNote?.length || 0,
    });

    try {
      const data = await ticketAiApi.suggest(payload, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const result = {
        respostaSugerida: data.respostaSugerida || '',
        tabulacao: data.tabulacao || null,
        tabulacaoDisplay: data.tabulacaoDisplay || '',
      };

      cacheRef.current.set(hash, result);
      setRespostaSugerida(result.respostaSugerida);
      setTabulacao(result.tabulacao);
      setTabulacaoDisplay(result.tabulacaoDisplay);
      logTicketAi('info', 'Sugestão recebida com sucesso.', {
        respostaChars: result.respostaSugerida.length,
        tabulacao: result.tabulacaoDisplay,
        model: data?.model,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const status = err?.response?.status;
      const msg = formatSuggestError(err);
      if (status === 503) {
        serviceUnavailableRef.current = true;
        setServiceConfigured(false);
        setWaitingReason('service_unconfigured');
        logTicketAi('error', '503 — OpenAI não configurado no servidor.', err?.response?.data);
      } else {
        logTicketAi('error', `Falha na sugestão (HTTP ${status || '—'}).`, {
          message: msg,
          data: err?.response?.data,
        });
      }
      setError(msg);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!ticket) {
      logTicketAi('info', 'Sem ticket ativo — estado IA resetado.');
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setWaitingReason(null);
      return undefined;
    }

    const ticketId = ticket.id || ticket._id;
    logTicketAi('info', 'Contexto do ticket atualizado.', {
      ticketId,
      canFetch,
      contextSource,
      canal,
      isPhone,
      serviceConfigured,
      clientMsgs: convMsgs?.filter((m) => m.type === 'client')?.length || 0,
    });

    if (serviceUnavailableRef.current) {
      setLoading(false);
      logTicketAi('warn', 'Aguardando correção no servidor — sugestão IA bloqueada.', { ticketId });
      return undefined;
    }

    if (!canFetch) {
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      const reason = isPhone ? 'awaiting_internal_note' : 'awaiting_client_message';
      setWaitingReason(reason);
      logTicketAi('info', 'Pré-requisito não atendido — sugestão não será solicitada ainda.', {
        ticketId,
        reason,
        internalPlainChars: internalPlain.length,
      });
      return undefined;
    }

    const debounceMs = isPhone ? INTERNAL_DEBOUNCE_MS : PUBLIC_DEBOUNCE_MS;
    const payload = buildPayload({
      ticket,
      rightFields,
      convMsgs,
      internalPlain,
      contextSource,
    });

    logTicketAi('info', `Agendando fetch em ${debounceMs}ms…`, { ticketId, contextHash: hashPreview(contextHash) });
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(contextHash, payload);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    ticket,
    canFetch,
    isPhone,
    canal,
    contextHash,
    contextSource,
    convMsgs,
    internalPlain,
    rightFields,
    fetchSuggestions,
    serviceConfigured,
  ]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const tabulacaoIncomplete = Boolean(tabulacao?.incompleta || !tabulacao?.produto || !tabulacao?.motivo);

  return {
    loading,
    error,
    respostaSugerida,
    tabulacao,
    tabulacaoDisplay,
    waitingReason,
    waitingMessage,
    canFetch,
    tabulacaoIncomplete,
    serviceConfigured,
    hasSuggestion: Boolean(respostaSugerida && !error),
    showIaBar: Boolean(canFetch || waitingReason || loading || error),
  };
}

function hashPreview(hash) {
  const text = String(hash || '');
  if (text.length <= 48) return text;
  return `${text.slice(0, 24)}…${text.slice(-12)}`;
}
