/**
 * AgentPresenceHeartbeat v1.0.0 — inicia heartbeat quando autenticado
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { startAgentPresenceHeartbeat, stopAgentPresenceHeartbeat } from '../services/agentPresence';

export default function AgentPresenceHeartbeat() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      stopAgentPresenceHeartbeat();
      return undefined;
    }

    startAgentPresenceHeartbeat();
    return () => stopAgentPresenceHeartbeat();
  }, [isAuthenticated]);

  return null;
}
