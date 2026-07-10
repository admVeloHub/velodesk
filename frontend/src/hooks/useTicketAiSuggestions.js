/**
 * useTicketAiSuggestions v1.0.2 — envia nome do agente para formato padrão da resposta
 * VERSION: v1.0.2 | DATE: 2026-07-10
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketAiApi } from '../api/client';
import { htmlToPlainText } from '../services/desk/composeRichEditor';
import { getAgentName } from '../services/clientDb';

export const TICKET_AI_INTERNAL_NOTE_MIN_CHARS = 80;
const PUBLIC_DEBOUNCE_MS = 2000;
const INTERNAL_DEBOUNCE_MS = 1500;

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

function buildPayload({ ticket, rightFields, convMsgs, internalPlain, contextSource }) {
  const apiMessages = mapConvMsgsToApi(convMsgs);
  const canal = resolveCanal(ticket, rightFields);
  const nomeOperador = resolveAgentFirstName();
  const base = {
    ticketId: ticket?.id || ticket?._id,
    protocolo: ticket?.chamadoProtocolo || ticket?.protocol,
    titulo: ticket?.title || ticket?.chamadoTitulo,
    canal,
    clientName: ticket?.clientName || ticket?.lateralForm?.clienteNome,
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

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const serviceUnavailableRef = useRef(false);

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
    if (loading) return 'Gerando sugestão com base nos POPs…';
    if (waitingReason === 'awaiting_client_message') {
      return 'Aguardando mensagem do cliente';
    }
    if (waitingReason === 'awaiting_internal_note') {
      return 'Registre a anotação interna do atendimento para gerar sugestões';
    }
    return '';
  }, [loading, waitingReason]);

  const fetchSuggestions = useCallback(async (hash, payload) => {
    if (serviceUnavailableRef.current) return;

    const cached = cacheRef.current.get(hash);
    if (cached) {
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
    } catch (err) {
      if (controller.signal.aborted) return;
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || 'Falha ao gerar sugestão';
      if (status === 503) {
        serviceUnavailableRef.current = true;
      }
      setError(status === 503 ? 'Serviço de IA não configurado' : msg);
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
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setWaitingReason(null);
      serviceUnavailableRef.current = false;
      return undefined;
    }

    if (serviceUnavailableRef.current) {
      setLoading(false);
      return undefined;
    }

    if (!canFetch) {
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setWaitingReason(isPhone ? 'awaiting_internal_note' : 'awaiting_client_message');
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
    contextHash,
    contextSource,
    convMsgs,
    internalPlain,
    rightFields,
    fetchSuggestions,
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
    hasSuggestion: Boolean(respostaSugerida && !error),
    showIaBar: Boolean(canFetch || waitingReason || loading),
  };
}
