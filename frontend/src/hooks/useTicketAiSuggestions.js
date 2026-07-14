/**
 * useTicketAiSuggestions v1.3.0 — anti-loop, exibição pós-auditoria
 * VERSION: v1.3.0 | DATE: 2026-07-13
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketAiApi, agentsApi } from '../api/client';
import { htmlToPlainText } from '../services/desk/composeRichEditor';
import { getClientContactFields, getAgentName } from '../services/desk/utils';

export const TICKET_AI_INTERNAL_NOTE_MIN_CHARS = 80;
const PUBLIC_DEBOUNCE_MS = 2000;
const INTERNAL_DEBOUNCE_MS = 1500;
const LOG_PREFIX = '[ticket-ai-desk]';

function parseAuditScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isAuditComplete(data, agentsEnabled) {
  if (!agentsEnabled) return true;
  if (data?.auditComplete === true) return true;
  return parseAuditScore(data?.auditScore) !== null;
}

function applySuggestionResult(setters, result) {
  setters.setRespostaSugerida(result.respostaSugerida || '');
  setters.setTabulacao(result.tabulacao || null);
  setters.setTabulacaoDisplay(result.tabulacaoDisplay || '');
  setters.setAuditScore(result.auditScore ?? null);
  setters.setAuditAprovado(result.auditAprovado ?? null);
  setters.setAuditComplete(Boolean(result.auditComplete));
}

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
  const [auditScore, setAuditScore] = useState(null);
  const [auditAprovado, setAuditAprovado] = useState(null);
  const [auditComplete, setAuditComplete] = useState(false);
  const [agentsEnabled, setAgentsEnabled] = useState(false);
  const [waitingReason, setWaitingReason] = useState(null);
  const [serviceConfigured, setServiceConfigured] = useState(true);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const serviceUnavailableRef = useRef(false);
  const statusCheckedRef = useRef(false);
  const lastFetchedHashRef = useRef('');
  const inFlightHashRef = useRef('');
  const agentsEnabledRef = useRef(false);

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
    if (loading) {
      return agentsEnabled
        ? 'Gerando resposta e verificando conformidade…'
        : 'Gerando sugestão com base nos POPs…';
    }
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
  }, [loading, waitingReason, error, agentsEnabled]);

  useEffect(() => {
    if (statusCheckedRef.current) return undefined;
    statusCheckedRef.current = true;
    logTicketAi('info', 'Verificando configuração do serviço (/ticket-ai/status)…');
    ticketAiApi.status()
      .then((data) => {
        const configured = Boolean(data?.configured);
        const agentsOn = Boolean(data?.agentsEnabled);
        setServiceConfigured(configured);
        setAgentsEnabled(agentsOn);
        agentsEnabledRef.current = agentsOn;
        if (configured) {
          logTicketAi('info', 'Serviço configurado.', { model: data?.model, agentsEnabled: agentsOn });
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

    if (inFlightHashRef.current === hash) {
      logTicketAi('info', 'Fetch ignorado — mesmo contexto já em andamento.', {
        ticketId: payload.ticketId,
        contextHash: hashPreview(hash),
      });
      return;
    }

    const cached = cacheRef.current.get(hash);
    if (cached) {
      logTicketAi('info', 'Sugestão servida do cache local.', {
        ticketId: payload.ticketId,
        respostaChars: cached.respostaSugerida?.length || 0,
        auditScore: cached.auditScore,
        auditComplete: cached.auditComplete,
      });
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, cached);
      setError(null);
      setWaitingReason(null);
      setLoading(false);
      lastFetchedHashRef.current = hash;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightHashRef.current = hash;

    setLoading(true);
    setError(null);
    setWaitingReason(null);
    setRespostaSugerida('');
    setTabulacao(null);
    setTabulacaoDisplay('');
    setAuditScore(null);
    setAuditAprovado(null);
    setAuditComplete(false);

    logTicketAi('info', 'Iniciando POST /ticket-ai/suggest…', {
      ticketId: payload.ticketId,
      contextSource: payload.contextSource,
      canal: payload.canal,
      messages: payload.messages?.length,
      internalNoteChars: payload.internalNote?.length || 0,
      agentsEnabled: agentsEnabledRef.current,
    });

    try {
      const data = await ticketAiApi.suggest(payload, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const auditDone = isAuditComplete(data, agentsEnabledRef.current);
      const result = {
        respostaSugerida: data.respostaSugerida || '',
        tabulacao: data.tabulacao || null,
        tabulacaoDisplay: data.tabulacaoDisplay || '',
        auditScore: parseAuditScore(data.auditScore),
        auditAprovado: typeof data.auditAprovado === 'boolean' ? data.auditAprovado : null,
        auditComplete: auditDone,
      };

      if (agentsEnabledRef.current && !auditDone) {
        const msg = 'Auditoria não concluída — sugestão não exibida.';
        logTicketAi('error', msg, { ticketId: payload.ticketId, data });
        setError(msg);
        setRespostaSugerida('');
        setTabulacao(null);
        setTabulacaoDisplay('');
        setAuditScore(null);
        setAuditAprovado(null);
        setAuditComplete(false);
        return;
      }

      cacheRef.current.set(hash, result);
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, result);
      lastFetchedHashRef.current = hash;
      logTicketAi('info', 'Sugestão recebida com sucesso.', {
        respostaChars: result.respostaSugerida.length,
        tabulacao: result.tabulacaoDisplay,
        auditScore: result.auditScore,
        auditComplete: result.auditComplete,
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
      setAuditScore(null);
      setAuditAprovado(null);
      setAuditComplete(false);
    } finally {
      if (inFlightHashRef.current === hash) {
        inFlightHashRef.current = '';
      }
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    lastFetchedHashRef.current = '';
    inFlightHashRef.current = '';
    abortRef.current?.abort();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [ticket?.id, ticket?._id]);

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
      setAuditScore(null);
      setAuditAprovado(null);
      setAuditComplete(false);
      setWaitingReason(null);
      lastFetchedHashRef.current = '';
      inFlightHashRef.current = '';
      return undefined;
    }

    const ticketId = ticket.id || ticket._id;

    if (serviceUnavailableRef.current) {
      setLoading(false);
      logTicketAi('warn', 'Aguardando correção no servidor — sugestão IA bloqueada.', { ticketId });
      return undefined;
    }

    if (!canFetch || !contextHash) {
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setAuditScore(null);
      setAuditAprovado(null);
      setAuditComplete(false);
      const reason = isPhone ? 'awaiting_internal_note' : 'awaiting_client_message';
      setWaitingReason(reason);
      logTicketAi('info', 'Pré-requisito não atendido — sugestão não será solicitada ainda.', {
        ticketId,
        reason,
        internalPlainChars: internalPlain.length,
      });
      lastFetchedHashRef.current = '';
      return undefined;
    }

    if (contextHash === lastFetchedHashRef.current || inFlightHashRef.current === contextHash) {
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
    ticket?.id,
    ticket?._id,
    canFetch,
    contextHash,
    isPhone,
    internalPlain,
    fetchSuggestions,
  ]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const tabulacaoIncomplete = Boolean(tabulacao?.incompleta || !tabulacao?.produto || !tabulacao?.motivo);

  const requestRevision = useCallback(async (inputOperador) => {
    if (!ticket || !respostaSugerida || !tabulacao) {
      return { success: false, error: 'Nenhuma sugestão ativa para revisar' };
    }

    setLoading(true);
    setError(null);

    try {
      const payload = buildPayload({
        ticket,
        rightFields,
        convMsgs,
        internalPlain,
        contextSource,
      });

      const data = await agentsApi.revisarSugestao({
        ...payload,
        respostaAtual: respostaSugerida,
        tabulacaoAtual: tabulacao,
        auditScore: auditScore ?? undefined,
        origemRevisao: 'solicitada_operador',
        inputOperador: String(inputOperador || '').trim(),
      });

      const result = {
        respostaSugerida: data.respostaSugerida || '',
        tabulacao: data.tabulacao || null,
        tabulacaoDisplay: data.tabulacaoDisplay || '',
        auditScore: parseAuditScore(data.auditScore),
        auditAprovado: typeof data.auditAprovado === 'boolean' ? data.auditAprovado : null,
        auditComplete: isAuditComplete(data, agentsEnabledRef.current),
      };

      if (contextHash) cacheRef.current.set(contextHash, result);
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, result);
      lastFetchedHashRef.current = contextHash;
      return { success: true, data: result };
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Falha ao solicitar revisão';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [
    ticket,
    respostaSugerida,
    tabulacao,
    auditScore,
    rightFields,
    convMsgs,
    internalPlain,
    contextSource,
    contextHash,
  ]);

  return {
    loading,
    error,
    respostaSugerida,
    tabulacao,
    tabulacaoDisplay,
    auditScore,
    auditAprovado,
    waitingReason,
    waitingMessage,
    canFetch,
    tabulacaoIncomplete,
    serviceConfigured,
    hasSuggestion: Boolean(
      respostaSugerida
      && !error
      && (!agentsEnabled || auditComplete)
    ),
    showIaBar: Boolean(canFetch || waitingReason || loading || error),
    requestRevision,
  };
}

function hashPreview(hash) {
  const text = String(hash || '');
  if (text.length <= 48) return text;
  return `${text.slice(0, 24)}…${text.slice(-12)}`;
}
