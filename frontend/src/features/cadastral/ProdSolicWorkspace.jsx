/**
 * ProdSolicWorkspace v1.1.0 — painel de solicitações (com ou sem acompanhamento)
 * VERSION: v1.1.0 | DATE: 2026-07-23
 */
import React, { useCallback, useState } from 'react';
import {
  getLastUpdatedAt,
  getSolicitacoesStats,
  loadSolicitacoes,
  searchSolicitacoesByCpf,
} from '../../services/cadastral/cadastralRequestStore';
import ProdSolicTabs from './components/ProdSolicTabs';
import ProdSolicStatsBar from './components/ProdSolicStatsBar';
import ProdSolicTrackingSidebar from './components/ProdSolicTrackingSidebar';
import SolicitacoesFormTab from './components/SolicitacoesFormTab';
import ErrosBugsFormTab from './components/ErrosBugsFormTab';
import LiberacaoPixFormTab from './components/LiberacaoPixFormTab';

function loadViewState(activeTab, searchCpf = '', withTracking = true) {
  const items = withTracking
    ? (searchCpf
      ? searchSolicitacoesByCpf(searchCpf, activeTab)
      : loadSolicitacoes(activeTab))
    : [];
  return {
    items,
    stats: getSolicitacoesStats(activeTab),
    updatedAt: getLastUpdatedAt(),
  };
}

export default function ProdSolicWorkspace({
  className = '',
  id,
  ticketOverride,
  clientOverride,
  onSubmitted,
  showTracking = true,
}) {
  const [activeTab, setActiveTab] = useState('solicitacoes');
  const [searchCpf, setSearchCpf] = useState('');
  const [view, setView] = useState(() => loadViewState('solicitacoes', '', showTracking));

  const refresh = useCallback((tab = activeTab, cpf = searchCpf) => {
    setView(loadViewState(tab, cpf, showTracking));
  }, [activeTab, searchCpf, showTracking]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchCpf('');
    setView(loadViewState(tabId, '', showTracking));
  };

  const handleSearch = (cpf) => {
    setSearchCpf(cpf);
    setView(loadViewState(activeTab, cpf, showTracking));
  };

  const handleSaved = () => {
    refresh(activeTab, searchCpf);
  };

  const formProps = {
    ticketOverride,
    clientOverride,
    onSaved: handleSaved,
    onSubmitted,
  };

  const rootClass = ['prod-solic-page', className].filter(Boolean).join(' ');
  const layoutClass = [
    'prod-solic-layout',
    showTracking ? '' : 'prod-solic-layout--form-only',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} id={id}>
      <ProdSolicTabs activeTab={activeTab} onChange={handleTabChange} />

      <div className={layoutClass}>
        <section className="prod-solic-main">
          <div className="prod-solic-main__card">
            {showTracking ? (
              <ProdSolicStatsBar
                stats={view.stats}
                updatedAt={view.updatedAt}
                onRefresh={() => refresh()}
              />
            ) : null}

            {activeTab === 'solicitacoes' ? (
              <SolicitacoesFormTab {...formProps} />
            ) : null}
            {activeTab === 'erros-bugs' ? (
              <ErrosBugsFormTab {...formProps} />
            ) : null}
            {activeTab === 'liberacao-pix' ? (
              <LiberacaoPixFormTab {...formProps} />
            ) : null}
          </div>
        </section>

        {showTracking ? (
          <ProdSolicTrackingSidebar
            items={view.items}
            onSearch={handleSearch}
            onRefresh={() => refresh()}
          />
        ) : null}
      </div>
    </div>
  );
}
