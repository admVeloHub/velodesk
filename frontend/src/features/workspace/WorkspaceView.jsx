/**
 * Painel 360° — roteamento por perfil
 * VERSION: v2.2.0 | DATE: 2026-06-19
 */
import React, { useMemo } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { computeAgent360View } from '../../services/workspace/deskData';
import Workspace360Header from './components/ws360/Workspace360Header';
import AgentPanel from './AgentPanel';
import SupervisorPanel from './SupervisorPanel';

export default function WorkspaceView() {
  const { profileId } = useProfile();
  const header = useMemo(() => {
    const view = computeAgent360View();
    return {
      greeting: view.greeting,
      agentName: view.agentName,
      dateTimeLabel: view.dateTimeLabel,
    };
  }, []);

  return (
    <div id="workspace" className="page workspace-page eco-page active">
      <div id="workspace360Content" className="eco-page-inner eco-page-inner--workspace360 eco-stagger">
        <div className="ws360-shell">
          <Workspace360Header
            greeting={header.greeting}
            agentName={header.agentName}
            dateTimeLabel={header.dateTimeLabel}
          />
          {profileId === 'supervisor' ? <SupervisorPanel /> : <AgentPanel />}
        </div>
      </div>
    </div>
  );
}
