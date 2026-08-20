/**
 * useTicketAiSuggestions v1.12.1 — cache por ticket; não refaz POST no flicker de thread/permissões
 * VERSION: v1.12.1 | DATE: 2026-08-20
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketAiApi, agentsApi } from '../api/client';
import { htmlToPlainText } from '../services/desk/composeRichEditor';
import { getClientContactFields, getAgentName, isWhatsAppCustomerSessionOpen, buildWhatsAppConvMsgs } from '../services/desk/utils';
import {
  buildAgentInternalNotesFingerprint,
  buildClientThreadFingerprint,
  isLastPublicInteractionFromAgent,
} from '../services/desk/ticketThreadSync';

export const TICKET_AI_INTERNAL_NOTE_MIN_CHARS = 80;
const PUBLIC_DEBOUNCE_MS = 2000;
const INTERNAL_DEBOUNCE_MS = 1500;
const LOG_PREFIX = '[ticket-ai-desk]';

/** Sobrevive a remount/HMR: ticketId → { hash, result } */
const AI_SUGGESTION_STORE = new Map();

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
  setters.setTabulacaoFonte(result.tabulacaoFonte || 'atendimento');
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

function collectInternalNotesPlain(ticket, currentDraftPlain) {
  const notes = [];
  const seen = new Set();

  (ticket?.internalNotes || []).forEach((note) => {
    const text = String(note.text || note.message || '').trim();
    if (!text) return;
    const key = `${note.timestamp || note.time || ''}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({
      ts: note.timestamp || note.time,
      text,
      author: String(note.author || '').trim() || 'Agente',
    });
  });

  (ticket?.registroHistorico || ticket?.registroAlteracoes || []).forEach((entry) => {
    const text = String(entry.anotacaoInterna ?? '').trim();
    if (!text) return;
    const key = `${entry.time || entry.timestamp || ''}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({
      ts: entry.time || entry.timestamp,
      text,
      author: String(entry.autor ?? entry.author ?? '').trim() || 'Agente',
    });
  });

  notes.sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));

  const draft = String(currentDraftPlain || '').trim();
  if (draft) {
    const lastText = notes.length ? notes[notes.length - 1].text : '';
    if (draft !== lastText) {
      notes.push({ ts: null, text: draft, author: 'Rascunho atual' });
    }
  }

  if (!notes.length) return '';

  return notes
    .map((n, i) => {
      const label = n.author ? `[${n.author}]` : `[Anotação ${i + 1}]`;
      return `${i + 1}. ${label}: ${n.text}`;
    })
    .join('\n');
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

function mergePublicMessagesForAi(convMsgs, ticket) {
  const base = (convMsgs || []).map((m) => ({
    type: m.type,
    text: String(m.text || '').trim(),
    channel: m.channel,
    timestamp: m.timestamp,
  })).filter((m) => m.text.length > 0 && (m.type === 'client' || m.type === 'agent'));

  const waMsgs = buildWhatsAppConvMsgs(ticket).map((m) => ({
    type: m.type,
    text: String(m.text || '').trim(),
    channel: 'whatsapp',
    timestamp: m.timestamp,
  })).filter((m) => m.text.length > 0);

  if (!waMsgs.length) return base;

  const seen = new Set(
    base.map((m) => `${m.type}|${m.timestamp || ''}|${m.text}`),
  );
  const merged = [...base];
  for (const msg of waMsgs) {
    const key = `${msg.type}|${msg.timestamp || ''}|${msg.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(msg);
  }

  merged.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  return merged;
}

function buildPayload({ ticket, rightFields, convMsgs, internalNotesBlock, contextSource }) {
  const apiMessages = mapConvMsgsToApi(mergePublicMessagesForAi(convMsgs, ticket));
  const canal = resolveCanal(ticket, rightFields);
  const nomeOperador = String(getAgentName() || '').trim();
  const contact = getClientContactFields(ticket);
  const contactNameRaw = contact.name;
  const contactName = Array.isArray(contactNameRaw)
    ? contactNameRaw[0]
    : (typeof contactNameRaw === 'object' && contactNameRaw?.lista?.[0]
      ? contactNameRaw.lista[0]
      : contactNameRaw);
  const clientName = resolveClientName(ticket) || String(contactName || '').trim() || '';
  const internalNote = String(internalNotesBlock || '').trim() || undefined;
  const base = {
    ticketId: ticket?.id || ticket?._id,
    protocolo: ticket?.chamadoProtocolo || ticket?.protocol,
    titulo: ticket?.title || ticket?.chamadoTitulo,
    canal,
    clientName: clientName || undefined,
    nomeOperador: nomeOperador || undefined,
    produtoHint: String(rightFields?.produto || '').trim() || undefined,
    contextSource,
    internalNote,
  };

  if (!apiMessages.length) {
    return base;
  }

  return {
    ...base,
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
  const [tabulacaoFonte, setTabulacaoFonte] = useState('atendimento');
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
  const fetchContextRef = useRef({});

  const lastTicketIdRef = useRef('');
  const stickyClientFpRef = useRef('');
  const scheduledHashRef = useRef('');

  const internalPlain = useMemo(() => htmlToPlainText(internalText || '').trim(), [internalText]);
  const internalNotesBlock = useMemo(
    () => collectInternalNotesPlain(ticket, internalPlain),
    [ticket, internalPlain],
  );
  const aiMsgs = useMemo(() => mergePublicMessagesForAi(convMsgs, ticket), [convMsgs, ticket]);
  /**
   * Sem 1ª mensagem do cliente (ticket criado manualmente ou por trigger de telefonia,
   * sem histórico do canal), usa a nota interna do agente como contexto da consulta —
   * independente do canal do ticket.
   */
  const hasClient = hasClientMessage(aiMsgs);
  const ticketIdNow = String(ticket?.id || ticket?._id || '');
  if (ticketIdNow && ticketIdNow !== lastTicketIdRef.current) {
    lastTicketIdRef.current = ticketIdNow;
    stickyClientFpRef.current = '';
  }
  const liveClientFp = buildClientThreadFingerprint(convMsgs);
  if (liveClientFp) stickyClientFpRef.current = liveClientFp;
  const clientFp = liveClientFp || stickyClientFpRef.current;
  const seenClientForTicket = Boolean(clientFp);
  const useInternalContext = !hasClient && !seenClientForTicket;
  const contextSource = useInternalContext ? 'internal' : 'public';

  /** Agente já respondeu — só nova msg do cliente reabre sugestão (rascunho no compose não conta). */
  const awaitingClientAfterAgentReply = useMemo(() => {
    if (useInternalContext) return false;
    if (isWhatsAppCustomerSessionOpen(ticket)) return false;
    return isLastPublicInteractionFromAgent(aiMsgs);
  }, [useInternalContext, aiMsgs, ticket]);

  const canFetch = useMemo(() => {
    if (!ticket) return false;
    if (useInternalContext) {
      return internalNotesBlock.length >= TICKET_AI_INTERNAL_NOTE_MIN_CHARS;
    }
    if (awaitingClientAfterAgentReply) return false;
    return true;
  }, [ticket, useInternalContext, internalNotesBlock, awaitingClientAfterAgentReply]);

  const notesFp = buildAgentInternalNotesFingerprint(ticket);
  const aiRefreshKey = (!ticket || !canFetch)
    ? ''
    : [
      String(ticket.id || ticket._id),
      contextSource,
      useInternalContext ? 'internal-context' : 'client',
      useInternalContext ? notesFp : clientFp,
    ].join('::');

  fetchContextRef.current = {
    ticket,
    rightFields,
    convMsgs,
    internalNotesBlock,
    contextSource,
  };

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
    if (waitingReason === 'awaiting_client_reply') {
      return '';
    }
    if (waitingReason === 'awaiting_internal_note') {
      return 'Adicione um comentário interno para obter a primeira sugestão';
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

    const ticketId = String(payload.ticketId || '');
    const stored = AI_SUGGESTION_STORE.get(ticketId);
    const cached = cacheRef.current.get(hash) || (stored?.hash === hash ? stored.result : null);
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
        setTabulacaoFonte,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, cached);
      setError(null);
      setWaitingReason(null);
      setLoading(false);
      lastFetchedHashRef.current = hash;
      cacheRef.current.set(hash, cached);
      AI_SUGGESTION_STORE.set(ticketId, { hash, result: cached });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightHashRef.current = hash;

    setLoading(true);
    setError(null);
    setWaitingReason(null);
    if (!stored?.result?.respostaSugerida) {
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setTabulacaoFonte('atendimento');
      setAuditScore(null);
      setAuditAprovado(null);
      setAuditComplete(false);
    }

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
        tabulacaoFonte: data.tabulacaoFonte || 'atendimento',
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
        setTabulacaoFonte('atendimento');
        setAuditScore(null);
        setAuditAprovado(null);
        setAuditComplete(false);
        return;
      }

      cacheRef.current.set(hash, result);
      AI_SUGGESTION_STORE.set(ticketId, { hash, result });
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setTabulacaoFonte,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, result);
      lastFetchedHashRef.current = hash;
      logTicketAi('info', 'Sugestão recebida com sucesso.', {
        respostaChars: result.respostaSugerida.length,
        tabulacao: result.tabulacaoDisplay,
        tabulacaoFonte: result.tabulacaoFonte,
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
      setTabulacaoFonte('atendimento');
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
    abortRef.current?.abort();
    inFlightHashRef.current = '';
    scheduledHashRef.current = '';
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const id = String(ticket?.id || ticket?._id || '');
    const stored = id ? AI_SUGGESTION_STORE.get(id) : null;
    lastFetchedHashRef.current = stored?.hash || '';
    if (stored?.result) {
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setTabulacaoFonte,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, stored.result);
    }
  }, [ticket?.id, ticket?._id]);

  useEffect(() => {
    if (!ticket) {
      if (lastTicketIdRef.current) {
        logTicketAi('info', 'Sem ticket ativo — estado IA resetado.');
      }
      setLoading(false);
      setError(null);
      setRespostaSugerida('');
      setTabulacao(null);
      setTabulacaoDisplay('');
      setTabulacaoFonte('atendimento');
      setAuditScore(null);
      setAuditAprovado(null);
      setAuditComplete(false);
      setWaitingReason(null);
      inFlightHashRef.current = '';
      scheduledHashRef.current = '';
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return undefined;
    }

    const ticketId = ticket.id || ticket._id;
    const stored = AI_SUGGESTION_STORE.get(String(ticketId));

    if (serviceUnavailableRef.current) {
      setLoading(false);
      logTicketAi('warn', 'Aguardando correção no servidor — sugestão IA bloqueada.', { ticketId });
      return undefined;
    }

    if (!canFetch || !aiRefreshKey) {
      setLoading(false);
      let reason = 'awaiting_client_message';
      if (useInternalContext) {
        reason = 'awaiting_internal_note';
      } else if (awaitingClientAfterAgentReply) {
        reason = 'awaiting_client_reply';
      }
      setWaitingReason(reason);
      if (reason !== 'awaiting_client_reply') {
        logTicketAi('info', 'Pré-requisito não atendido — sugestão não será solicitada ainda.', {
          ticketId,
          reason,
          internalPlainChars: internalPlain.length,
        });
      } else {
        logTicketAi('info', 'Agente respondeu por último — sugestão IA pausada até nova mensagem do cliente.', {
          ticketId,
        });
      }
      return undefined;
    }

    if (stored?.hash === aiRefreshKey && stored.result) {
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setTabulacaoFonte,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, stored.result);
      lastFetchedHashRef.current = aiRefreshKey;
      setError(null);
      setWaitingReason(null);
      setLoading(false);
      return undefined;
    }

    if (aiRefreshKey === lastFetchedHashRef.current || inFlightHashRef.current === aiRefreshKey) {
      return undefined;
    }

    if (scheduledHashRef.current === aiRefreshKey) {
      return undefined;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const debounceMs = useInternalContext ? INTERNAL_DEBOUNCE_MS : PUBLIC_DEBOUNCE_MS;
    logTicketAi('info', `Agendando fetch em ${debounceMs}ms…`, {
      ticketId,
      aiRefreshKey: hashPreview(aiRefreshKey),
    });
    scheduledHashRef.current = aiRefreshKey;
    debounceRef.current = setTimeout(() => {
      scheduledHashRef.current = '';
      fetchSuggestions(aiRefreshKey, buildPayload(fetchContextRef.current));
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (scheduledHashRef.current === aiRefreshKey) {
        scheduledHashRef.current = '';
      }
    };
  }, [
    ticket?.id,
    ticket?._id,
    canFetch,
    aiRefreshKey,
    useInternalContext,
    fetchSuggestions,
    awaitingClientAfterAgentReply,
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
        internalNotesBlock,
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
        tabulacaoFonte: data.tabulacaoFonte || 'atendimento',
        auditScore: parseAuditScore(data.auditScore),
        auditAprovado: typeof data.auditAprovado === 'boolean' ? data.auditAprovado : null,
        auditComplete: isAuditComplete(data, agentsEnabledRef.current),
      };

      if (aiRefreshKey) {
        cacheRef.current.set(aiRefreshKey, result);
        const tid = String(ticket?.id || ticket?._id || '');
        if (tid) AI_SUGGESTION_STORE.set(tid, { hash: aiRefreshKey, result });
      }
      applySuggestionResult({
        setRespostaSugerida,
        setTabulacao,
        setTabulacaoDisplay,
        setTabulacaoFonte,
        setAuditScore,
        setAuditAprovado,
        setAuditComplete,
      }, result);
      lastFetchedHashRef.current = aiRefreshKey;
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
    internalNotesBlock,
    contextSource,
    aiRefreshKey,
  ]);

  const suppressIaUi = waitingReason === 'awaiting_client_reply';

  return {
    loading,
    error,
    respostaSugerida,
    tabulacao,
    tabulacaoDisplay,
    tabulacaoFonte,
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
      && !suppressIaUi
      && (!agentsEnabled || auditComplete)
    ),
    hasTabulationSuggestion: Boolean(
      (tabulacao || tabulacaoDisplay)
      && !error
      && !suppressIaUi
      && (!agentsEnabled || auditComplete)
    ),
    showIaBar: Boolean(
      !suppressIaUi
      && (canFetch || loading || error || (waitingReason && waitingReason !== 'awaiting_client_reply')),
    ),
    showIaSection: Boolean(
      !suppressIaUi
      && (canFetch || loading || error || waitingReason),
    ),
    requestRevision,
  };
}

function hashPreview(hash) {
  const text = String(hash || '');
  if (text.length <= 48) return text;
  return `${text.slice(0, 24)}…${text.slice(-12)}`;
}
