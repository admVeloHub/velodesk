/**
 * ProdSolicTabs — abas do painel de solicitações Produtos
 */
import React from 'react';
import { PROD_SOLIC_TABS } from '../../../services/cadastral/solicitacoesProdutosData';

export default function ProdSolicTabs({ activeTab, onChange }) {
  return (
    <nav className="prod-solic-tabs" aria-label="Tipos de solicitação">
      {PROD_SOLIC_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={'prod-solic-tabs__btn' + (isActive ? ' is-active' : '')}
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
