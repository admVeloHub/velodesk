/**
 * ReclameAquiTabs — abas Tabela / Kanban / Calendário / Relatórios
 */
import React from 'react';
import { RA_TABS } from '../../../services/especiais/reclameAquiData';

export default function ReclameAquiTabs({ activeTab, onChange }) {
  return (
    <nav className="ra-tabs" aria-label="Visualizações Reclame Aqui">
      {RA_TABS.map((tab) => {
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
