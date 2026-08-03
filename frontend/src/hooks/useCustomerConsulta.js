/**
 * useCustomerConsulta v1.0.2 — rascunho + CPF do client como fallback
 * VERSION: v1.0.2 | DATE: 2026-08-03
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { consultasApi } from '../api/client';
import { getTicketRefFromTicket } from '../services/desk/consultaFormatters';

const cache = new Map();

function cacheKey(ticket, client) {
  const ref = getTicketRefFromTicket(ticket, client);
  return ref.ticketId || ref.protocolo || ref.cpf || '';
}

function normalizeError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data || {};
  const message = data.message || err?.message || 'Não foi possível carregar as consultas.';
  const code = data.code || '';
  if (code === 'missing_cpf' || code === 'invalid_cpf' || status === 422) {
    return { type: 'missing_cpf', message, code };
  }
  if (code === 'ticket_not_found' || status === 404) {
    return { type: 'ticket_not_found', message, code };
  }
  if (status === 503) {
    return { type: 'not_configured', message, code };
  }
  return { type: 'error', message, status, code };
}

export default function useCustomerConsulta({ ticket, client, active }) {
  const [state, setState] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [productLoading, setProductLoading] = useState({});
  const ticketKey = cacheKey(ticket, client);
  const load360Ref = useRef(null);

  const applyPayload = useCallback((payload) => {
    setData(payload);
    setState('loaded');
    setError(null);
    if (ticketKey) cache.set(ticketKey, payload);
  }, [ticketKey]);

  const load360 = useCallback(async (force = false) => {
    const ref = getTicketRefFromTicket(ticket, client);
    if (!ticket || (!ref.ticketId && !ref.protocolo && !ref.cpf)) return;

    if (!force && cache.has(ticketKey)) {
      applyPayload(cache.get(ticketKey));
      return;
    }

    setRefreshing(true);
    setState((prev) => (prev === 'loaded' && force ? prev : 'loading'));
    setError(null);

    try {
      const ref = getTicketRefFromTicket(ticket, client);
      const payload = await consultasApi.fetch360(ref);
      applyPayload(payload);
    } catch (err) {
      const normalized = normalizeError(err);
      setError(normalized);
      setState(normalized.type === 'missing_cpf' ? 'missing_cpf' : normalized.type === 'ticket_not_found' ? 'ticket_not_found' : 'error');
      if (force) setData(null);
    } finally {
      setRefreshing(false);
    }
  }, [ticket, client, ticketKey, applyPayload]);

  load360Ref.current = load360;

  const reload = useCallback(() => {
    if (ticketKey) cache.delete(ticketKey);
    return load360(true);
  }, [ticketKey, load360]);

  const loadProduct = useCallback(async (slug) => {
    if (!ticket || !slug) return null;

    setProductLoading((prev) => ({ ...prev, [slug]: true }));
    try {
      const ref = getTicketRefFromTicket(ticket, client);
      const snapshot = await consultasApi.fetchProduct(slug, ref);
      setData((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          products: {
            ...(prev.products || {}),
            [slug]: {
              status: snapshot.status,
              ok: snapshot.ok,
              data: snapshot.data,
              requestId: snapshot.requestId,
              loaded: true,
            },
          },
          pendingExpand: (prev.pendingExpand || []).filter((item) => item !== slug),
        };
        if (ticketKey) cache.set(ticketKey, next);
        return next;
      });
      return snapshot;
    } catch (err) {
      const normalized = normalizeError(err);
      setError(normalized);
      throw err;
    } finally {
      setProductLoading((prev) => ({ ...prev, [slug]: false }));
    }
  }, [ticket, client, ticketKey]);

  useEffect(() => {
    if (!active || !ticket || !ticketKey) return;

    const cached = cache.get(ticketKey);
    if (cached) {
      applyPayload(cached);
      return;
    }

    load360Ref.current?.(false);
  }, [active, ticket, client, ticketKey, applyPayload]);

  return {
    state,
    data,
    error,
    refreshing,
    productLoading,
    reload,
    loadProduct,
  };
}
