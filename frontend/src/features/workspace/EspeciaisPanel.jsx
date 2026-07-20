/**
 * Painel 360° — Especiais (seleção de canal)
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import EspeciaisChannelSelect from '../especiais/EspeciaisChannelSelect';

export default function EspeciaisPanel() {
  const navigate = useNavigate();

  const handleSelect = useCallback((channelId) => {
    persistEspeciaisChannel(channelId);
    navigate(`/especiais/${channelId}`);
  }, [navigate]);

  return (
    <div className="ws-especiais-desk ws-agent-desk--operational" id="wsEspeciaisDesk">
      <EspeciaisChannelSelect inWorkspace onSelect={handleSelect} />
    </div>
  );
}
