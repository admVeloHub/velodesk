/**
 * ConsumidorGovChannelPage — canal Consumidor.Gov com rotas aninhadas
 */
import React from 'react';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import { useEspeciaisChannelTheme } from '../../hooks/useEspeciaisChannelTheme';
import ConsumidorGovRouter from './consumidor-gov/ConsumidorGovRouter';

export default function ConsumidorGovChannelPage() {
  persistEspeciaisChannel('consumidor-gov');
  const themeVars = useEspeciaisChannelTheme('consumidor-gov');

  return (
    <div className="page active ra-page-wrap" id="especiais-consumidor-gov" style={themeVars}>
      <ConsumidorGovRouter />
    </div>
  );
}
