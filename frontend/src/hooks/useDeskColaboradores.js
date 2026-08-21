/**
 * useDeskColaboradores v1.2.0 — label via alias ou primeiro+último
 * VERSION: v1.2.0 | DATE: 2026-08-20
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { colaboradoresApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatAtuacaoLabels,
  getDeskVisionLabel,
  resolveDeskVisionFromAtuacao,
} from '../services/desk/atuacaoVision';
import { resolveAgentDisplayName } from '../utils/userDisplayName';
import { setResponsavelDisplayColaboradores } from '../services/desk/responsavelDisplay';

function mapColaboradorToAgent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = String(raw.userMail || raw.userEmail || raw.email || '').trim().toLowerCase();
  const nome = String(raw.colaboradorNome || '').trim();
  const displayName = resolveAgentDisplayName({
    aliasColaborador: raw.aliasColaborador,
    colaboradorNome: nome,
  });
  const value = displayName || nome || email;
  if (!value) return null;

  const atuacao = Array.isArray(raw.atuacao) ? raw.atuacao : [];
  const vision = resolveDeskVisionFromAtuacao(atuacao);

  return {
    id: raw._id || raw.id || email || value,
    email,
    value,
    label: displayName || nome || email,
    displayName: displayName || nome || email,
    colaboradorNome: nome,
    role: vision,
    vision,
    visionLabel: getDeskVisionLabel(vision),
    atuacao,
    atuacaoLabel: formatAtuacaoLabels(atuacao),
    empresa: String(raw.empresa || '').trim(),
    afastado: raw.afastado === true,
    desligado: raw.desligado === true,
    raw,
  };
}

export function useDeskColaboradores() {
  const { isAuthenticated } = useAuth();
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setColaboradores([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const list = await colaboradoresApi.listDesk();
      const mapped = (Array.isArray(list) ? list : [])
        .map(mapColaboradorToAgent)
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      setColaboradores(mapped);
      setResponsavelDisplayColaboradores(mapped);
    } catch (err) {
      setColaboradores([]);
      setError(err?.response?.data?.message || err?.message || 'Falha ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setColaboradores([]);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    colaboradoresApi.listDesk()
      .then((list) => {
        if (cancelled) return;
        const mapped = (Array.isArray(list) ? list : [])
          .map(mapColaboradorToAgent)
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        setColaboradores(mapped);
      setResponsavelDisplayColaboradores(mapped);
      })
      .catch((err) => {
        if (cancelled) return;
        setColaboradores([]);
        setError(err?.response?.data?.message || err?.message || 'Falha ao carregar colaboradores');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const agents = useMemo(() => colaboradores, [colaboradores]);

  const agentOptions = useMemo(
    () => colaboradores.map((c) => c.value),
    [colaboradores],
  );

  return {
    colaboradores,
    agents,
    agentOptions,
    loading,
    error,
    reload,
  };
}
