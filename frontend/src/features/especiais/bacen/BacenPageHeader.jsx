/**
 * BacenPageHeader — título + badge + abas
 */
import React from 'react';
import BacenTabs from './BacenTabs';

export default function BacenPageHeader({ activeTab, onTabChange }) {
  return (
    <div className="ra-page-header">
      <div className="ra-page-header__title-row">
        <h1 className="ra-page-header__title">Demandas Bacen</h1>
        <span className="ra-page-header__badge">Canal exclusivo</span>
      </div>
      <BacenTabs activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
