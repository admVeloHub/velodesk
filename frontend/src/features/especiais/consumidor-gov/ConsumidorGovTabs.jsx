/**
 * ConsumidorGovTabs — abas Tabela / Relatórios
 */
import React from 'react';
import { CG_TABS } from '../../../services/especiais/consumidorGovData';

export default function ConsumidorGovTabs({ activeTab, onChange }) {
  return (
    <nav className="ra-tabs" aria-label="Visualizações ConsumidorGov">
      {CG_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={'ra-tabs__btn' + (isActive ? ' is-active' : '')}
            onClick={() => onChange(tab.id)}
          >
            <i className={`ti ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
