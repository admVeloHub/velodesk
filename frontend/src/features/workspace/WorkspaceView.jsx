/**
 * Painel 360° — roteamento por perfil
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';
import { useProfile } from '../../context/ProfileContext';
import AgentPanel from './AgentPanel';
import SupervisorPanel from './SupervisorPanel';
import ManagementPanel from './ManagementPanel';

export default function WorkspaceView() {
  const { profileId } = useProfile();

  return (
    <div id="workspace" className="page workspace-page eco-page active">
      <div id="workspace360Content" className="eco-page-inner eco-stagger">
        {profileId === 'supervisor' && <SupervisorPanel />}
        {profileId === 'management' && <ManagementPanel />}
        {profileId !== 'supervisor' && profileId !== 'management' && <AgentPanel />}
      </div>
    </div>
  );
}
