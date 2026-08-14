/**
 * ReclameAquiPanel — painel operacional Reclame Aqui
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { useRaNovaReclamacaoModals } from '../../../hooks/useRaNovaReclamacaoModals';
import {
  getFooterSummary,
  getReclameAquiKpis,
  getReportSeries,
  groupReclamacoesByStatus,
  loadReclamacoes,
} from '../../../services/especiais/reclameAquiStore';
import { loadReclameAquiTicketsFromApi } from '../../../services/especiais/reclameAquiTicketService';
import ReclameAquiTopBar from './ReclameAquiTopBar';
import ReclameAquiPageHeader from './ReclameAquiPageHeader';
import ReclameAquiToolbar from './ReclameAquiToolbar';
import ReclameAquiKpiRow from './ReclameAquiKpiRow';
import ReclameAquiTableView from './ReclameAquiTableView';
import ReclameAquiReportsView from './ReclameAquiReportsView';

function loadViewState({ search, activeChips }) {
  const items = loadReclamacoes({ search, activeChips, gestaoView: true });
  return {
    items,
    kpis: getReclameAquiKpis(items),
    groups: groupReclamacoesByStatus(items),
    series: getReportSeries(items),
  };
}

export default function ReclameAquiPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('tabela');
  const [search, setSearch] = useState('');
  const [activeChips, setActiveChips] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);

  useEffect(() => {
    const refreshFromApi = () => {
      loadReclameAquiTicketsFromApi().catch(() => {});
    };
    refreshFromApi();
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:ra-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', refreshFromApi);
    return () => {
      window.removeEventListener('velodesk:ra-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', refreshFromApi);
    };
  }, []);

  const { openNovaFlow, modals: novaModals } = useRaNovaReclamacaoModals({
    navigate,
    onImported: () => setListVersion((v) => v + 1),
  });

  const view = useMemo(
    () => loadViewState({ search, activeChips }),
    [search, activeChips, listVersion],
  );

  const footerText = getFooterSummary(view.items, selectedIds.length);

  const handleToggleChip = useCallback((chipId) => {
    setActiveChips((prev) =>
      prev.includes(chipId) ? prev.filter((c) => c !== chipId) : [...prev, chipId],
    );
    setPage(1);
  }, []);

  const handleToolbarAction = useCallback((action) => {
    if (action === 'nova') {
      openNovaFlow();
      return;
    }
    const messages = {
      filtrar: 'Filtros avançados em breve.',
      ordenar: 'Ordenação em breve.',
      exportar: 'Exportação em breve.',
    };
    showNotification(messages[action] || 'Em breve.', 'info');
  }, [openNovaFlow, showNotification]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleToggleSelectAll = useCallback((ids, select) => {
    setSelectedIds(select ? [...ids] : []);
  }, []);

  const handleRowAction = useCallback((action, item) => {
    if (action === 'responder' && item?.id) {
      if (item.ticketId) {
        navigate(`/especiais/reclame-aqui/ticket/${item.id}`);
      } else {
        navigate(`/especiais/reclame-aqui/registro/${item.id}`);
      }
      return;
    }
    showNotification('Ação em breve.', 'info');
  }, [navigate, showNotification]);

  return (
    <div className="ra-panel" id="reclameAquiPanel">
      <ReclameAquiTopBar />

      <div className="ra-panel__body">
        <button
          type="button"
          className="ra-panel__back"
          onClick={() => navigate('/workspace')}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Trocar canal
        </button>

        <ReclameAquiPageHeader activeTab={activeTab} onTabChange={setActiveTab} />

        <ReclameAquiToolbar
          search={search}
          onSearchChange={setSearch}
          activeChips={activeChips}
          onToggleChip={handleToggleChip}
          onAction={handleToolbarAction}
        />

        <ReclameAquiKpiRow kpis={view.kpis} />

        <div className="ra-panel__content">
          {activeTab === 'tabela' && (
            <ReclameAquiTableView
              groups={view.groups}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onRowAction={handleRowAction}
            />
          )}
          {activeTab === 'relatorios' && (
            <ReclameAquiReportsView series={view.series} kpis={view.kpis} />
          )}
        </div>

        {activeTab === 'tabela' ? (
          <footer className="ra-panel__footer">
            <div className="ra-panel__footer-left">
              <span>{footerText}</span>
            </div>
            <div className="ra-panel__pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                <i className="ti ti-chevron-left" />
              </button>
              <span>{page} de 2 páginas</span>
              <button type="button" disabled={page >= 2} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          </footer>
        ) : null}
      </div>

      {novaModals}
    </div>
  );
}
