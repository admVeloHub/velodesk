/**
 * ProconTabs — abas Tabela / Relatórios
 */
import React from 'react';
import { PC_TABS } from '../../../services/especiais/proconData';

export default function ProconTabs({ activeTab, onChange }) {
  return (
    <nav className="ra-tabs" aria-label="Visualizações Procon">
      {PC_TABS.map((tab) => {
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
