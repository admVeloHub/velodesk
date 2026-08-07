/**
 * ProconPageHeader — título + badge + abas
 */
import React from 'react';
import ProconTabs from './ProconTabs';

export default function ProconPageHeader({ activeTab, onTabChange }) {
  return (
    <div className="ra-page-header">
      <div className="ra-page-header__title-row">
        <h1 className="ra-page-header__title">Demandas Procon</h1>
        <span className="ra-page-header__badge">Canal exclusivo</span>
      </div>
      <ProconTabs activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
