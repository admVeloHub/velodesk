/**
 * ProconChannelPage — canal Procon com rotas aninhadas
 */
import React, { useEffect } from 'react';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import { useEspeciaisChannelTheme } from '../../hooks/useEspeciaisChannelTheme';
import ProconRouter from './procon/ProconRouter';

export default function ProconChannelPage() {
  persistEspeciaisChannel('procon');
  const themeVars = useEspeciaisChannelTheme('procon');

  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return undefined;
    mainContent.classList.remove('tickets-active');
    mainContent.style.background = 'transparent';
    return () => {
      mainContent.style.background = '';
    };
  }, []);

  return (
    <div className="page active ra-page-wrap" id="especiais-procon" style={themeVars}>
      <ProconRouter />
    </div>
  );
}
