/**
 * ProconRouter — gestão e registro de demandas
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ProconPanel from './ProconPanel';
import ProconRegistroPage from './ProconRegistroPage';
import ProconCrmRoot from './ProconCrmRoot';

export default function ProconRouter() {
  return (
    <Routes>
      <Route index element={<ProconPanel />} />
      <Route path="nova" element={<ProconRegistroPage />} />
      <Route path="registro/:id" element={<ProconRegistroPage />} />
      <Route path="ticket/:id" element={<ProconCrmRoot />} />
    </Routes>
  );
}
