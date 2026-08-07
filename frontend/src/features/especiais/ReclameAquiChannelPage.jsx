/**
 * ReclameAquiChannelPage — canal RA com rotas aninhadas
 */
import React from 'react';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import { useEspeciaisChannelTheme } from '../../hooks/useEspeciaisChannelTheme';
import ReclameAquiRouter from './reclame-aqui/ReclameAquiRouter';

export default function ReclameAquiChannelPage() {
  persistEspeciaisChannel('reclame-aqui');
  const themeVars = useEspeciaisChannelTheme('reclame-aqui');

  return (
    <div className="page active ra-page-wrap" id="especiais-reclame-aqui" style={themeVars}>
      <ReclameAquiRouter />
    </div>
  );
}
