/**
 * BacenRouter — gestão e registro de demandas
 */
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import BacenPanel from './BacenPanel';
import BacenRegistroPage from './BacenRegistroPage';
import BacenNovaCpfPage from './BacenNovaCpfPage';
import BacenCrmRoot from './BacenCrmRoot';

export default function BacenRouter() {
  return (
    <Routes>
      <Route index element={<BacenPanel />} />
      <Route path="nova" element={<BacenNovaCpfPage />} />
      <Route path="registro/:id" element={<BacenRegistroPage />} />
      <Route path="ticket/:id" element={<BacenCrmRoot />} />
    </Routes>
  );
}
