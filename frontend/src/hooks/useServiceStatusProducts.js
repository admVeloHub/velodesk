/**
 * useServiceStatusProducts v1.0.0 — produtos ativos/fora do ar no Painel 360°
 * VERSION: v1.0.0 | DATE: 2026-07-15
 */
import { useCallback, useEffect, useState } from 'react';
import { tabulationApi } from '../api/client';
import { FALLBACK_SERVICE_STATUS, mapProdutosToServiceStatus } from '../services/workspace/serviceStatusData';

export function useServiceStatusProducts() {
  const [items, setItems] = useState(FALLBACK_SERVICE_STATUS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const produtos = await tabulationApi.listProdutos(true);
      const mapped = mapProdutosToServiceStatus(produtos);
      setItems(mapped.length ? mapped : FALLBACK_SERVICE_STATUS);
    } catch {
      setItems(FALLBACK_SERVICE_STATUS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
