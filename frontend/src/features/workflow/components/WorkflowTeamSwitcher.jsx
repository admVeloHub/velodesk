/**
 * WorkflowTeamSwitcher — tabs Financeiro / Produtos no console (Gestão)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getWorkflowTeamActionCounts } from '../../../services/workflow/workflowApprovalData';
import { WORKFLOW_TEAM_QUEUES } from '../../../services/workflow/workflowTeamQueues';

export default function WorkflowTeamSwitcher({ activeTeamId, onSelect }) {
  const [counts, setCounts] = useState(() => getWorkflowTeamActionCounts());

  const refreshCounts = useCallback(() => {
    setCounts(getWorkflowTeamActionCounts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const onRefresh = () => refreshCounts();
    window.addEventListener('velodesk:refresh-tickets', onRefresh);
    window.addEventListener('velodesk:workflow-demo-changed', onRefresh);
    return () => {
      window.removeEventListener('velodesk:refresh-tickets', onRefresh);
      window.removeEventListener('velodesk:workflow-demo-changed', onRefresh);
    };
  }, [refreshCounts]);

  return (
    <nav className="wf-approval-team-switcher" role="tablist" aria-label="Time de workflow">
      {WORKFLOW_TEAM_QUEUES.map((team) => {
        const count = counts[team.id] ?? 0;
        const isActive = activeTeamId === team.id;
        return (
          <button
            key={team.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`wf-approval-team-switcher__tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(team.id)}
          >
            <span
              className="wf-approval-team-switcher__dot"
              style={{ background: team.dot }}
              aria-hidden="true"
            />
            <span className="wf-approval-team-switcher__label">{team.name}</span>
            <span className="wf-approval-team-switcher__count">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
