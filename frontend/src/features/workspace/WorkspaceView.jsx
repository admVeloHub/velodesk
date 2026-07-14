/**
 * Painel 360° — roteamento por perfil (Agente / Gestão / Workflow)
 * VERSION: v2.4.0 | DATE: 2026-07-13 | AUTHOR: VeloHub Development Team
 */
import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { computeAgent360View } from '../../services/workspace/deskData';
import { getDeskDisplayName } from '../../utils/userDisplayName';
import Workspace360Header from './components/ws360/Workspace360Header';
import AgentPanel from './AgentPanel';
import GestaoPanel from './GestaoPanel';
import WorkflowPanel from './WorkflowPanel';

function resolveWorkspacePanel(profileId) {
  if (profileId === 'gestao') return GestaoPanel;
  if (profileId === 'workflow') return WorkflowPanel;
  return AgentPanel;
}

export default function WorkspaceView() {
  const { profileId } = useProfile();
  const { user } = useAuth();
  const Panel = resolveWorkspacePanel(profileId);

  const header = useMemo(() => {
    const view = computeAgent360View();
    const agentName = getDeskDisplayName(user) || view.agentName || '';
    return {
      greeting: view.greeting,
      agentName,
      dateTimeLabel: view.dateTimeLabel,
    };
  }, [user]);

  return (
    <div id="workspace" className="page workspace-page eco-page active">
      <div id="workspace360Content" className="eco-page-inner eco-page-inner--workspace360 eco-stagger">
        <div className="ws360-shell">
          <Workspace360Header
            greeting={header.greeting}
            agentName={header.agentName}
            dateTimeLabel={header.dateTimeLabel}
          />
          <Panel />
        </div>
      </div>
    </div>
  );
}
