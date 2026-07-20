/**
 * ProdSolicWorkspace — painel compartilhado de solicitações ao time de Produtos
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

function loadViewState(activeTab, searchCpf = '') {
  const items = searchCpf
    ? searchSolicitacoesByCpf(searchCpf, activeTab)
    : loadSolicitacoes(activeTab);
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
}) {
  const [activeTab, setActiveTab] = useState('solicitacoes');
  const [searchCpf, setSearchCpf] = useState('');
  const [view, setView] = useState(() => loadViewState('solicitacoes'));

  const refresh = useCallback((tab = activeTab, cpf = searchCpf) => {
    setView(loadViewState(tab, cpf));
  }, [activeTab, searchCpf]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchCpf('');
    setView(loadViewState(tabId));
  };

  const handleSearch = (cpf) => {
    setSearchCpf(cpf);
    setView(loadViewState(activeTab, cpf));
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

  return (
    <div className={rootClass} id={id}>
      <ProdSolicTabs activeTab={activeTab} onChange={handleTabChange} />

      <div className="prod-solic-layout">
        <section className="prod-solic-main">
          <div className="prod-solic-main__card">
            <ProdSolicStatsBar
              stats={view.stats}
              updatedAt={view.updatedAt}
              onRefresh={() => refresh()}
            />

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

        <ProdSolicTrackingSidebar
          items={view.items}
          onSearch={handleSearch}
          onRefresh={() => refresh()}
        />
      </div>
    </div>
  );
}
