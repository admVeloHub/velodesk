/**
 * useDeskAgents v1.0.0 — agentes Desk (User collection) para atribuição
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { useEffect, useMemo, useState } from 'react';
import { usersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getDeskDisplayName } from '../utils/userDisplayName';

function mapUserToAgent(user) {
  if (!user) return null;
  const email = String(user.email || '').trim().toLowerCase();
  const value = getDeskDisplayName(user) || email;
  if (!value) return null;
  return {
    id: user.id || user._id,
    email,
    value,
    label: value,
    role: user.role || 'agent',
  };
}

export function useDeskAgents() {
  const { isAuthenticated, user: currentUser } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setAgents([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    usersApi.list()
      .then((list) => {
        if (cancelled) return;
        const mapped = (Array.isArray(list) ? list : [])
          .map(mapUserToAgent)
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        setAgents(mapped);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const currentAgentValue = useMemo(
    () => getDeskDisplayName(currentUser) || '',
    [currentUser],
  );

  const agentOptions = useMemo(() => {
    const values = agents.map((a) => a.value);
    if (currentAgentValue && !values.includes(currentAgentValue)) {
      return [currentAgentValue, ...values];
    }
    return values;
  }, [agents, currentAgentValue]);

  return { agents, agentOptions, currentAgentValue, loading };
}
