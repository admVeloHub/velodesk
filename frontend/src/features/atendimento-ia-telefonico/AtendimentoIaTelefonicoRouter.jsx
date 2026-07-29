/**
 * AtendimentoIaTelefonicoRouter v1.0.0 — rotas lista/detalhe
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import TelephonyCallsPanel from './TelephonyCallsPanel';
import TelephonyCallDetail from './TelephonyCallDetail';

export default function AtendimentoIaTelefonicoRouter() {
  return (
    <Routes>
      <Route index element={<TelephonyCallsPanel />} />
      <Route path="calls/:id" element={<TelephonyCallDetail />} />
    </Routes>
  );
}
