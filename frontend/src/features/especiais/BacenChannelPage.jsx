/**
 * BacenChannelPage — canal Bacen com rotas aninhadas
 */
import React, { useEffect } from 'react';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import { useEspeciaisChannelTheme } from '../../hooks/useEspeciaisChannelTheme';
import BacenRouter from './bacen/BacenRouter';

export default function BacenChannelPage() {
  persistEspeciaisChannel('bacen');
  const themeVars = useEspeciaisChannelTheme('bacen');

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
    <div className="page active ra-page-wrap" id="especiais-bacen" style={themeVars}>
      <BacenRouter />
    </div>
  );
}
