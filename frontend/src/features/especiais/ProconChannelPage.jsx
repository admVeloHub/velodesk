/**
 * ProconChannelPage — canal Procon com rotas aninhadas
 */
import React from 'react';
import { persistEspeciaisChannel } from '../../config/especiaisChannels';
import ProconRouter from './procon/ProconRouter';

export default function ProconChannelPage() {
  persistEspeciaisChannel('procon');

  return (
    <div className="page active ra-page-wrap" id="especiais-procon">
      <ProconRouter />
    </div>
  );
}
