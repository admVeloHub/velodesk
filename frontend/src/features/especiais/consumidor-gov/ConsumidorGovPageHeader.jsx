/**
 * ConsumidorGovPageHeader — título + badge + abas
 */
import React from 'react';
import ConsumidorGovTabs from './ConsumidorGovTabs';

export default function ConsumidorGovPageHeader({ activeTab, onTabChange }) {
  return (
    <div className="ra-page-header">
      <div className="ra-page-header__title-row">
        <h1 className="ra-page-header__title">Demandas Consumidor.Gov</h1>
        <span className="ra-page-header__badge">Canal exclusivo</span>
      </div>
      <ConsumidorGovTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
