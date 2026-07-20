/**
 * ReclameAquiPageHeader — título + badge + abas
 */
import React from 'react';
import ReclameAquiTabs from './ReclameAquiTabs';

export default function ReclameAquiPageHeader({ activeTab, onTabChange }) {
  return (
    <div className="ra-page-header">
      <div className="ra-page-header__title-row">
        <h1 className="ra-page-header__title">Reclamações RA</h1>
        <span className="ra-page-header__badge">Canal exclusivo</span>
      </div>
      <ReclameAquiTabs activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
