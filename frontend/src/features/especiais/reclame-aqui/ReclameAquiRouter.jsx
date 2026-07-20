/**
 * ReclameAquiRouter — gestão e registro de reclamações
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ReclameAquiPanel from './ReclameAquiPanel';
import ReclameAquiRegistroPage from './ReclameAquiRegistroPage';
import ReclameAquiCrmRoot from './ReclameAquiCrmRoot';

export default function ReclameAquiRouter() {
  return (
    <Routes>
      <Route index element={<ReclameAquiPanel />} />
      <Route path="nova" element={<ReclameAquiRegistroPage />} />
      <Route path="registro/:id" element={<ReclameAquiRegistroPage />} />
      <Route path="ticket/:id" element={<ReclameAquiCrmRoot />} />
    </Routes>
  );
}
