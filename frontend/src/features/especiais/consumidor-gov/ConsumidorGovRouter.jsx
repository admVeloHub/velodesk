/**
 * ConsumidorGovRouter — gestão e registro de demandas
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ConsumidorGovPanel from './ConsumidorGovPanel';
import ConsumidorGovRegistroPage from './ConsumidorGovRegistroPage';
import ConsumidorGovNovaCpfPage from './ConsumidorGovNovaCpfPage';
import ConsumidorGovCrmRoot from './ConsumidorGovCrmRoot';

export default function ConsumidorGovRouter() {
  return (
    <Routes>
      <Route index element={<ConsumidorGovPanel />} />
      <Route path="nova" element={<ConsumidorGovNovaCpfPage />} />
      <Route path="registro/:id" element={<ConsumidorGovRegistroPage />} />
      <Route path="ticket/:id" element={<ConsumidorGovCrmRoot />} />
    </Routes>
  );
}
