/**
 * useEspeciaisDualSearch — busca rápida CRM em n1 + reclamacoes
 * VERSION: v1.0.0 | DATE: 2026-08-18
 */
import { useEffect, useState } from 'react';

/**
 * @param {object} opts
 * @param {string} opts.queueQuery — busca da fila (aplicada no Enter)
 * @param {string} opts.listQuery — busca da lista (ticket/CPF)
 * @param {(q: string) => Promise<object[]>} opts.searchFn
 */
export function useEspeciaisDualSearch({ queueQuery, listQuery, searchFn }) {
  const [remoteItems, setRemoteItems] = useState(null);
  const [searching, setSearching] = useState(false);
  const activeQuery = String(listQuery || '').trim() || String(queueQuery || '').trim();

  useEffect(() => {
    if (!activeQuery) {
      setRemoteItems(null);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.resolve(searchFn(activeQuery))
        .then((items) => {
          if (!cancelled) setRemoteItems(Array.isArray(items) ? items : []);
        })
        .catch(() => {
          if (!cancelled) setRemoteItems([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeQuery, searchFn]);

  return {
    activeQuery,
    remoteItems,
    searching,
    isRemoteSearch: Boolean(activeQuery),
  };
}
