/**
 * Painel 360° — roteamento por perfil (Agente / Gestão / Workflow / Especiais)
 * VERSION: v2.4.1 | DATE: 2026-07-14 | AUTHOR: VeloHub Development Team
 */
import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { usePermissions } from '../../context/PermissionContext';
import { computeAgent360View } from '../../services/workspace/deskData';
import { getDeskDisplayName } from '../../utils/userDisplayName';
import Workspace360Header from './components/ws360/Workspace360Header';
import AgentPanel from './AgentPanel';
import GestaoPanel from './GestaoPanel';
import WorkflowPanel from './WorkflowPanel';
import EspeciaisPanel from './EspeciaisPanel';

/**
 * Workflow/Especiais são portais próprios (roteamento por profileId). Dentro do Workspace 360
 * "padrão" (Agente/Gestão), quem vê o painel de equipe é decidido pela permissão
 * workspace.painel_360_equipe — não mais fixo em profileId === 'gestao'.
 */
function resolveWorkspacePanel(profileId, canSeeEquipe) {
  if (profileId === 'workflow') return WorkflowPanel;
  if (profileId === 'especiais') return EspeciaisPanel;
  return canSeeEquipe ? GestaoPanel : AgentPanel;
}

export default function WorkspaceView() {
  const { profileId } = useProfile();
  const { can } = usePermissions();
  const { user, colaborador } = useAuth();
  const Panel = resolveWorkspacePanel(profileId, can('workspace', 'painel_360_equipe'));

  const header = useMemo(() => {
    const view = computeAgent360View();
    const agentName = getDeskDisplayName(user, colaborador) || view.agentName || '';
    return {
      greeting: view.greeting,
      agentName,
      dateTimeLabel: view.dateTimeLabel,
    };
  }, [user, colaborador]);

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
