/**
 * BacenTabs — abas Tabela / Relatórios
 */
import React from 'react';
import { BC_TABS } from '../../../services/especiais/bacenData';

export default function BacenTabs({ activeTab, onChange }) {
  return (
    <nav className="ra-tabs" aria-label="Visualizações Bacen">
      {BC_TABS.map((tab) => {
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
