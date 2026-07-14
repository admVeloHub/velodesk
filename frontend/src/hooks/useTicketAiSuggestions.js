/**
 * useTicketAiSuggestions v1.0.1 — evita loop de requests em 503 (serviço não configurado)
 * VERSION: v1.0.1 | DATE: 2026-07-03
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketAiApi } from '../api/client';
import { htmlToPlainText } from '../services/desk/composeRichEditor';
import { hasApplyableTabulation, parseTabulationDisplay } from '../services/tabulationConfig';

export const TICKET_AI_INTERNAL_NOTE_MIN_CHARS = 80;
const PUBLIC_DEBOUNCE_MS = 400;
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
  return (messages || []).some((m) => {
    const type = String(m.type || '').toLowerCase();
    return type === 'client' || type === 'cliente' || m.fromClient === true || m.sender === 'them';
  });
}

function buildTabulationDisplay(tab) {
  if (!tab) return '';
  const parts = [tab.tipo, tab.produto, tab.motivo, tab.detalhe].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Tabulação incompleta';
}

function inferDevTabulation(payload) {
  const messages = payload?.messages || [];
  const text = messages.map((m) => String(m.text || '')).join(' ').toLowerCase();
  const internalNote = String(payload?.internalNote || '').toLowerCase();
  const title = String(payload?.titulo || '').toLowerCase();
  const haystack = `${title} ${text} ${internalNote}`;

  if (/reembolso|produto x/i.test(haystack)) {
    return {
      tipo: 'Solicitação',
      produto: 'Produto X',
      motivo: 'Reembolso',
      detalhe: 'Dentro de 7 dias',
      incompleta: false,
    };
  }
  if (/lentid|internet|fibra/i.test(haystack)) {
    return {
      tipo: 'Reclamação',
      produto: 'Internet Fibra',
      motivo: 'Lentidão',
      detalhe: 'Em análise',
      incompleta: false,
    };
  }
  if (/cancelamento|\btv\b/i.test(haystack)) {
    return {
      tipo: 'Solicitação',
      produto: 'TV',
      motivo: 'Cancelamento',
      detalhe: 'Em análise',
      incompleta: false,
    };
  }
  if (/cobran|cart[aã]o|financeir/i.test(haystack)) {
    return {
      tipo: 'Solicitação',
      produto: 'Telefone',
      motivo: 'Financeiro',
      detalhe: 'Em análise',
      incompleta: false,
    };
  }
  return null;
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

function buildDevSuggestionResult(payload) {
  const mockTab = inferDevTabulation(payload);
  if (!mockTab) return null;
  return {
    respostaSugerida: '',
    tabulacao: mockTab,
    tabulacaoDisplay: buildTabulationDisplay(mockTab),
  };
}

function applySuggestionResult(setters, result) {
  setters.setRespostaSugerida(result.respostaSugerida || '');
  setters.setTabulacao(result.tabulacao || null);
  setters.setTabulacaoDisplay(result.tabulacaoDisplay || '');
  setters.setError(null);
  setters.setWaitingReason(null);
}

function buildPayload({ ticket, rightFields, convMsgs, internalPlain, contextSource }) {
  const apiMessages = mapConvMsgsToApi(convMsgs);
  const canal = resolveCanal(ticket, rightFields);
  const base = {
    ticketId: ticket?.id || ticket?._id,
    protocolo: ticket?.chamadoProtocolo || ticket?.protocol,
    titulo: ticket?.title || ticket?.chamadoTitulo,
    canal,
    clientName: ticket?.clientName || ticket?.lateralForm?.clienteNome,
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
  const prevTicketIdRef = useRef(null);

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
    const cached = cacheRef.current.get(hash);
    if (cached) {
      applySuggestionResult(
        { setRespostaSugerida, setTabulacao, setTabulacaoDisplay, setError, setWaitingReason },
        cached,
      );
      setLoading(false);
      return;
    }

    if (serviceUnavailableRef.current) {
      const devResult = buildDevSuggestionResult(payload);
      if (devResult) {
        cacheRef.current.set(hash, devResult);
        applySuggestionResult(
          { setRespostaSugerida, setTabulacao, setTabulacaoDisplay, setError, setWaitingReason },
          devResult,
        );
      }
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
      applySuggestionResult(
        { setRespostaSugerida, setTabulacao, setTabulacaoDisplay, setError, setWaitingReason },
        result,
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || 'Falha ao gerar sugestão';
      if (status === 503) {
        serviceUnavailableRef.current = true;
      }
      const fallback = buildDevSuggestionResult(payload);
      if (fallback) {
        cacheRef.current.set(hash, fallback);
        applySuggestionResult(
          { setRespostaSugerida, setTabulacao, setTabulacaoDisplay, setError, setWaitingReason },
          fallback,
        );
        return;
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
      prevTicketIdRef.current = null;
      return undefined;
    }

    const ticketId = String(ticket.id || ticket._id || '');
    if (prevTicketIdRef.current !== ticketId) {
      prevTicketIdRef.current = ticketId;
      serviceUnavailableRef.current = false;
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

    setLoading(true);
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
    hasTabulationSuggestion: Boolean(
      hasApplyableTabulation(tabulacao) || parseTabulationDisplay(tabulacaoDisplay),
    ),
    showIaBar: Boolean(canFetch || waitingReason || loading),
  };
}
